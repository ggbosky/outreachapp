"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Campaign, CampaignStatus, Channel } from "@prisma/client";
import { PencilIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { saveCampaign } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const PROMPT_TEMPLATE = `Kdo jsem: …
Co nabízím: …
Pro koho (ideální zákazník): …
Hlavní přínosy / výsledky (čísla, reference): …
Cena / model spolupráce (volitelné): …
Výzva k akci: např. 15min nezávazný hovor
Tón: přátelský, věcný, tykání/vykání: …`;

export function CampaignForm({ campaign }: { campaign?: Campaign }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [channels, setChannels] = useState<Channel[]>(campaign?.channels ?? ["EMAIL", "LINKEDIN"]);
  const [status, setStatus] = useState<CampaignStatus>(campaign?.status ?? "ACTIVE");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {campaign ? (
          <Button size="icon-sm" variant="ghost" aria-label="Upravit kampaň">
            <PencilIcon />
          </Button>
        ) : (
          <Button>
            <PlusIcon /> Nová kampaň
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{campaign ? "Upravit kampaň" : "Nová kampaň"}</DialogTitle>
          <DialogDescription>Popis nabídky se posílá Claudovi jako kontext pro research i psaní zpráv.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          action={(fd) =>
            start(async () => {
              const res = await saveCampaign({
                id: campaign?.id,
                name: String(fd.get("name") || ""),
                systemPrompt: String(fd.get("systemPrompt") || ""),
                senderName: String(fd.get("senderName") || ""),
                followUpDelayDays: Number(fd.get("followUpDelayDays") || 3),
                channels,
                status,
              });
              if (!res.ok) return void toast.error(res.error);
              toast.success("Kampaň uložena");
              setOpen(false);
              router.refresh();
            })
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="name">Název</Label>
              <Input id="name" name="name" defaultValue={campaign?.name} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="senderName">Odesílatel (jméno, pozice)</Label>
              <Input id="senderName" name="senderName" defaultValue={campaign?.senderName ?? ""} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="systemPrompt">Popis nabídky / system prompt</Label>
            <Textarea
              id="systemPrompt"
              name="systemPrompt"
              rows={10}
              defaultValue={campaign?.systemPrompt ?? PROMPT_TEMPLATE}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label>Kanály</Label>
              {(["EMAIL", "LINKEDIN"] as Channel[]).map((ch) => (
                <label key={ch} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={channels.includes(ch)}
                    onCheckedChange={(v) => setChannels((prev) => (v ? [...prev, ch] : prev.filter((c) => c !== ch)))}
                  />
                  {ch === "EMAIL" ? "E-mail" : "LinkedIn"}
                </label>
              ))}
            </div>
            <div className="grid gap-1.5">
              <Label>Stav</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as CampaignStatus)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"] as CampaignStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="followUpDelayDays">Rozestup follow-upů (dny)</Label>
              <Input
                id="followUpDelayDays"
                name="followUpDelayDays"
                type="number"
                min={1}
                defaultValue={campaign?.followUpDelayDays ?? 3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Uložit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
