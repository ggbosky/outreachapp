import pLimit from "p-limit";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { config } from "@/lib/config";
import { closeBrowser } from "./browser";
import { crawlWebsite } from "./crawl";
import { resolveWebsite, searchSource, type Candidate, type SearchSource } from "./search";
import { hostnameOf } from "./utils";

async function log(jobId: string, line: string) {
  const stamped = `[${new Date().toLocaleTimeString("cs-CZ")}] ${line}`;
  console.log(`[scrape ${jobId}] ${line}`);
  await prisma.scrapeJob.update({ where: { id: jobId }, data: { log: { push: stamped } } });
}

/** Data z crawleru převedená na pole leadu. */
function crawlToLeadData(data: Awaited<ReturnType<typeof crawlWebsite>>) {
  return {
    emails: data.emails,
    phones: data.phones,
    email: data.emails[0] ?? null,
    phone: data.phones[0] ?? null,
    linkedinUrl: data.socials.linkedin ?? null,
    socials: data.socials as Prisma.InputJsonValue,
    scrapedContent: data.content,
    scrapedPages: data.pages,
    scrapedAt: new Date(),
  };
}

/** Znovu projde web jednoho leadu (tlačítko "Scrape web" v UI). */
export async function scrapeLead(leadId: string) {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  if (!lead.website) throw new Error("Lead nemá vyplněný web");
  try {
    const data = await crawlWebsite(lead.website);
    const fields = crawlToLeadData(data);
    return await prisma.lead.update({
      where: { id: leadId },
      data: {
        ...fields,
        // Ručně zadané kontakty nepřepisujeme
        email: lead.email ?? fields.email,
        phone: lead.phone ?? fields.phone,
        linkedinUrl: lead.linkedinUrl ?? fields.linkedinUrl,
      },
    });
  } finally {
    await closeBrowser();
  }
}

/** Spustí celý scrapovací job: vyhledání → dohledání webů → crawl → uložení leadů. */
export async function runScrapeJob(jobId: string) {
  const job = await prisma.scrapeJob.update({ where: { id: jobId }, data: { status: "RUNNING" } });
  const sources = job.sources as SearchSource[];

  try {
    // 1) Vyhledání kandidátů ve všech zvolených zdrojích
    const candidates: Candidate[] = [];
    for (const source of sources) {
      try {
        const found = await searchSource(source, {
          query: job.query,
          location: job.location ?? undefined,
          maxResults: job.maxResults,
          directoryUrl: source === "directory" ? job.query : undefined,
        });
        await log(jobId, `${source}: nalezeno ${found.length} kandidátů`);
        candidates.push(...found);
      } catch (err) {
        await log(jobId, `${source}: chyba – ${(err as Error).message}`);
      }
    }

    // 2) Deduplikace podle domény / IČO a vyřazení už existujících leadů
    const existing = await prisma.lead.findMany({ select: { website: true, ico: true } });
    const knownHosts = new Set(existing.map((l) => (l.website ? hostnameOf(l.website) : "")).filter(Boolean));
    const knownIcos = new Set(existing.map((l) => l.ico).filter(Boolean));
    const unique: Candidate[] = [];
    for (const c of candidates) {
      const host = c.website ? hostnameOf(c.website) : "";
      if ((host && knownHosts.has(host)) || (c.ico && knownIcos.has(c.ico))) continue;
      if (host) knownHosts.add(host);
      if (c.ico) knownIcos.add(c.ico);
      unique.push(c);
    }
    const selected = unique.slice(0, job.maxResults);
    await prisma.scrapeJob.update({ where: { id: jobId }, data: { found: selected.length } });
    await log(jobId, `Ke zpracování ${selected.length} nových firem`);

    // 3) Crawl webů (s omezenou paralelizací) a uložení
    const limit = pLimit(config.scraper.concurrency);
    let created = 0;
    await Promise.all(
      selected.map((c) =>
        limit(async () => {
          let website = c.website ?? null;
          if (!website) {
            website = await resolveWebsite(c);
            if (website && knownHostsHas(existing, website)) website = null;
          }

          let crawl: ReturnType<typeof crawlToLeadData> | null = null;
          if (website) {
            try {
              crawl = crawlToLeadData(await crawlWebsite(website));
            } catch (err) {
              await log(jobId, `${c.name}: web nešel načíst (${(err as Error).message})`);
            }
          }

          try {
            await prisma.lead.create({
              data: {
                name: c.source === "ares" ? c.name.replace(/\s+/g, " ").trim() : cleanName(c.name, website),
                website,
                ico: c.ico,
                address: c.address,
                industry: c.industry,
                source: c.source,
                keyword: job.query,
                ...(crawl ?? {}),
              },
            });
            created++;
            await prisma.scrapeJob.update({ where: { id: jobId }, data: { created } });
            await log(jobId, `✓ ${c.name}${website ? ` (${website})` : " (web nenalezen)"} – e-mailů: ${crawl?.emails.length ?? 0}`);
          } catch (err) {
            await log(jobId, `${c.name}: nepodařilo se uložit (${(err as Error).message.split("\n")[0]})`);
          }
        }),
      ),
    );

    await prisma.scrapeJob.update({
      where: { id: jobId },
      data: { status: "DONE", finishedAt: new Date() },
    });
    await log(jobId, `Hotovo – vytvořeno ${created} leadů`);
  } catch (err) {
    await prisma.scrapeJob.update({
      where: { id: jobId },
      data: { status: "FAILED", error: (err as Error).message, finishedAt: new Date() },
    });
  } finally {
    await closeBrowser();
  }
}

function knownHostsHas(existing: { website: string | null }[], website: string) {
  const host = hostnameOf(website);
  return existing.some((l) => l.website && hostnameOf(l.website) === host);
}

/** Titulky z vyhledávačů bývají "Firma s.r.o. | Účetnictví Brno" – necháme jen první část. */
function cleanName(name: string, website: string | null): string {
  const first = name.split(/\s[|–—-]\s/)[0].trim();
  return first || (website ? hostnameOf(website) : name);
}
