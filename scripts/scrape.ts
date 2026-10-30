/**
 * CLI scraper:  npm run scrape -- "účetní kancelář" --location Brno --sources ares,duckduckgo --max 20
 */
import { prisma } from "@/lib/db";
import { runScrapeJob } from "@/lib/scraper/pipeline";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const query = process.argv[2];
  if (!query || query.startsWith("--")) {
    console.error('Použití: npm run scrape -- "obor / klíčová slova" [--location Praha] [--sources ares,google_cse,brave,duckduckgo,directory] [--max 20]');
    process.exit(1);
  }
  const job = await prisma.scrapeJob.create({
    data: {
      query,
      location: arg("location") ?? null,
      sources: (arg("sources") ?? "ares,duckduckgo").split(","),
      maxResults: Number(arg("max") ?? 20),
    },
  });
  await runScrapeJob(job.id);
  const done = await prisma.scrapeJob.findUniqueOrThrow({ where: { id: job.id } });
  console.log(`\nStav: ${done.status}, nalezeno: ${done.found}, vytvořeno leadů: ${done.created}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
