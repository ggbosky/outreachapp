"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { createLead } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function NewLeadDialog({ campaigns }: { campaigns: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [campaignId, setCampaignId] = useState("");
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <PlusIcon /> Přidat lead
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nový lead</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          action={(fd) =>
            start(async () => {
              const res = await createLead({
                name: String(fd.get("name") || ""),
                website: String(fd.get("website") || ""),
                email: String(fd.get("email") || ""),
                campaignId,
              });
              if (!res.ok) return void toast.error(res.error);
              toast.success("Lead přidán");
              setOpen(false);
              router.refresh();
            })
          }
        >
          <div className="grid gap-2">
            <Label htmlFor="name">Název firmy</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="website">Web</Label>
            <Input id="website" name="website" placeholder="firma.cz" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" />
          </div>
          {campaigns.length > 0 && (
            <div className="grid gap-2">
              <Label>Kampaň</Label>
              <Select value={campaignId} onValueChange={setCampaignId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Vyber kampaň" />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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
