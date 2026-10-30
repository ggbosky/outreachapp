import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react";
import { prisma } from "@/lib/db";
import type { ResearchResult } from "@/lib/ai/schemas";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeadStatusBadge, SentimentBadge } from "@/components/status-badge";
import { LeadActions } from "@/components/leads/lead-actions";
import { LeadContactForm } from "@/components/leads/lead-contact-form";
import { MessageEditor } from "@/components/leads/message-editor";
import { ResearchView } from "@/components/leads/research-view";
import { formatDate, messageStatusLabel, stepLabel } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [lead, campaigns] = await Promise.all([
    prisma.lead.findUnique({
      where: { id },
      include: { campaign: true, messages: { orderBy: [{ createdAt: "asc" }] } },
    }),
    prisma.campaign.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "desc" } }),
  ]);
  if (!lead) notFound();

  const research = lead.researchNotes as ResearchResult | null;
  const outbound = lead.messages.filter((m) => m.direction === "OUTBOUND");
  const emailDrafts = outbound.filter((m) => m.channel === "EMAIL").sort((a, b) => a.step - b.step);
  const linkedin = outbound.filter((m) => m.channel === "LINKEDIN").sort((a, b) => a.step - b.step);
  const history = [...lead.messages]
    .filter((m) => m.direction === "INBOUND" || ["SENT", "FAILED", "QUEUED", "CANCELLED"].includes(m.status))
    .sort((a, b) => +(b.sentAt ?? b.scheduledAt ?? b.createdAt) - +(a.sentAt ?? a.scheduledAt ?? a.createdAt));
  const socials = (lead.socials ?? {}) as Record<string, string>;

  return (
    <>
      <Link href="/leads" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeftIcon className="size-4" /> Leady
      </Link>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{lead.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {lead.website && (
              <a href={lead.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                {lead.website.replace(/^https?:\/\//, "")} <ExternalLinkIcon className="size-3" />
              </a>
            )}
            {lead.ico && <span>IČO {lead.ico}</span>}
            <LeadStatusBadge status={lead.status} />
            <SentimentBadge sentiment={lead.sentiment} />
          </div>
        </div>
        <LeadActions
          lead={{
            id: lead.id,
            status: lead.status,
            campaignId: lead.campaignId,
            hasWebsite: Boolean(lead.website),
            hasContent: Boolean(lead.scrapedContent),
            hasResearch: Boolean(research),
            hasDrafts: emailDrafts.some((m) => ["DRAFT", "FAILED", "CANCELLED"].includes(m.status)),
            hasEmail: Boolean(lead.email),
          }}
          campaigns={campaigns}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Tabs defaultValue={research ? "research" : "data"}>
          <TabsList>
            <TabsTrigger value="research">AI výzkum</TabsTrigger>
            <TabsTrigger value="messages">Zprávy ({outbound.length})</TabsTrigger>
            <TabsTrigger value="data">Data webu</TabsTrigger>
            <TabsTrigger value="history">Historie ({history.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="research" className="mt-4">
            {research ? (
              <ResearchView research={research} researchedAt={lead.researchedAt} />
            ) : (
              <Empty text="Výzkum zatím neproběhl. Klikni na „AI research“." />
            )}
          </TabsContent>

          <TabsContent value="messages" className="mt-4 flex flex-col gap-4">
            {outbound.length === 0 && <Empty text="Žádné zprávy. Nejdřív spusť AI research – zprávy se vygenerují automaticky." />}
            {emailDrafts.map((m) => (
              <MessageEditor key={m.id} message={m} title={`E-mail · ${stepLabel(m.step)}`} />
            ))}
            {linkedin.map((m) => (
              <MessageEditor key={m.id} message={m} title={`LinkedIn · ${m.subject ?? ""}`} linkedinUrl={lead.linkedinUrl} />
            ))}
          </TabsContent>

          <TabsContent value="data" className="mt-4 flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Nalezené kontakty</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm sm:grid-cols-3">
                <ListBlock title="E-maily" items={lead.emails} />
                <ListBlock title="Telefony" items={lead.phones} />
                <div>
                  <div className="mb-1 font-medium">Sociální sítě</div>
                  {Object.keys(socials).length === 0 && <div className="text-muted-foreground">–</div>}
                  {Object.entries(socials).map(([k, v]) => (
                    <a key={k} href={v} target="_blank" rel="noreferrer" className="block truncate text-muted-foreground hover:underline">
                      {k}: {v.replace(/^https?:\/\/(www\.)?/, "")}
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Obsah webu</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Naskrapováno {formatDate(lead.scrapedAt)} · {lead.scrapedPages.length} stránek ·{" "}
                  {(lead.scrapedContent?.length ?? 0).toLocaleString("cs-CZ")} znaků
                </p>
              </CardHeader>
              <CardContent>
                <div className="mb-3 flex flex-wrap gap-1">
                  {lead.scrapedPages.map((p) => (
                    <a key={p} href={p} target="_blank" rel="noreferrer">
                      <Badge variant="outline">{new URL(p).pathname || "/"}</Badge>
                    </a>
                  ))}
                </div>
                <pre className="max-h-[480px] overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">
                  {lead.scrapedContent || "Web zatím nebyl naskrapován."}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-4 flex flex-col gap-3">
            {history.length === 0 && <Empty text="Zatím žádná komunikace." />}
            {history.map((m) => (
              <Card key={m.id} className={m.direction === "INBOUND" ? "border-amber-300 dark:border-amber-800" : undefined}>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{m.direction === "INBOUND" ? "← Příchozí" : `→ ${m.channel} · ${stepLabel(m.step)}`}</Badge>
                    <span>{messageStatusLabel[m.status]}</span>
                    <span>{formatDate(m.sentAt ?? m.scheduledAt)}</span>
                    <SentimentBadge sentiment={m.sentiment} />
                  </div>
                  {m.subject && <CardTitle className="text-sm">{m.subject}</CardTitle>}
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {m.summary && <p className="rounded-md bg-muted p-2 text-xs whitespace-pre-wrap">{m.summary}</p>}
                  <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                  {m.error && <p className="text-xs text-destructive">{m.error}</p>}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>

        <LeadContactForm
          lead={{
            id: lead.id,
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            linkedinUrl: lead.linkedinUrl,
            emails: lead.emails,
            address: lead.address,
            source: lead.source,
            keyword: lead.keyword,
            createdAt: lead.createdAt,
          }}
        />
      </div>
    </>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{text}</div>;
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="mb-1 font-medium">{title}</div>
      {items.length === 0 && <div className="text-muted-foreground">–</div>}
      {items.map((i) => (
        <div key={i} className="truncate text-muted-foreground">
          {i}
        </div>
      ))}
    </div>
  );
}
