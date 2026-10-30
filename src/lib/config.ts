// Centrální konfigurace z .env (viz .env.example)

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return ["1", "true", "yes"].includes(raw.toLowerCase());
}

export const config = {
  ai: {
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
    // Server-side fallback při odmítnutí (refusal) – funguje jen na přímém Claude API
    useFallbacks: bool("ANTHROPIC_FALLBACKS", true),
  },
  scraper: {
    userAgent:
      process.env.SCRAPER_USER_AGENT ||
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    headless: bool("SCRAPER_HEADLESS", true),
    maxPagesPerSite: num("SCRAPER_MAX_PAGES", 6),
    maxContentChars: num("SCRAPER_MAX_CONTENT_CHARS", 40000),
    concurrency: num("SCRAPER_CONCURRENCY", 3),
    requestDelayMs: num("SCRAPER_REQUEST_DELAY_MS", 800),
    timeoutMs: num("SCRAPER_TIMEOUT_MS", 20000),
    chromiumPath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
  },
  email: {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: num("SMTP_PORT", 465),
    secure: bool("SMTP_SECURE", true),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || process.env.SMTP_USER || "",
    delayMinSeconds: num("EMAIL_DELAY_MIN_SECONDS", 90),
    delayMaxSeconds: num("EMAIL_DELAY_MAX_SECONDS", 240),
    dailyLimit: num("EMAIL_DAILY_LIMIT", 40),
    footer: process.env.EMAIL_FOOTER || "",
  },
  imap: {
    host: process.env.IMAP_HOST || "imap.gmail.com",
    port: num("IMAP_PORT", 993),
    secure: bool("IMAP_SECURE", true),
    user: process.env.IMAP_USER || process.env.SMTP_USER || "",
    pass: process.env.IMAP_PASS || process.env.SMTP_PASS || "",
    lookbackDays: num("IMAP_LOOKBACK_DAYS", 14),
  },
  worker: {
    intervalSeconds: num("WORKER_INTERVAL_SECONDS", 300),
  },
};
