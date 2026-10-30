import { config } from "@/lib/config";

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Domény, které nejsou weby firem (katalogy, sociální sítě, vyhledávače…). */
const NON_COMPANY_DOMAINS = [
  "facebook.com", "instagram.com", "linkedin.com", "twitter.com", "x.com", "youtube.com",
  "tiktok.com", "pinterest.com", "wikipedia.org", "google.com", "google.cz", "seznam.cz",
  "mapy.cz", "mapy.com", "firmy.cz", "zlatestranky.cz", "najisto.centrum.cz", "kurzy.cz",
  "rejstrik-firem.kurzy.cz", "or.justice.cz", "justice.cz", "ares.gov.cz", "podnikatel.cz",
  "idnes.cz", "novinky.cz", "denik.cz", "heureka.cz", "zbozi.cz", "edb.cz", "infobel.com",
  "cylex.cz", "firmo.cz", "duckduckgo.com", "bing.com", "yelp.com", "tripadvisor.com",
  "tripadvisor.cz", "booking.com", "jobs.cz", "prace.cz", "startupjobs.cz", "hlidacstatu.cz",
  "rejstrik.penize.cz", "detail.cz", "merk.cz", "bizzbizz.cz", "apple.com", "amazon.com",
];

export function normalizeUrl(input: string): string | null {
  try {
    const url = new URL(input.startsWith("http") ? input : `https://${input}`);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

/** Kořen webu (https://www.firma.cz) – používá se jako unikátní klíč leadu. */
export function toOrigin(input: string): string | null {
  const normalized = normalizeUrl(input);
  return normalized ? new URL(normalized).origin : null;
}

export function hostnameOf(input: string): string {
  try {
    return new URL(input).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function isCompanyWebsite(url: string): boolean {
  const host = hostnameOf(url);
  if (!host) return false;
  return !NON_COMPANY_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

/** Stáhne HTML přes obyčejný HTTP požadavek (rychlá cesta bez prohlížeče). */
export async function fetchHtml(url: string): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": config.scraper.userAgent,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "cs-CZ,cs;q=0.9,en;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(config.scraper.timeoutMs),
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "";
    if (!type.includes("html")) return null;
    return { html: await res.text(), finalUrl: res.url || url };
  } catch {
    return null;
  }
}
