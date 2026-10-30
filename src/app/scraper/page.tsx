import { prisma } from "@/lib/db";
import { SEARCH_SOURCES } from "@/lib/scraper/search";
import { PageHeader } from "@/components/page-header";
import { ScrapeForm } from "@/components/scraper/scrape-form";
import { JobList } from "@/components/scraper/job-list";

export const dynamic = "force-dynamic";

export default async function ScraperPage() {
  const jobs = await prisma.scrapeJob.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
  const sources = SEARCH_SOURCES.map((s) => ({
    ...s,
    available: !s.needsKey || Boolean(process.env[s.needsKey]),
  }));

  return (
    <>
      <PageHeader
        title="Scraper"
        description="Vyhledá firmy podle oboru, projde jejich weby (O nás, Kontakt, patička) a uloží kontakty + obsah pro AI"
      />
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <ScrapeForm sources={sources} />
        <JobList jobs={jobs} />
      </div>
    </>
  );
}
