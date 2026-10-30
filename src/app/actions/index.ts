"use server";

import { revalidatePath } from "next/cache";
import type { CampaignStatus, Channel, LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { runScrapeJob, scrapeLead } from "@/lib/scraper/pipeline";
import { SEARCH_SOURCES, type SearchSource } from "@/lib/scraper/search";
import { toOrigin } from "@/lib/scraper/utils";
import { generateOutreach, researchLead } from "@/lib/ai/research";
import { processQueue, queueLeadSequence } from "@/lib/email/queue";
import { syncInbox } from "@/lib/email/inbox";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

async function wrap(fn: () => Promise<string | void>, ...paths: string[]): Promise<ActionResult> {
  try {
    const message = (await fn()) || undefined;
    for (const p of paths) revalidatePath(p, p.includes("[") ? "page" : undefined);
    return { ok: true, message };
  } catch (err) {
    console.error(err);
    return { ok: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------- Scraping

export async function startScrapeJob(input: {
  query: string;
  location?: string;
  sources: string[];
  maxResults: number;
}): Promise<ActionResult> {
  return wrap(async () => {
    const valid = new Set(SEARCH_SOURCES.map((s) => s.id));
    const sources = input.sources.filter((s): s is SearchSource => valid.has(s as SearchSource));
    if (!input.query.trim()) throw new Error("Zadej obor nebo klíčová slova");
    if (sources.length === 0) throw new Error("Vyber alespoň jeden zdroj");

    const job = await prisma.scrapeJob.create({
      data: {
        query: input.query.trim(),
        location: input.location?.trim() || null,
        sources,
        maxResults: Math.min(Math.max(input.maxResults || 20, 1), 200),
      },
    });
    // Běží na pozadí v Node procesu (next dev / next start). Na serverless použij `npm run scrape`.
    void runScrapeJob(job.id);
    return "Scraping spuštěn – průběh uvidíš v sekci Scraper";
  }, "/scraper", "/leads");
}

export async function scrapeLeadAction(leadId: string) {
  return wrap(async () => {
    const lead = await scrapeLead(leadId);
    return `Web prošel – e-mailů: ${lead.emails.length}, telefonů: ${lead.phones.length}`;
  }, "/leads", `/leads/${leadId}`);
}

// ---------------------------------------------------------------- AI

export async function researchLeadAction(leadId: string, withMessages = true) {
  return wrap(async () => {
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
    if (!lead.scrapedContent && lead.website) await scrapeLead(leadId);
    await researchLead(leadId);
    if (withMessages) await generateOutreach(leadId);
    return withMessages ? "Výzkum hotový a zprávy vygenerované" : "Výzkum hotový";
  }, "/leads", `/leads/${leadId}`);
}

export async function generateMessagesAction(leadId: string) {
  return wrap(async () => {
    await generateOutreach(leadId);
    return "Zprávy vygenerované";
  }, `/leads/${leadId}`);
}

// ---------------------------------------------------------------- Leads

export async function createLead(input: { name: string; website?: string; email?: string; campaignId?: string }) {
  return wrap(async () => {
    if (!input.name.trim()) throw new Error("Zadej název firmy");
    await prisma.lead.create({
      data: {
        name: input.name.trim(),
        website: input.website ? toOrigin(input.website) : null,
        email: input.email?.trim() || null,
        campaignId: input.campaignId || null,
        source: "manual",
      },
    });
  }, "/leads");
}

export async function updateLead(
  leadId: string,
  data: Partial<{
    name: string;
    email: string | null;
    phone: string | null;
    linkedinUrl: string | null;
    status: LeadStatus;
    campaignId: string | null;
  }>,
) {
  return wrap(async () => {
    await prisma.lead.update({ where: { id: leadId }, data });
  }, "/leads", `/leads/${leadId}`);
}

export async function deleteLeads(ids: string[]) {
  return wrap(async () => {
    const { count } = await prisma.lead.deleteMany({ where: { id: { in: ids } } });
    return `Smazáno ${count} leadů`;
  }, "/leads");
}

// ---------------------------------------------------------------- Messages & outreach

export async function updateMessage(messageId: string, data: { subject?: string | null; content?: string }) {
  return wrap(async () => {
    const msg = await prisma.message.findUniqueOrThrow({ where: { id: messageId } });
    if (msg.status === "SENT") throw new Error("Odeslanou zprávu už nejde upravit");
    await prisma.message.update({ where: { id: messageId }, data });
  }, "/leads");
}

export async function queueLeadAction(leadId: string) {
  return wrap(async () => {
    const count = await queueLeadSequence(leadId);
    return `${count} e-mailů zařazeno do fronty`;
  }, `/leads/${leadId}`, "/inbox");
}

export async function markLinkedinSent(messageId: string) {
  return wrap(async () => {
    const msg = await prisma.message.update({
      where: { id: messageId },
      data: { status: "SENT", sentAt: new Date() },
      include: { lead: true },
    });
    if (msg.lead.status === "NEW" || msg.lead.status === "RESEARCHED") {
      await prisma.lead.update({ where: { id: msg.leadId }, data: { status: "CONTACTED" } });
    }
  }, "/leads", "/inbox");
}

export async function runQueueNow() {
  return wrap(async () => {
    // Odesílání s rozestupy může trvat dlouho → běží na pozadí
    void processQueue();
    return "Odesílání fronty spuštěno na pozadí (sleduj log serveru)";
  }, "/inbox");
}

export async function syncInboxNow() {
  return wrap(async () => {
    const { imported } = await syncInbox();
    return `Načteno ${imported} nových odpovědí`;
  }, "/inbox", "/leads");
}

// ---------------------------------------------------------------- Campaigns

export async function saveCampaign(input: {
  id?: string;
  name: string;
  systemPrompt: string;
  channels: Channel[];
  status: CampaignStatus;
  senderName?: string;
  followUpDelayDays: number;
}) {
  return wrap(async () => {
    if (!input.name.trim() || !input.systemPrompt.trim()) throw new Error("Vyplň název a popis nabídky");
    const data = {
      name: input.name.trim(),
      systemPrompt: input.systemPrompt.trim(),
      channels: input.channels.length ? input.channels : (["EMAIL"] as Channel[]),
      status: input.status,
      senderName: input.senderName?.trim() || null,
      followUpDelayDays: Math.max(1, input.followUpDelayDays || 3),
    };
    if (input.id) await prisma.campaign.update({ where: { id: input.id }, data });
    else await prisma.campaign.create({ data });
  }, "/campaigns");
}
