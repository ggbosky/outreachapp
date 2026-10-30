import { config } from "@/lib/config";
import { renderPage } from "./browser";
import { extractPage, rankEmails, type PageData, type Socials } from "./extract";
import { fetchHtml, hostnameOf, normalizeUrl, sleep } from "./utils";

export interface WebsiteData {
  website: string;
  title: string;
  description: string;
  emails: string[];
  phones: string[];
  socials: Socials;
  pages: string[];
  content: string;
}

// Podstránky, kde bývají kontakty a informace o firmě
const INTERESTING_LINK =
  /(kontakt|contact|o-nas|onas|about|o-firme|o-spolecnosti|spolecnost|company|tym|team|lide|people|impressum|sluzby|services|reference|portfolio|cenik|pricing|kariera)/i;

const MIN_TEXT_FOR_STATIC = 400;

/** Načte stránku: nejdřív rychle přes HTTP + Cheerio, při prázdném obsahu přes Playwright. */
async function loadPage(url: string, allowBrowser = true): Promise<PageData | null> {
  const fetched = await fetchHtml(url);
  if (fetched) {
    const data = extractPage(fetched.html, fetched.finalUrl);
    if (data.text.length >= MIN_TEXT_FOR_STATIC || !allowBrowser) return data;
  }
  if (!allowBrowser) return null;
  try {
    const rendered = await renderPage(url);
    return extractPage(rendered.html, rendered.finalUrl);
  } catch {
    return fetched ? extractPage(fetched.html, fetched.finalUrl) : null;
  }
}

function pickSubpages(home: PageData, max: number): string[] {
  const host = hostnameOf(home.url);
  const seen = new Set<string>([home.url.replace(/\/$/, "")]);
  const scored: { url: string; score: number }[] = [];

  for (const { href, text } of home.links) {
    if (hostnameOf(href) !== host) continue;
    const clean = href.split("#")[0].replace(/\/$/, "");
    if (seen.has(clean) || /\.(pdf|jpe?g|png|zip|docx?)$/i.test(clean)) continue;
    seen.add(clean);
    const haystack = `${clean} ${text}`;
    if (!INTERESTING_LINK.test(haystack)) continue;
    const score = /kontakt|contact/i.test(haystack) ? 0 : /o-nas|about|o-firme|spolecnost/i.test(haystack) ? 1 : 2;
    scored.push({ url: clean, score });
  }
  return scored.sort((a, b) => a.score - b.score).slice(0, max).map((s) => s.url);
}

/** Projde web firmy (úvod + O nás / Kontakt / Služby…) a vrátí kontakty a text pro AI. */
export async function crawlWebsite(inputUrl: string): Promise<WebsiteData> {
  const start = normalizeUrl(inputUrl);
  if (!start) throw new Error(`Neplatná URL: ${inputUrl}`);

  const home = await loadPage(start);
  if (!home) throw new Error(`Web ${start} se nepodařilo načíst`);

  const pages: PageData[] = [home];
  for (const url of pickSubpages(home, config.scraper.maxPagesPerSite - 1)) {
    await sleep(config.scraper.requestDelayMs);
    const page = await loadPage(url);
    if (page) pages.push(page);
  }

  const website = new URL(home.url).origin;
  const emails = rankEmails([...new Set(pages.flatMap((p) => p.emails))], website);
  const phones = [...new Set(pages.flatMap((p) => p.phones))];
  const socials: Socials = Object.assign({}, ...pages.map((p) => p.socials).reverse());

  let content = "";
  for (const page of pages) {
    const section = `### ${page.url}\n${page.title}\n${page.description}\n${page.text}\n\n`;
    if (content.length + section.length > config.scraper.maxContentChars) {
      content += section.slice(0, Math.max(0, config.scraper.maxContentChars - content.length));
      break;
    }
    content += section;
  }

  return {
    website,
    title: home.title,
    description: home.description,
    emails,
    phones,
    socials,
    pages: pages.map((p) => p.url),
    content: content.trim(),
  };
}
