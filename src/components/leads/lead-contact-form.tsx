"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateLead } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/labels";

export function LeadContactForm({
  lead,
}: {
  lead: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    linkedinUrl: string | null;
    emails: string[];
    address: string | null;
    source: string | null;
    keyword: string | null;
    createdAt: Date;
  };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState(lead.email ?? "");

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>Kontakt</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-3"
          action={(fd) =>
            start(async () => {
              const res = await updateLead(lead.id, {
                name: String(fd.get("name") || lead.name),
                email: email.trim() || null,
                phone: String(fd.get("phone") || "").trim() || null,
                linkedinUrl: String(fd.get("linkedinUrl") || "").trim() || null,
              });
              if (res.ok) toast.success("Uloženo");
              else toast.error(res.error);
              router.refresh();
            })
          }
        >
          <div className="grid gap-1.5">
            <Label htmlFor="name">Název</Label>
            <Input id="name" name="name" defaultValue={lead.name} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="email">E-mail pro outreach</Label>
            <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
            {lead.emails.length > 1 && (
              <div className="flex flex-wrap gap-1">
                {lead.emails.map((e) => (
                  <button
                    type="button"
                    key={e}
                    onClick={() => setEmail(e)}
                    className="rounded border px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="phone">Telefon</Label>
            <Input id="phone" name="phone" defaultValue={lead.phone ?? ""} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="linkedinUrl">LinkedIn</Label>
            <Input id="linkedinUrl" name="linkedinUrl" defaultValue={lead.linkedinUrl ?? ""} placeholder="https://linkedin.com/in/…" />
          </div>
          <Button type="submit" disabled={pending}>
            Uložit kontakt
          </Button>
        </form>
        <dl className="mt-4 space-y-1 text-xs text-muted-foreground">
          {lead.address && <div>Sídlo: {lead.address}</div>}
          {lead.source && <div>Zdroj: {lead.source}</div>}
          {lead.keyword && <div>Dotaz: {lead.keyword}</div>}
          <div>Přidáno: {formatDate(lead.createdAt)}</div>
        </dl>
      </CardContent>
    </Card>
  );
}
