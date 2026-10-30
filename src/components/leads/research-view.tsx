import type { ResearchResult } from "@/lib/ai/schemas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/labels";

export function ResearchView({ research, researchedAt }: { research: ResearchResult; researchedAt: Date | null }) {
  return (
    <div className="flex flex-col gap-4">
      <Card className="border-violet-300 bg-violet-50/50 dark:border-violet-900 dark:bg-violet-950/20">
        <CardHeader>
          <CardTitle className="text-sm text-violet-700 dark:text-violet-300">Icebreaker</CardTitle>
        </CardHeader>
        <CardContent className="text-base">{research.icebreaker}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Čemu se firma věnuje</CardTitle>
            <span className="text-sm font-medium tabular-nums">Fit {research.fit_score}/10</span>
          </div>
          <p className="text-xs text-muted-foreground">Výzkum {formatDate(researchedAt)}</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p>{research.company_summary}</p>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Zákazníci: </span>
            {research.target_customers}
          </p>
          {research.contact_person && (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Kontaktní osoba: </span>
              {research.contact_person.name} – {research.contact_person.role}
            </p>
          )}
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Proč fit: </span>
            {research.fit_reason}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <ListCard title="Služby" items={research.services} />
        <ListCard title="Přednosti" items={research.strengths} />
        <ListCard title="Slabá místa" items={research.weaknesses} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Příležitosti pro naši službu</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {research.opportunities.map((o, i) => (
            <div key={i} className="border-l-2 border-primary/40 pl-3 text-sm">
              <div className="font-medium">{o.title}</div>
              <p className="text-muted-foreground">{o.description}</p>
              <p className="mt-1">
                <span className="font-medium">Jak pomůžeme: </span>
                {o.how_we_help}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
          {items.map((i, idx) => (
            <li key={idx}>{i}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
