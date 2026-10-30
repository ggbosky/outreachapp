import * as cheerio from "cheerio";
import { config } from "@/lib/config";
import { renderPage } from "./browser";
import { fetchHtml, hostnameOf, isCompanyWebsite, toOrigin } from "./utils";

export interface Candidate {
  name: string;
  website?: string;
  ico?: string;
  address?: string;
  industry?: string;
  source: SearchSource;
}

export type SearchSource = "ares" | "google_cse" | "brave" | "duckduckgo" | "directory";

export const SEARCH_SOURCES: { id: SearchSource; label: string; needsKey?: string }[] = [
  { id: "ares", label: "ARES (obchodní rejstřík)" },
  { id: "google_cse", label: "Google (Programmable Search API)", needsKey: "GOOGLE_CSE_KEY" },
  { id: "brave", label: "Brave Search API", needsKey: "BRAVE_API_KEY" },
  { id: "duckduckgo", label: "DuckDuckGo (best effort)" },
  { id: "directory", label: "Odvětvový adresář (URL)" },
];

export interface SearchParams {
  query: string;
  location?: string;
  maxResults: number;
  /** URL stránky adresáře (seznam členů asociace, katalog firem…) pro zdroj "directory" */
  directoryUrl?: string;
}

// ---------------------------------------------------------------------------
// ARES – oficiální bezplatné API Ministerstva financí (bez webu, ale s IČO a sídlem)
// ---------------------------------------------------------------------------
const ARES_URL = "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/vyhledat";

interface AresSubject {
  ico: string;
  obchodniJmeno: string;
  sidlo?: { textovaAdresa?: string };
  czNace?: string[];
  czNace2008?: string[];
  datumZaniku?: string;
}

async function searchAres({ query, location, maxResults }: SearchParams): Promise<Candidate[]> {
  const body: Record<string, unknown> = { obchodniJmeno: query, pocet: Math.min(maxResults, 100), start: 0 };
  if (location) body.sidlo = { textovaAdresa: location };

  const res = await fetch(ARES_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.scraper.timeoutMs),
  });
  const data = (await res.json()) as { ekonomickeSubjekty?: AresSubject[]; popis?: string };
  if (!res.ok) throw new Error(`ARES: ${data.popis || res.status}`);

  return (data.ekonomickeSubjekty || [])
    .filter((s) => !s.datumZaniku)
    .map((s) => ({
      name: s.obchodniJmeno,
      ico: s.ico,
      address: s.sidlo?.textovaAdresa,
      industry: (s.czNace2008 || s.czNace || []).join(", ") || undefined,
      source: "ares" as const,
    }));
}

// ---------------------------------------------------------------------------
// Google Programmable Search JSON API – 100 dotazů denně zdarma
// ---------------------------------------------------------------------------
async function searchGoogleCse({ query, location, maxResults }: SearchParams): Promise<Candidate[]> {
  const key = process.env.GOOGLE_CSE_KEY;
  const cx = process.env.GOOGLE_CSE_CX;
  if (!key || !cx) throw new Error("Chybí GOOGLE_CSE_KEY / GOOGLE_CSE_CX v .env");

  const q = [query, location].filter(Boolean).join(" ");
  const results: Candidate[] = [];
  for (let start = 1; start <= Math.min(maxResults, 100) && results.length < maxResults; start += 10) {
    const url = new URL("https://www.googleapis.com/customsearch/v1");
    url.search = new URLSearchParams({ key, cx, q, num: "10", start: String(start), gl: "cz", lr: "lang_cs" }).toString();
    const res = await fetch(url, { signal: AbortSignal.timeout(config.scraper.timeoutMs) });
    const data = (await res.json()) as { items?: { title: string; link: string }[]; error?: { message: string } };
    if (!res.ok) throw new Error(`Google CSE: ${data.error?.message || res.status}`);
    if (!data.items?.length) break;
    results.push(...data.items.map((i) => ({ name: i.title, website: i.link, source: "google_cse" as const })));
  }
  return results;
}

// ---------------------------------------------------------------------------
// Brave Search API – bezplatný tarif (~2 000 dotazů měsíčně)
// ---------------------------------------------------------------------------
async function searchBrave({ query, location, maxResults }: SearchParams): Promise<Candidate[]> {
  const token = process.env.BRAVE_API_KEY;
  if (!token) throw new Error("Chybí BRAVE_API_KEY v .env");

  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.search = new URLSearchParams({
    q: [query, location].filter(Boolean).join(" "),
    count: String(Math.min(maxResults, 20)),
    country: "CZ",
    search_lang: "cs",
  }).toString();
  const res = await fetch(url, {
    headers: { Accept: "application/json", "X-Subscription-Token": token },
    signal: AbortSignal.timeout(config.scraper.timeoutMs),
  });
  if (!res.ok) throw new Error(`Brave: HTTP ${res.status}`);
  const data = (await res.json()) as { web?: { results?: { title: string; url: string }[] } };
  return (data.web?.results || []).map((r) => ({ name: r.title, website: r.url, source: "brave" as const }));
}

// ---------------------------------------------------------------------------
// DuckDuckGo HTML – bez klíče, ale bez záruky. Pokud DDG požadavek odmítne
// (ochrana proti botům), zdroj skončí chybou – nijak ji neobcházíme.
// ---------------------------------------------------------------------------
async function searchDuckDuckGo({ query, location, maxResults }: SearchParams): Promise<Candidate[]> {
  const q = [query, location].filter(Boolean).join(" ");
  const page = await fetchHtml(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}&kl=cz-cs`);
  if (!page) throw new Error("DuckDuckGo neodpověděl – použij Google CSE / Brave / ARES");

  const $ = cheerio.load(page.html);
  const results: Candidate[] = [];
  $("a.result__a").each((_, el) => {
    const href = $(el).attr("href") || "";
    let target = href;
    try {
      const u = new URL(href, "https://duckduckgo.com");
      target = u.searchParams.get("uddg") || u.toString();
    } catch {
      return;
    }
    results.push({ name: $(el).text().trim(), website: target, source: "duckduckgo" });
  });
  if (results.length === 0) {
    throw new Error("DuckDuckGo nevrátil žádné výsledky (možná blokuje automatické dotazy)");
  }
  return results.slice(0, maxResults);
}

// ---------------------------------------------------------------------------
// Odvětvový adresář – libovolná stránka se seznamem firem (např. členové asociace).
// Vykreslí ji v Playwrightu a vezme odkazy mimo doménu adresáře.
// ---------------------------------------------------------------------------
async function searchDirectory({ directoryUrl, maxResults }: SearchParams): Promise<Candidate[]> {
  if (!directoryUrl) throw new Error("Pro zdroj 'directory' zadej URL adresáře");
  const { html, finalUrl } = await renderPage(directoryUrl);
  const $ = cheerio.load(html);
  const dirHost = hostnameOf(finalUrl);
  const results: Candidate[] = [];

  $("a[href]").each((_, el) => {
    try {
      const href = new URL($(el).attr("href") || "", finalUrl).toString();
      if (hostnameOf(href) === dirHost || !isCompanyWebsite(href)) return;
      const name = $(el).text().replace(/\s+/g, " ").trim() || hostnameOf(href);
      results.push({ name, website: href, source: "directory" });
    } catch {
      /* neplatný odkaz */
    }
  });
  return results.slice(0, maxResults);
}

const PROVIDERS: Record<SearchSource, (p: SearchParams) => Promise<Candidate[]>> = {
  ares: searchAres,
  google_cse: searchGoogleCse,
  brave: searchBrave,
  duckduckgo: searchDuckDuckGo,
  directory: searchDirectory,
};

export async function searchSource(source: SearchSource, params: SearchParams): Promise<Candidate[]> {
  const raw = await PROVIDERS[source](params);
  // Weby normalizujeme na kořen domény a vyřazujeme katalogy / sociální sítě
  return raw
    .map((c) => {
      if (!c.website) return c;
      const origin = isCompanyWebsite(c.website) ? toOrigin(c.website) : null;
      return { ...c, website: origin ?? undefined };
    })
    .filter((c) => c.website || c.ico);
}

/**
 * Pro firmy z ARES (bez webu) zkusí najít web přes nakonfigurovaný vyhledávač.
 * Vrací kořen webu nebo null.
 */
export async function resolveWebsite(candidate: Candidate): Promise<string | null> {
  const engines: SearchSource[] = [];
  if (process.env.GOOGLE_CSE_KEY && process.env.GOOGLE_CSE_CX) engines.push("google_cse");
  if (process.env.BRAVE_API_KEY) engines.push("brave");
  engines.push("duckduckgo");

  const nameWords = significantWords(candidate.name);
  for (const engine of engines) {
    try {
      const results = await searchSource(engine, {
        query: `"${candidate.name}"${candidate.ico ? ` ${candidate.ico}` : ""}`,
        maxResults: 5,
      });
      // Bereme jen výsledek, jehož doména obsahuje část názvu firmy – jinak riskujeme špatný web
      const match = results.find((r) => r.website && nameWords.some((w) => hostnameOf(r.website!).includes(w)));
      if (match?.website) return match.website;
    } catch {
      /* zkusíme další vyhledávač */
    }
  }
  return null;
}

function significantWords(name: string): string[] {
  const stop = new Set(["sro", "spol", "as", "vos", "ks", "zs", "group", "cz", "the", "and", "company"]);
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !stop.has(w));
}
