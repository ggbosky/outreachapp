"use client";

import { MailCheckIcon, SendIcon } from "lucide-react";
import { runQueueNow, syncInboxNow } from "@/app/actions";
import { ActionButton } from "@/components/action-button";

export function InboxActions({ smtpConfigured, delay, dailyLimit }: { smtpConfigured: boolean; delay: string; dailyLimit: number }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <ActionButton variant="outline" disabled={!smtpConfigured} action={syncInboxNow} pendingText="Stahuji odpovědi…">
          <MailCheckIcon /> Načíst odpovědi
        </ActionButton>
        <ActionButton disabled={!smtpConfigured} action={runQueueNow}>
          <SendIcon /> Odeslat frontu
        </ActionButton>
      </div>
      <p className="text-xs text-muted-foreground">
        {smtpConfigured ? `Rozestup ${delay} · limit ${dailyLimit} e-mailů/den` : "Nastav SMTP_* a IMAP_* v .env"}
      </p>
    </div>
  );
}
