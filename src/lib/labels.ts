import type { LeadStatus, MessageStatus, Sentiment } from "@prisma/client";

export const LEAD_STATUSES: LeadStatus[] = ["NEW", "RESEARCHED", "CONTACTED", "REPLIED", "CONVERTED", "REJECTED"];

export const leadStatusLabel: Record<LeadStatus, string> = {
  NEW: "Nový",
  RESEARCHED: "Prozkoumaný",
  CONTACTED: "Osloven",
  REPLIED: "Odpověděl",
  CONVERTED: "Klient",
  REJECTED: "Odmítnut",
};

export const leadStatusClass: Record<LeadStatus, string> = {
  NEW: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  RESEARCHED: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  CONTACTED: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  REPLIED: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  CONVERTED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  REJECTED: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

export const sentimentLabel: Record<Sentiment, string> = {
  INTERESTED: "Zájem",
  NOT_INTERESTED: "Nezájem",
  PRICE_INQUIRY: "Dotaz na cenu",
  QUESTION: "Dotaz",
  NEUTRAL: "Neutrální",
};

export const sentimentClass: Record<Sentiment, string> = {
  INTERESTED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  NOT_INTERESTED: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  PRICE_INQUIRY: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  QUESTION: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  NEUTRAL: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
};

export const messageStatusLabel: Record<MessageStatus, string> = {
  DRAFT: "Koncept",
  QUEUED: "Ve frontě",
  SENT: "Odesláno",
  FAILED: "Chyba",
  CANCELLED: "Zrušeno",
  RECEIVED: "Přijato",
};

export const stepLabel = (step: number) => (step === 0 ? "Úvodní e-mail" : `Follow-up ${step}`);

export function formatDate(d: Date | string | null | undefined) {
  if (!d) return "–";
  return new Date(d).toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" });
}
