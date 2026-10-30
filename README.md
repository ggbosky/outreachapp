# Outreach CRM

Vícekanálová outreach aplikace a CRM: vyhledá firmy, projde jejich weby, nechá Clauda udělat hloubkový
výzkum a napsat personalizované zprávy (e-mail + 2 follow-upy + LinkedIn), odešle je přes vlastní SMTP
s rozestupy a stáhne odpovědi včetně AI analýzy sentimentu.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Shadcn UI · Supabase (PostgreSQL) + Prisma ·
Playwright + Cheerio · Nodemailer + ImapFlow · Anthropic SDK

## Rychlý start

```bash
npm install
cp .env.example .env            # vyplň DATABASE_URL, DIRECT_URL, ANTHROPIC_API_KEY, SMTP_*
npm run playwright:install      # stáhne Chromium pro scraper (jednorázově)
npm run db:push                 # vytvoří tabulky v Supabase
npm run dev                     # http://localhost:3000
```

V druhém terminálu spusť worker, který odesílá frontu a stahuje odpovědi:

```bash
npm run worker                  # smyčka každých WORKER_INTERVAL_SECONDS
```

### Supabase
1. Založ projekt na supabase.com.
2. **Project Settings → Database → Connection string**:
   - `DATABASE_URL` = *Transaction pooler* (port 6543) + `?pgbouncer=true&connection_limit=1`
   - `DIRECT_URL` = *Session pooler / direct* (port 5432) – používá se pro `prisma db push` / migrace

### Gmail
`SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_PASS` = **App Password**
(Google účet → Zabezpečení → Dvoufázové ověření → Hesla aplikací). Stejné údaje použije IMAP (`imap.gmail.com`).

## Doporučený postup práce
1. **Kampaně** → vytvoř kampaň a popiš svou službu, cílovku, přínosy a tón (Claude z toho vychází).
2. **Scraper** → zadej obor + lokalitu, vyber zdroje → vzniknou leady s kontakty a textem webu.
3. **Leady** → vyber leady → *Research + zprávy* (hromadně) nebo ikonka mozku u jednoho leadu.
4. **Detail leadu** → zkontroluj výzkum, uprav zprávy → *Odeslat sekvenci* (úvodní e-mail hned, follow-upy po N dnech).
5. **LinkedIn** zprávy zkopíruj a pošli ručně, pak *Označit jako odeslané*.
6. **Inbox** → odpovědi se spárují s leady, AI určí sentiment (Zájem / Nezájem / Dotaz na cenu / Dotaz / Neutrální)
   a follow-upy se u leadu automaticky zastaví.

## Zdroje firem (bez placených scraperů)

| Zdroj | Klíč | Poznámka |
|---|---|---|
| **ARES** | – | Oficiální API MF ČR. Hledá v obchodním názvu + sídle. Vrací IČO a adresu, web se dohledává vyhledávačem. |
| **Google Programmable Search** | `GOOGLE_CSE_KEY`, `GOOGLE_CSE_CX` | 100 dotazů/den zdarma. Nejspolehlivější cesta k webům firem. |
| **Brave Search API** | `BRAVE_API_KEY` | Bezplatný tarif. |
| **DuckDuckGo** | – | Best effort přes HTML verzi. Při blokaci automatických dotazů zdroj jen zahlásí chybu. |
| **Odvětvový adresář** | – | Zadáš URL stránky se seznamem firem (např. členové asociace), Playwright vezme odkazy na weby. |

Přímé scrapování výsledků Google není implementované záměrně: Google automatické dotazy blokuje (CAPTCHA)
a jeho podmínky to zakazují. Oficiální API je stabilnější.

**Crawler webu** (`src/lib/scraper/crawl.ts`): úvodní stránka + až 5 podstránek (Kontakt, O nás, Tým, Služby…),
nejdřív rychle přes `fetch` + Cheerio, u webů renderovaných JavaScriptem přes Playwright. Extrahuje e-maily
(vč. `mailto:`, Cloudflare ochrany a „[zavináč]“), telefony (CZ/SK), sociální sítě a text pro AI.

Scraping lze spustit i z terminálu:

```bash
npm run scrape -- "účetnictví" --location Brno --sources ares,google_cse --max 30
```

## AI
- Model: `ANTHROPIC_MODEL` (výchozí `claude-sonnet-5-5`, protože Claude 3.5 Sonnet už je vyřazený).
- Strukturované výstupy validované přes Zod (`src/lib/ai/schemas.ts`), takže se nic neparsuje ručně.
- `ANTHROPIC_FALLBACKS=true`: když model požadavek odmítne, server ho automaticky zopakuje na záložním modelu
  (beta `server-side-fallback`, funguje jen na přímém Claude API).
- Obsah webů se do promptu vkládá jako data třetí strany. Pokyny v něm model ignoruje (ochrana proti prompt injection).

## Ochrana proti spamu
- Náhodný rozestup mezi e-maily `EMAIL_DELAY_MIN_SECONDS`–`EMAIL_DELAY_MAX_SECONDS` a denní limit `EMAIL_DAILY_LIMIT`.
- Follow-upy jdou jako odpověď ve stejném vlákně (`In-Reply-To` / `References`).
- Leady ve stavu Odpověděl / Klient / Odmítnut automaticky nedostanou další zprávy.
- `EMAIL_FOOTER` se připojí ke každému e-mailu (možnost odhlášení).

> ⚖️ V ČR upravuje nevyžádaná obchodní sdělení e-mailem zákon č. 480/2004 Sb. (platí i pro B2B) a GDPR.
> Před ostrým rozesíláním si ověř, na jakém právním základě firmy oslovuješ.

## Struktura

```
prisma/schema.prisma        Leads, Campaigns, Messages, ScrapeJob
src/lib/scraper/            search.ts (zdroje) · crawl.ts · extract.ts · pipeline.ts · browser.ts
src/lib/ai/                 client.ts · research.ts (výzkum + generování zpráv) · sentiment.ts · schemas.ts
src/lib/email/              mailer.ts (Nodemailer) · queue.ts (fronta s rozestupy) · inbox.ts (IMAP)
src/app/actions/            server actions pro UI
src/app/                    / · /leads · /leads/[id] · /scraper · /campaigns · /inbox
scripts/                    scrape.ts (CLI) · worker.ts (odesílání + inbox)
```

Dlouhé úlohy (scraping, odesílání fronty) běží na pozadí Node procesu, takže aplikaci provozuj
jako běžný server (`npm run build && npm start`, VPS / Docker), ne na serverless. Na Vercelu použij pro tyto úlohy CLI skripty / worker.
