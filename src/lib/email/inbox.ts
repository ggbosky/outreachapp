import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { prisma } from "@/lib/db";
import { config } from "@/lib/config";
import { classifyReply } from "@/lib/ai/sentiment";
import { cancelQueued } from "./queue";

/** Odstraní citovanou část odpovědi ("Dne … napsal:", "> …"). */
function stripQuoted(text: string): string {
  const lines = text.split(/\r?\n/);
  const cut = lines.findIndex((l) =>
    /^(>|On .+wrote:|Dne .+(napsal|napsala|odeslal)|-{2,}\s*(Original Message|Původní zpráva)|Od:\s|From:\s)/i.test(l.trim()),
  );
  return (cut === -1 ? lines : lines.slice(0, cut)).join("\n").trim();
}

/**
 * Stáhne nové e-maily z IMAP schránky, spáruje je s leady (In-Reply-To / adresa odesílatele),
 * uloží je jako příchozí zprávy a nechá AI určit sentiment.
 */
export async function syncInbox(opts: { log?: (s: string) => void } = {}) {
  const log = opts.log ?? ((s: string) => console.log(`[inbox] ${s}`));
  if (!config.imap.user || !config.imap.pass) throw new Error("Chybí IMAP_USER / IMAP_PASS (nebo SMTP_*) v .env");

  const client = new ImapFlow({
    host: config.imap.host,
    port: config.imap.port,
    secure: config.imap.secure,
    auth: { user: config.imap.user, pass: config.imap.pass },
    logger: false,
  });

  const leads = await prisma.lead.findMany({
    where: { OR: [{ email: { not: null } }, { emails: { isEmpty: false } }] },
    select: { id: true, email: true, emails: true },
  });
  const leadByEmail = new Map<string, string>();
  for (const l of leads) {
    for (const e of [l.email, ...l.emails]) if (e) leadByEmail.set(e.toLowerCase(), l.id);
  }

  let imported = 0;
  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  try {
    const since = new Date(Date.now() - config.imap.lookbackDays * 24 * 60 * 60 * 1000);
    const uids = await client.search({ since }, { uid: true });
    if (!uids || uids.length === 0) return { imported };

    for (const msg of await client.fetchAll(uids, { source: true }, { uid: true })) {
      if (!msg.source) continue;
      const parsed = await simpleParser(msg.source);
      const messageId = parsed.messageId;
      const from = parsed.from?.value[0]?.address?.toLowerCase();
      if (!messageId || !from || from === config.imap.user.toLowerCase()) continue;
      if (await prisma.message.findUnique({ where: { externalId: messageId } })) continue;

      // 1) Párování přes vlákno (odpověď na náš e-mail), 2) přes adresu odesílatele
      const refs = [parsed.inReplyTo, ...(Array.isArray(parsed.references) ? parsed.references : [parsed.references])]
        .filter((r): r is string => Boolean(r));
      const original = refs.length
        ? await prisma.message.findFirst({ where: { externalId: { in: refs } }, orderBy: { step: "desc" } })
        : null;
      const leadId = original?.leadId ?? leadByEmail.get(from);
      if (!leadId) continue;

      const text = stripQuoted(parsed.text || "") || (parsed.text || "").slice(0, 5000);
      let sentiment: Awaited<ReturnType<typeof classifyReply>> | null = null;
      try {
        sentiment = await classifyReply({ reply: text, originalMessage: original?.content });
      } catch (err) {
        log(`Sentiment se nepodařilo určit: ${(err as Error).message}`);
      }

      await prisma.message.create({
        data: {
          leadId,
          campaignId: original?.campaignId,
          channel: "EMAIL",
          direction: "INBOUND",
          status: "RECEIVED",
          subject: parsed.subject ?? null,
          content: text,
          externalId: messageId,
          inReplyTo: parsed.inReplyTo ?? null,
          fromEmail: from,
          sentAt: parsed.date ?? new Date(),
          sentiment: sentiment?.sentiment,
          summary: sentiment ? `${sentiment.summary}\nDalší krok: ${sentiment.suggested_next_step}` : null,
        },
      });

      // NEUTRAL = většinou automatická odpověď (nepřítomnost) → sekvenci nezastavujeme
      if (sentiment?.sentiment !== "NEUTRAL") {
        const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
        await prisma.lead.update({
          where: { id: leadId },
          data: {
            sentiment: sentiment?.sentiment ?? lead.sentiment,
            status:
              sentiment?.sentiment === "NOT_INTERESTED"
                ? "REJECTED"
                : lead.status === "CONVERTED"
                  ? lead.status
                  : "REPLIED",
          },
        });
        // Kdo odpověděl, nedostane další automatické follow-upy
        await cancelQueued(leadId, "Zastaveno – lead odpověděl");
      }
      imported++;
      log(`✉ Odpověď od ${from} → ${sentiment?.sentiment ?? "?"}`);
    }
  } finally {
    lock.release();
    await client.logout().catch(() => {});
  }
  return { imported };
}
