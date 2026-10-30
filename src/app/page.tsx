import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { SentimentBadge } from "@/components/status-badge";
import { LEAD_STATUSES, formatDate, leadStatusLabel } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [byStatus, sent, queued, replies, recentReplies, jobs] = await Promise.all([
    prisma.lead.groupBy({ by: ["status"], _count: true }),
    prisma.message.count({ where: { direction: "OUTBOUND", status: "SENT" } }),
    prisma.message.count({ where: { status: "QUEUED" } }),
    prisma.message.count({ where: { direction: "INBOUND" } }),
    prisma.message.findMany({
      where: { direction: "INBOUND" },
      include: { lead: true },
      orderBy: { sentAt: "desc" },
      take: 5,
    }),
    prisma.scrapeJob.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  const counts = Object.fromEntries(byStatus.map((s) => [s.status, s._count]));
  const totalLeads = byStatus.reduce((sum, s) => sum + s._count, 0);
  const replyRate = sent ? Math.round((replies / sent) * 100) : 0;

  const kpis = [
    { label: "Leady celkem", value: totalLeads },
    { label: "Odeslané zprávy", value: sent },
    { label: "Ve frontě", value: queued },
    { label: "Odpovědi", value: replies, hint: `${replyRate} % reply rate` },
  ];

  return (
    <>
      <PageHeader title="Přehled" description="Stav pipeline, odesílání a odpovědí" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader>
              <CardDescription>{k.label}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{k.value}</CardTitle>
              {k.hint && <p className="text-xs text-muted-foreground">{k.hint}</p>}
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {LEAD_STATUSES.map((s) => (
            <Link key={s} href={`/leads?status=${s}`} className="rounded-lg border p-3 transition-colors hover:bg-muted/50">
              <div className="text-2xl font-semibold tabular-nums">{counts[s] ?? 0}</div>
              <div className="text-xs text-muted-foreground">{leadStatusLabel[s]}</div>
            </Link>
          ))}
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Poslední odpovědi</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {recentReplies.length === 0 && <p className="text-sm text-muted-foreground">Zatím žádné odpovědi.</p>}
            {recentReplies.map((m) => (
              <Link key={m.id} href={`/leads/${m.leadId}`} className="flex items-start justify-between gap-3 rounded-md p-2 hover:bg-muted/50">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{m.lead.name}</div>
                  <div className="line-clamp-1 text-xs text-muted-foreground">{m.content}</div>
                </div>
                <SentimentBadge sentiment={m.sentiment} />
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Poslední scrapování</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {jobs.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Zatím žádné. <Link className="underline" href="/scraper">Spusť první scraping</Link>.
              </p>
            )}
            {jobs.map((j) => (
              <Link key={j.id} href="/scraper" className="flex items-center justify-between gap-3 rounded-md p-2 text-sm hover:bg-muted/50">
                <span className="truncate">
                  {j.query}
                  {j.location && <span className="text-muted-foreground"> · {j.location}</span>}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {j.status} · {j.created} leadů · {formatDate(j.createdAt)}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {totalLeads === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">
          Začni vytvořením <Link className="underline" href="/campaigns">kampaně</Link> s popisem své služby, pak spusť{" "}
          <Link className="underline" href="/scraper">scraper</Link>.
        </p>
      )}
    </>
  );
}
