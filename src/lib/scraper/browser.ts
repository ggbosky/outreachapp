import type { Browser, BrowserContext } from "playwright";
import { config } from "@/lib/config";

// Sdílená instance Chromia – spouští se líně a zavírá se po dokončení jobu.
let browserPromise: Promise<Browser> | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = import("playwright").then(({ chromium }) =>
      chromium.launch({
        headless: config.scraper.headless,
        executablePath: config.scraper.chromiumPath,
      }),
    );
    browserPromise.catch(() => {
      browserPromise = null;
    });
  }
  return browserPromise;
}

export async function newContext(): Promise<BrowserContext> {
  const browser = await getBrowser();
  return browser.newContext({
    userAgent: config.scraper.userAgent,
    locale: "cs-CZ",
    viewport: { width: 1366, height: 900 },
  });
}

/** Vykreslí stránku v Chromiu a vrátí finální HTML (pro weby renderované JavaScriptem). */
export async function renderPage(url: string): Promise<{ html: string; finalUrl: string }> {
  const context = await newContext();
  try {
    const page = await context.newPage();
    // Obrázky, fonty a média nepotřebujeme – zrychlí to načítání
    await page.route("**/*", (route) => {
      const type = route.request().resourceType();
      return ["image", "media", "font"].includes(type) ? route.abort() : route.continue();
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: config.scraper.timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
    return { html: await page.content(), finalUrl: page.url() };
  } finally {
    await context.close();
  }
}

export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return;
  const browser = await browserPromise.catch(() => null);
  browserPromise = null;
  await browser?.close();
}
