import type { LeadStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { LeadsTable } from "@/components/leads/leads-table";
import { NewLeadDialog } from "@/components/leads/new-lead-dialog";
import { LEAD_STATUSES } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; campaign?: string }>;
}) {
  const { status, q, campaign } = await searchParams;
  const where: Prisma.LeadWhereInput = {};
  if (status && (LEAD_STATUSES as string[]).includes(status)) where.status = status as LeadStatus;
  if (campaign) where.campaignId = campaign;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { website: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { keyword: { contains: q, mode: "insensitive" } },
    ];
  }

  const [leads, campaigns, counts] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        name: true,
        website: true,
        email: true,
        phone: true,
        status: true,
        sentiment: true,
        source: true,
        keyword: true,
        scrapedAt: true,
        researchedAt: true,
        createdAt: true,
        campaign: { select: { name: true } },
      },
    }),
    prisma.campaign.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "desc" } }),
    prisma.lead.groupBy({ by: ["status"], _count: true }),
  ]);

  return (
    <>
      <PageHeader title="Leady" description="Všechny firmy v pipeline – scraping a AI research na jedno kliknutí">
        <NewLeadDialog campaigns={campaigns} />
      </PageHeader>
      <LeadsTable
        leads={leads}
        counts={Object.fromEntries(counts.map((c) => [c.status, c._count]))}
        campaigns={campaigns}
        filters={{ status: status ?? "", q: q ?? "", campaign: campaign ?? "" }}
      />
    </>
  );
}
