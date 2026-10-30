import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { CampaignForm } from "@/components/campaigns/campaign-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { leads: true } } },
  });
  const stats = await prisma.message.groupBy({
    by: ["campaignId", "direction", "status"],
    _count: true,
  });
  const stat = (id: string, direction: string, status?: string) =>
    stats
      .filter((s) => s.campaignId === id && s.direction === direction && (!status || s.status === status))
      .reduce((sum, s) => sum + s._count, 0);

  return (
    <>
      <PageHeader title="Kampaně" description="Popis tvé nabídky, tón a kanály – Claude z toho vychází při researchi i psaní zpráv">
        <CampaignForm />
      </PageHeader>

      {campaigns.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Zatím žádná kampaň. Vytvoř první – popiš, co nabízíš, komu a jakým tónem chceš psát.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {campaigns.map((c) => {
          const sent = stat(c.id, "OUTBOUND", "SENT");
          const replies = stat(c.id, "INBOUND");
          return (
            <Card key={c.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle>{c.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={c.status === "ACTIVE" ? "default" : "secondary"}>{c.status}</Badge>
                    <CampaignForm campaign={c} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {c.channels.map((ch) => (
                    <Badge key={ch} variant="outline">
                      {ch}
                    </Badge>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="line-clamp-4 text-sm whitespace-pre-wrap text-muted-foreground">{c.systemPrompt}</p>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <Stat label="Leady" value={c._count.leads} href={`/leads?campaign=${c.id}`} />
                  <Stat label="Ve frontě" value={stat(c.id, "OUTBOUND", "QUEUED")} />
                  <Stat label="Odesláno" value={sent} />
                  <Stat label="Odpovědi" value={replies} hint={sent ? `${Math.round((replies / sent) * 100)} %` : undefined} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}

function Stat({ label, value, hint, href }: { label: string; value: number; hint?: string; href?: string }) {
  const inner = (
    <div className="rounded-md border p-2">
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">
        {label}
        {hint && ` · ${hint}`}
      </div>
    </div>
  );
  return href ? <Link href={href} className="hover:opacity-80">{inner}</Link> : inner;
}
