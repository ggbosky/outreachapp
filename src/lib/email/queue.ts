import { prisma } from "@/lib/db";
import { config } from "@/lib/config";
import { sendEmail } from "./mailer";

const DAY = 24 * 60 * 60 * 1000;
const STOP_STATUSES = ["REPLIED", "CONVERTED", "REJECTED"] as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const randomDelayMs = () => {
  const { delayMinSeconds: min, delayMaxSeconds: max } = config.email;
  return (min + Math.random() * Math.max(0, max - min)) * 1000;
};

/**
 * Zařadí e-mailovou sekvenci leadu do fronty: úvodní e-mail hned,
 * follow-upy po N dnech (followUpDelayDays z kampaně).
 */
export async function queueLeadSequence(leadId: string) {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId }, include: { campaign: true } });
  if (!lead.email) throw new Error("Lead nemá e-mail");

  const drafts = await prisma.message.findMany({
    // Neodeslané zprávy (i dříve neúspěšné / zrušené) lze zařadit znovu
    where: { leadId, channel: "EMAIL", direction: "OUTBOUND", status: { in: ["DRAFT", "FAILED", "CANCELLED"] } },
    orderBy: { step: "asc" },
  });
  if (drafts.length === 0) throw new Error("Lead nemá žádné neodeslané e-maily");

  const gapDays = lead.campaign?.followUpDelayDays ?? 3;
  const now = Date.now();
  await prisma.$transaction(
    drafts.map((m) =>
      prisma.message.update({
        where: { id: m.id },
        data: { status: "QUEUED", scheduledAt: new Date(now + m.step * gapDays * DAY), error: null },
      }),
    ),
  );
  return drafts.length;
}

/** Zruší naplánované follow-upy (např. když lead odpověděl). */
export async function cancelQueued(leadId: string, reason: string) {
  await prisma.message.updateMany({
    where: { leadId, status: "QUEUED" },
    data: { status: "CANCELLED", error: reason },
  });
}

let running = false;

/**
 * Odešle splatné e-maily z fronty s náhodným rozestupem (ochrana proti spamu)
 * a s denním limitem. Běží vždy jen jedna instance.
 */
export async function processQueue(opts: { maxToSend?: number; log?: (s: string) => void } = {}) {
  const log = opts.log ?? ((s: string) => console.log(`[queue] ${s}`));
  if (running) {
    log("Fronta už běží");
    return { sent: 0, failed: 0, skipped: true };
  }
  running = true;
  let sent = 0;
  let failed = 0;

  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const sentToday = await prisma.message.count({
      where: { channel: "EMAIL", direction: "OUTBOUND", status: "SENT", sentAt: { gte: startOfDay } },
    });
    const budget = Math.min(config.email.dailyLimit - sentToday, opts.maxToSend ?? Infinity);
    if (budget <= 0) {
      log(`Denní limit ${config.email.dailyLimit} e-mailů je vyčerpán`);
      return { sent, failed, skipped: false };
    }

    const due = await prisma.message.findMany({
      where: { channel: "EMAIL", direction: "OUTBOUND", status: "QUEUED", scheduledAt: { lte: new Date() } },
      include: { lead: true },
      orderBy: [{ scheduledAt: "asc" }, { step: "asc" }],
      take: budget,
    });
    log(`Ve frontě ${due.length} splatných e-mailů (limit dnes: ${budget})`);

    for (const msg of due) {
      const { lead } = msg;
      if ((STOP_STATUSES as readonly string[]).includes(lead.status)) {
        await cancelQueued(lead.id, `Zastaveno – lead má stav ${lead.status}`);
        continue;
      }
      if (!lead.email) {
        await prisma.message.update({ where: { id: msg.id }, data: { status: "FAILED", error: "Lead nemá e-mail" } });
        failed++;
        continue;
      }

      // Follow-up jde jako odpověď ve vlákně předchozích e-mailů
      const previous = await prisma.message.findMany({
        where: { leadId: lead.id, channel: "EMAIL", direction: "OUTBOUND", status: "SENT", step: { lt: msg.step } },
        orderBy: { step: "asc" },
      });
      if (msg.step > 0 && previous.length === 0) {
        // Úvodní e-mail ještě neodešel – počkáme na další běh
        continue;
      }
      const first = previous[0];
      const subject = msg.subject || (first?.subject ? `Re: ${first.subject}` : lead.name);
      const references = previous.map((p) => p.externalId).filter((id): id is string => Boolean(id));

      try {
        const { messageId } = await sendEmail({
          to: lead.email,
          subject,
          text: msg.content,
          inReplyTo: references.at(-1),
          references,
        });
        await prisma.message.update({
          where: { id: msg.id },
          data: { status: "SENT", sentAt: new Date(), externalId: messageId, subject, error: null },
        });
        if (lead.status === "NEW" || lead.status === "RESEARCHED") {
          await prisma.lead.update({ where: { id: lead.id }, data: { status: "CONTACTED" } });
        }
        sent++;
        log(`✓ Odesláno: ${lead.name} <${lead.email}> (krok ${msg.step})`);
      } catch (err) {
        failed++;
        await prisma.message.update({
          where: { id: msg.id },
          data: { status: "FAILED", error: (err as Error).message },
        });
        log(`✗ Chyba u ${lead.email}: ${(err as Error).message}`);
        // Bez úvodního e-mailu nedávají follow-upy smysl
        if (msg.step === 0) await cancelQueued(lead.id, "Úvodní e-mail se nepodařilo odeslat");
      }

      if (sent + failed < due.length) {
        const wait = randomDelayMs();
        log(`Čekám ${Math.round(wait / 1000)} s před dalším e-mailem…`);
        await sleep(wait);
      }
    }
  } finally {
    running = false;
  }
  return { sent, failed, skipped: false };
}
