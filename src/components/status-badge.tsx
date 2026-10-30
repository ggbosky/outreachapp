import type { LeadStatus, Sentiment } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { leadStatusClass, leadStatusLabel, sentimentClass, sentimentLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <Badge className={cn("border-0", leadStatusClass[status])}>{leadStatusLabel[status]}</Badge>;
}

export function SentimentBadge({ sentiment }: { sentiment: Sentiment | null }) {
  if (!sentiment) return null;
  return <Badge className={cn("border-0", sentimentClass[sentiment])}>{sentimentLabel[sentiment]}</Badge>;
}
