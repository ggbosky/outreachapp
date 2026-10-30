"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { LeadStatus, Sentiment } from "@prisma/client";
import { BrainCircuitIcon, GlobeIcon, Loader2Icon, SearchIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { deleteLeads, researchLeadAction, scrapeLeadAction } from "@/app/actions";
import { ActionButton } from "@/components/action-button";
import { LeadStatusBadge, SentimentBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LEAD_STATUSES, formatDate, leadStatusLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";

export interface LeadRow {
  id: string;
  name: string;
  website: string | null;
  email: string | null;
  phone: string | null;
  status: LeadStatus;
  sentiment: Sentiment | null;
  source: string | null;
  keyword: string | null;
  scrapedAt: Date | null;
  researchedAt: Date | null;
  createdAt: Date;
  campaign: { name: string } | null;
}

export function LeadsTable({
  leads,
  counts,
  campaigns,
  filters,
}: {
  leads: LeadRow[];
  counts: Record<string, number>;
  campaigns: { id: string; name: string }[];
  filters: { status: string; q: string; campaign: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState(filters.q);
  const [bulkPending, startBulk] = useTransition();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
    setSelected(new Set());
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Hromadné akce běží postupně, aby se nepřetížil scraper ani API. */
  function runBulk(label: string, fn: (id: string) => Promise<{ ok: boolean; error?: string }>) {
    const ids = [...selected];
    startBulk(async () => {
      const toastId = toast.loading(`${label}: 0 / ${ids.length}`);
      let ok = 0;
      for (const [i, id] of ids.entries()) {
        const res = await fn(id);
        if (res.ok) ok++;
        else toast.error(`${leads.find((l) => l.id === id)?.name}: ${res.error}`);
        toast.loading(`${label}: ${i + 1} / ${ids.length}`, { id: toastId });
      }
      toast.success(`${label}: hotovo ${ok} / ${ids.length}`, { id: toastId });
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1">
        <StatusTab active={!filters.status} onClick={() => setFilter("status", "")} label="Vše" count={total} />
        {LEAD_STATUSES.map((s) => (
          <StatusTab
            key={s}
            active={filters.status === s}
            onClick={() => setFilter("status", s)}
            label={leadStatusLabel[s]}
            count={counts[s] ?? 0}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form
          className="relative w-full sm:w-72"
          onSubmit={(e) => {
            e.preventDefault();
            setFilter("q", query.trim());
          }}
        >
          <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Hledat název, web, e-mail…" className="pl-8" />
        </form>
        <Select value={filters.campaign || "all"} onValueChange={(v) => setFilter("campaign", v === "all" ? "" : v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Kampaň" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všechny kampaně</SelectItem>
            {campaigns.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <span className="text-sm text-muted-foreground">Vybráno {selected.size}</span>
            <Button size="sm" variant="outline" disabled={bulkPending} onClick={() => runBulk("Scraping", scrapeLeadAction)}>
              <GlobeIcon /> Scrape web
            </Button>
            <Button size="sm" disabled={bulkPending} onClick={() => runBulk("AI research", (id) => researchLeadAction(id))}>
              {bulkPending ? <Loader2Icon className="animate-spin" /> : <BrainCircuitIcon />} Research + zprávy
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={bulkPending}
              onClick={() => {
                if (!window.confirm(`Opravdu smazat ${selected.size} leadů?`)) return;
                startBulk(async () => {
                  const res = await deleteLeads([...selected]);
                  if (res.ok) toast.success(res.message ?? "Smazáno");
                  else toast.error(res.error);
                  setSelected(new Set());
                  router.refresh();
                });
              }}
            >
              <Trash2Icon />
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={leads.length > 0 && selected.size === leads.length}
                  onCheckedChange={(v) => setSelected(v ? new Set(leads.map((l) => l.id)) : new Set())}
                  aria-label="Vybrat vše"
                />
              </TableHead>
              <TableHead>Firma</TableHead>
              <TableHead>Kontakt</TableHead>
              <TableHead>Stav</TableHead>
              <TableHead className="hidden lg:table-cell">Kampaň</TableHead>
              <TableHead className="hidden lg:table-cell">Přidáno</TableHead>
              <TableHead className="text-right">Akce</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Žádné leady. Spusť scraper nebo přidej lead ručně.
                </TableCell>
              </TableRow>
            )}
            {leads.map((lead) => (
              <TableRow key={lead.id} data-state={selected.has(lead.id) ? "selected" : undefined}>
                <TableCell>
                  <Checkbox checked={selected.has(lead.id)} onCheckedChange={() => toggle(lead.id)} aria-label={`Vybrat ${lead.name}`} />
                </TableCell>
                <TableCell className="max-w-64">
                  <Link href={`/leads/${lead.id}`} className="block truncate font-medium hover:underline">
                    {lead.name}
                  </Link>
                  {lead.website && (
                    <a href={lead.website} target="_blank" rel="noreferrer" className="block truncate text-xs text-muted-foreground hover:underline">
                      {lead.website.replace(/^https?:\/\/(www\.)?/, "")}
                    </a>
                  )}
                </TableCell>
                <TableCell className="max-w-56 text-sm">
                  <div className="truncate">{lead.email ?? <span className="text-muted-foreground">bez e-mailu</span>}</div>
                  {lead.phone && <div className="text-xs text-muted-foreground">{lead.phone}</div>}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <LeadStatusBadge status={lead.status} />
                    <SentimentBadge sentiment={lead.sentiment} />
                  </div>
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">{lead.campaign?.name ?? "–"}</TableCell>
                <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                  {formatDate(lead.createdAt)}
                  {lead.source && <div>{lead.source}</div>}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <ActionButton
                            size="icon-sm"
                            variant="ghost"
                            disabled={!lead.website || bulkPending}
                            action={() => scrapeLeadAction(lead.id)}
                          >
                            <GlobeIcon className={cn(lead.scrapedAt && "text-emerald-600")} />
                          </ActionButton>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{lead.scrapedAt ? `Znovu projít web (naposledy ${formatDate(lead.scrapedAt)})` : "Projít web"}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <ActionButton
                            size="icon-sm"
                            variant="ghost"
                            disabled={(!lead.website && !lead.scrapedAt) || bulkPending}
                            action={() => researchLeadAction(lead.id)}
                          >
                            <BrainCircuitIcon className={cn(lead.researchedAt && "text-violet-600")} />
                          </ActionButton>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>AI research + vygenerovat zprávy</TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function StatusTab({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
      )}
    >
      {label} <span className="ml-1 tabular-nums opacity-70">{count}</span>
    </button>
  );
}
