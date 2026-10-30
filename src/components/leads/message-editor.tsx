"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Message } from "@prisma/client";
import { CheckIcon, CopyIcon, ExternalLinkIcon } from "lucide-react";
import { toast } from "sonner";
import { markLinkedinSent, updateMessage } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, messageStatusLabel } from "@/lib/labels";

export function MessageEditor({ message, title, linkedinUrl }: { message: Message; title: string; linkedinUrl?: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [subject, setSubject] = useState(message.subject ?? "");
  const [content, setContent] = useState(message.content);
  const editable = message.status !== "SENT";
  const dirty = subject !== (message.subject ?? "") || content !== message.content;
  const isLinkedin = message.channel === "LINKEDIN";

  const save = () =>
    start(async () => {
      const res = await updateMessage(message.id, { subject: isLinkedin ? message.subject : subject || null, content });
      if (res.ok) toast.success("Zpráva uložena");
      else toast.error(res.error);
      router.refresh();
    });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm">{title}</CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {message.scheduledAt && message.status === "QUEUED" && <span>plán: {formatDate(message.scheduledAt)}</span>}
            {message.sentAt && <span>odesláno: {formatDate(message.sentAt)}</span>}
            <Badge variant={message.status === "FAILED" ? "destructive" : "secondary"}>{messageStatusLabel[message.status]}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {!isLinkedin && (
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={!editable}
            placeholder={message.step > 0 ? "Prázdné = odpověď ve vlákně (Re: …)" : "Předmět"}
          />
        )}
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} disabled={!editable} rows={isLinkedin ? 4 : 9} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">
            {content.length} znaků{isLinkedin && message.step === 0 && content.length > 300 && " – LinkedIn povoluje max 300!"}
          </span>
          <div className="flex flex-wrap gap-2">
            {isLinkedin && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigator.clipboard.writeText(content).then(() => toast.success("Zkopírováno"))}
                >
                  <CopyIcon /> Kopírovat
                </Button>
                {linkedinUrl && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={linkedinUrl} target="_blank" rel="noreferrer">
                      <ExternalLinkIcon /> LinkedIn
                    </a>
                  </Button>
                )}
                {editable && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const res = await markLinkedinSent(message.id);
                        if (!res.ok) toast.error(res.error);
                        router.refresh();
                      })
                    }
                  >
                    <CheckIcon /> Označit jako odeslané
                  </Button>
                )}
              </>
            )}
            {editable && (
              <Button size="sm" disabled={!dirty || pending} onClick={save}>
                Uložit
              </Button>
            )}
          </div>
        </div>
        {message.error && <p className="text-xs text-destructive">{message.error}</p>}
      </CardContent>
    </Card>
  );
}
