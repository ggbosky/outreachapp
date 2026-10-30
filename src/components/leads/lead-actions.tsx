"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LeadStatus } from "@prisma/client";
import { BrainCircuitIcon, GlobeIcon, SendIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { generateMessagesAction, queueLeadAction, researchLeadAction, scrapeLeadAction, updateLead } from "@/app/actions";
import { ActionButton } from "@/components/action-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LEAD_STATUSES, leadStatusLabel } from "@/lib/labels";

export function LeadActions({
  lead,
  campaigns,
}: {
  lead: {
    id: string;
    status: LeadStatus;
    campaignId: string | null;
    hasWebsite: boolean;
    hasContent: boolean;
    hasResearch: boolean;
    hasDrafts: boolean;
    hasEmail: boolean;
  };
  campaigns: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const update = (data: Parameters<typeof updateLead>[1]) =>
    start(async () => {
      const res = await updateLead(lead.id, data);
      if (!res.ok) toast.error(res.error);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-2 lg:items-end">
      <div className="flex flex-wrap gap-2">
        <Select value={lead.status} onValueChange={(v) => update({ status: v as LeadStatus })} disabled={pending}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEAD_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {leadStatusLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={lead.campaignId ?? "none"}
          onValueChange={(v) => update({ campaignId: v === "none" ? null : v })}
          disabled={pending}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Kampaň" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Bez kampaně</SelectItem>
            {campaigns.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap gap-2">
        <ActionButton variant="outline" disabled={!lead.hasWebsite} action={() => scrapeLeadAction(lead.id)} pendingText="Procházím web…">
          <GlobeIcon /> Scrape web
        </ActionButton>
        <ActionButton
          variant="outline"
          disabled={!lead.hasWebsite && !lead.hasContent}
          action={() => researchLeadAction(lead.id)}
          pendingText="Claude zkoumá…"
        >
          <BrainCircuitIcon /> AI research
        </ActionButton>
        <ActionButton
          variant="outline"
          disabled={!lead.hasResearch}
          action={() => generateMessagesAction(lead.id)}
          pendingText="Píšu zprávy…"
          confirm={lead.hasDrafts ? "Přegenerovat zprávy? Neodeslané koncepty se přepíšou." : undefined}
        >
          <SparklesIcon /> Přegenerovat zprávy
        </ActionButton>
        <ActionButton
          disabled={!lead.hasDrafts || !lead.hasEmail}
          action={() => queueLeadAction(lead.id)}
          confirm="Zařadit e-mail a follow-upy do fronty k odeslání?"
        >
          <SendIcon /> Odeslat sekvenci
        </ActionButton>
      </div>
    </div>
  );
}
