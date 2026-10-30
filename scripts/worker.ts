/**
 * Worker pro odesílání fronty a stahování odpovědí:  npm run worker
 * Běží ve smyčce každých WORKER_INTERVAL_SECONDS (výchozí 300 s).
 */
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { processQueue } from "@/lib/email/queue";
import { syncInbox } from "@/lib/email/inbox";

const once = process.argv.includes("--once");

async function tick() {
  try {
    await syncInbox();
  } catch (err) {
    console.error("[inbox]", (err as Error).message);
  }
  try {
    await processQueue();
  } catch (err) {
    console.error("[queue]", (err as Error).message);
  }
}

async function main() {
  do {
    console.log(`[worker] ${new Date().toLocaleString("cs-CZ")} – běh`);
    await tick();
    if (!once) await new Promise((r) => setTimeout(r, config.worker.intervalSeconds * 1000));
  } while (!once);
  await prisma.$disconnect();
}

main();
