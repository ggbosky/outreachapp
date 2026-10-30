import Link from "next/link";
import type { Prisma, Sentiment } from "@prisma/client";
import { prisma } from "@/lib/db";
import { config } from "@/lib/config";
import { PageHeader } from "@/components/page-header";
import { InboxActions } from "@/components/inbox/inbox-actions";
import { SentimentBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, messageStatusLabel, sentimentLabel, stepLabel } from "@/lib/labels";

export const dynamic = "force-dynamic";

const VIEWS = ["replies", "sent", "queued", "failed"] as const;
type View = (typeof VIEWS)[number];

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ view?: string; sentiment?: string }> }) {
  const params = await searchParams;
  const view: View = (VIEWS as readonly string[]).includes(params.view ?? "") ? (params.view as View) : "replies";
  const sentiment = params.sentiment && params.sentiment in sentimentLabel ? (params.sentiment as Sentiment) : undefined;

  const where: Prisma.MessageWhereInput =
    view === "replies"
      ? { direction: "INBOUND", ...(sentiment ? { sentiment } : {}) }
      : view === "sent"
        ? { direction: "OUTBOUND", status: "SENT" }
        : view === "queued"
          ? { status: "QUEUED" }
          : { status: "FAILED" };

  const [messages, counts, sentimentCounts] = await Promise.all([
    prisma.message.findMany({
      where,
      include: { lead: { select: { id: true, name: true, email: true } }, campaign: { select: { name: true } } },
      orderBy: view === "queued" ? { scheduledAt: "asc" } : { sentAt: "desc" },
      take: 200,
    }),
    Promise.all([
      prisma.message.count({ where: { direction: "INBOUND" } }),
      prisma.message.count({ where: { direction: "OUTBOUND", status: "SENT" } }),
      prisma.message.count({ where: { status: "QUEUED" } }),
      prisma.message.count({ where: { status: "FAILED" } }),
    ]),
    prisma.message.groupBy({ by: ["sentiment"], where: { direction: "INBOUND" }, _count: true }),
  ]);

  const labels: Record<View, string> = { replies: "Odpovědi", sent: "Odeslané", queued: "Fronta", failed: "Chyby" };

  return (
    <>
      <PageHeader title="Inbox" description="Odeslané zprávy, fronta a odpovědi s AI analýzou sentimentu">
        <InboxActions
          smtpConfigured={Boolean(config.email.user && config.email.pass)}
          delay={`${config.email.delayMinSeconds}–${config.email.delayMaxSeconds} s`}
          dailyLimit={config.email.dailyLimit}
        />
      </PageHeader>

      <Tabs value={view} className="mb-4">
        <TabsList>
          {VIEWS.map((v, i) => (
            <TabsTrigger key={v} value={v} asChild>
              <Link href={`/inbox?view=${v}`}>
                {labels[v]} <span className="ml-1 tabular-nums opacity-60">{counts[i]}</span>
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {view === "replies" && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Link href="/inbox?view=replies">
            <Badge variant={sentiment ? "outline" : "default"}>Vše</Badge>
          </Link>
          {(Object.keys(sentimentLabel) as Sentiment[]).map((s) => (
            <Link key={s} href={`/inbox?view=replies&sentiment=${s}`}>
              <Badge variant={sentiment === s ? "default" : "outline"}>
                {sentimentLabel[s]} {sentimentCounts.find((c) => c.sentiment === s)?._count ?? 0}
              </Badge>
            </Link>
          ))}
        </div>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lead</TableHead>
              <TableHead>Zpráva</TableHead>
              <TableHead>{view === "replies" ? "Sentiment" : "Krok"}</TableHead>
              <TableHead className="hidden md:table-cell">Kampaň</TableHead>
              <TableHead>{view === "queued" ? "Naplánováno" : "Datum"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {messages.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Nic tu není.
                </TableCell>
              </TableRow>
            )}
            {messages.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="max-w-48">
                  <Link href={`/leads/${m.lead.id}`} className="block truncate font-medium hover:underline">
                    {m.lead.name}
                  </Link>
                  <div className="truncate text-xs text-muted-foreground">{m.fromEmail ?? m.lead.email}</div>
                </TableCell>
                <TableCell className="max-w-md">
                  <div className="truncate text-sm font-medium">{m.subject ?? `(${m.channel})`}</div>
                  <div className="line-clamp-2 text-xs whitespace-normal text-muted-foreground">{m.summary?.split("\n")[0] ?? m.content}</div>
                  {m.error && <div className="text-xs text-destructive">{m.error}</div>}
                </TableCell>
                <TableCell>
                  {view === "replies" ? (
                    <SentimentBadge sentiment={m.sentiment} />
                  ) : (
                    <div className="text-xs">
                      <div>{m.channel === "EMAIL" ? stepLabel(m.step) : "LinkedIn"}</div>
                      <div className="text-muted-foreground">{messageStatusLabel[m.status]}</div>
                    </div>
                  )}
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{m.campaign?.name ?? "–"}</TableCell>
                <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                  {formatDate(view === "queued" ? m.scheduledAt : m.sentAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
