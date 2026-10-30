import * as cheerio from "cheerio";
import { hostnameOf } from "./utils";

export type Socials = Partial<Record<"linkedin" | "facebook" | "instagram" | "x" | "youtube" | "tiktok", string>>;

export interface PageData {
  url: string;
  title: string;
  description: string;
  text: string;
  emails: string[];
  phones: string[];
  socials: Socials;
  links: { href: string; text: string }[];
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
// České a slovenské formáty: +420 777 123 456, 00420777123456, 777 123 456, 777-123-456
const PHONE_RE = /(?:\+|00)?(?:420|421)?[\s.-]?\(?[1-9]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{3}\b/g;

const EMAIL_BLOCKLIST = [
  /\.(png|jpe?g|gif|svg|webp|avif)$/i,
  /@(example|domain|email|sentry|wixpress|sentry-next)\./i,
  /^(no-?reply|donotreply)@/i,
  /@\d+x\./i,
];

/** Dekóduje e-maily schované Cloudflare ochranou (data-cfemail). */
function decodeCfEmail(hex: string): string {
  const key = parseInt(hex.slice(0, 2), 16);
  let out = "";
  for (let i = 2; i < hex.length; i += 2) {
    out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
  }
  return out;
}

/** "info [zavináč] firma [tečka] cz" → "info@firma.cz" */
function deobfuscate(text: string): string {
  return text
    .replace(/\s*(\[|\()\s*(at|zavináč|zavinac)\s*(\]|\))\s*/gi, "@")
    .replace(/\s*(\[|\()\s*(dot|tečka|tecka)\s*(\]|\))\s*/gi, ".");
}

export function cleanEmails(list: string[]): string[] {
  const set = new Set<string>();
  for (const raw of list) {
    const email = raw.trim().toLowerCase().replace(/^mailto:/, "").split("?")[0];
    if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) continue;
    if (EMAIL_BLOCKLIST.some((re) => re.test(email))) continue;
    set.add(email);
  }
  return [...set];
}

export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/[^\d+]/g, "").replace(/^00/, "+");
  if (/^\d{9}$/.test(digits)) digits = `+420${digits}`;
  if (!/^\+42[01]\d{9}$/.test(digits)) return null;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 10)} ${digits.slice(10)}`;
}

function classifySocial(href: string): keyof Socials | null {
  const host = hostnameOf(href);
  if (host.endsWith("linkedin.com")) return "linkedin";
  if (host.endsWith("facebook.com")) return "facebook";
  if (host.endsWith("instagram.com")) return "instagram";
  if (host === "x.com" || host.endsWith("twitter.com")) return "x";
  if (host.endsWith("youtube.com")) return "youtube";
  if (host.endsWith("tiktok.com")) return "tiktok";
  return null;
}

export function extractPage(html: string, url: string): PageData {
  const $ = cheerio.load(html);

  const title = $("title").first().text().trim();
  const description = $('meta[name="description"]').attr("content")?.trim() || "";

  const rawEmails: string[] = [];
  const phones = new Set<string>();
  const socials: Socials = {};
  const links: { href: string; text: string }[] = [];

  $("[data-cfemail]").each((_, el) => {
    const hex = $(el).attr("data-cfemail");
    if (hex) rawEmails.push(decodeCfEmail(hex));
  });

  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") || "").trim();
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (href.startsWith("mailto:")) {
      rawEmails.push(decodeURIComponent(href));
      return;
    }
    if (href.startsWith("tel:")) {
      const phone = normalizePhone(decodeURIComponent(href.slice(4)));
      if (phone) phones.add(phone);
      return;
    }
    let absolute: string;
    try {
      absolute = new URL(href, url).toString();
    } catch {
      return;
    }
    const social = classifySocial(absolute);
    // U LinkedInu preferujeme firemní profil před osobním / sdílecími odkazy
    if (social && !absolute.includes("/share")) {
      if (!socials[social] || (social === "linkedin" && absolute.includes("/company/"))) {
        socials[social] = absolute;
      }
    }
    links.push({ href: absolute, text });
  });

  // Text stránky – bez skriptů, stylů a skrytých prvků. Patičku záměrně necháváme (kontakty).
  $("script, style, noscript, svg, iframe, template, [hidden], [aria-hidden='true']").remove();
  const blocks: string[] = [];
  $("h1, h2, h3, h4, h5, p, li, td, th, address, blockquote, dd, dt, div").each((_, el) => {
    const $el = $(el);
    // Bereme jen "listové" bloky, aby se text neduplikoval z vnořených elementů
    if ($el.children("h1,h2,h3,h4,p,li,td,div,section,article,ul,ol,table").length > 0) return;
    const t = spacedText($el.html());
    if (t.length > 1) blocks.push(t);
  });
  const text = dedupeLines(blocks).join("\n");

  const searchable = deobfuscate(`${text}\n${spacedText($("body").html() ?? $.html())}`);
  rawEmails.push(...(searchable.match(EMAIL_RE) || []));
  for (const m of text.match(PHONE_RE) || []) {
    const phone = normalizePhone(m);
    if (phone) phones.add(phone);
  }

  return {
    url,
    title,
    description,
    text,
    emails: cleanEmails(rawEmails),
    phones: [...phones],
    socials,
    links,
  };
}

/** Text elementu s mezerami mezi vnořenými prvky ("Ředitel<br>jan@firma.cz" → "Ředitel jan@firma.cz"). */
function spacedText(html: string | null): string {
  if (!html) return "";
  return cheerio
    .load(html.replace(/<[^>]+>/g, " "))
    .root()
    .text()
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeLines(lines: string[]): string[] {
  const seen = new Set<string>();
  return lines.filter((l) => (seen.has(l) ? false : (seen.add(l), true)));
}

/**
 * Seřadí e-maily pro outreach: osobní adresy na doméně firmy → obecné kontakty (info@, obchod@)
 * → provozní schránky (faktury@, podpora@, kariera@…) → cizí domény.
 */
export function rankEmails(emails: string[], website: string): string[] {
  const domain = hostnameOf(website);
  const generic = /^(info|kontakt|obchod|office|sales|hello|ahoj|recepce|sekretariat)@/;
  const operational =
    /^(faktur|fakturace|invoice|ucetn|accounting|hr|kariera|jobs|prace|gdpr|dpo|podpora|support|reklamace|servis|objednavky|orders|webmaster|admin)/;
  const score = (e: string) =>
    (domain && e.endsWith(`@${domain}`) ? 0 : 10) + (operational.test(e) ? 5 : generic.test(e) ? 1 : 0);
  return [...emails].sort((a, b) => score(a) - score(b));
}
