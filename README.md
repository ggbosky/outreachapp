# Outreach CRM

Vícekanálová outreach aplikace a CRM: vyhledá firmy, projde jejich weby, nechá Clauda udělat hloubkový
výzkum a napsat personalizované zprávy (e-mail + 2 follow-upy + LinkedIn), odešle je přes vlastní SMTP
s rozestupy a stáhne odpovědi včetně AI analýzy sentimentu.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Shadcn UI · Supabase (PostgreSQL) + Prisma ·
Playwright + Cheerio · Nodemailer + ImapFlow · Anthropic SDK

## Spuštění online přes GitHub Codespaces (doporučeno pro vyzkoušení a úpravy)

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/ggbosky/outreachapp?ref=claude/kind-wozniak-f7cazb)

1. Klikni na tlačítko výše (nebo na GitHubu **Code → Codespaces → Create codespace** na větvi `claude/kind-wozniak-f7cazb`).
2. Počkej 3–5 minut. Codespace sám nainstaluje balíčky, Chromium a vlastní PostgreSQL databázi a spustí aplikaci.
3. Aplikace se otevře v nové záložce (případně záložka **PORTS** → port 3000 → ikona glóbu).
4. Kód upravuješ přímo v editoru v prohlížeči, změny se v aplikaci projeví hned.

**API klíče** (Anthropic, SMTP…) nastav jednou jako Codespaces secrets: GitHub → **Settings → Codespaces →
Secrets → New secret** (`ANTHROPIC_API_KEY`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`…) a povol je pro repozitář
`ggbosky/outreachapp`. Případně je dopiš do souboru `.env` přímo v Codespace.

> Codespace se po 30 minutách nečinnosti uspí (data zůstanou) a bezplatný tarif má 60 hodin běhu měsíčně.
> Pro trvalý provoz použij hosting níže.

## Trvalý hosting (Railway / Render / VPS)

Repozitář obsahuje `Dockerfile` (Node + Chromium pro scraper). Kontejner při startu vytvoří tabulky,
spustí worker (odesílání fronty + stahování odpovědí) a webovou aplikaci.

- **Railway:** New Project → *Deploy from GitHub repo* → vyber repozitář a větev → do *Variables* vlož hodnoty z `.env.example`
  (databáze ze Supabase, API klíče) → *Settings → Networking → Generate Domain*.
- **Render:** New → *Web Service* → repozitář → Runtime *Docker* → Environment variables jako výše. Kvůli Chromiu
  doporučuji tarif s aspoň 1 GB RAM.
- Proměnná `RUN_WORKER=false` vypne worker v kontejneru (pokud ho chceš pouštět zvlášť).

## Lokální spuštění

```bash
npm install
cp .env.example .env            # vyplň DATABASE_URL, DIRECT_URL, ANTHROPIC_API_KEY, SMTP_*
npm run playwright:install      # stáhne Chromium pro scraper (jednorázově)
npm run db:push                 # vytvoří tabulky v Supabase
npm run dev                     # http://localhost:3000
npm run worker                  # v druhém terminálu: odesílání fronty + stahování odpovědí
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
