"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, RadarIcon } from "lucide-react";
import { toast } from "sonner";
import { startScrapeJob } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ScrapeForm({
  sources,
}: {
  sources: { id: string; label: string; needsKey?: string; available: boolean }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<string[]>(sources.filter((s) => s.available && s.id !== "directory").map((s) => s.id));
  const isDirectory = selected.length === 1 && selected[0] === "directory";

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>Nové vyhledávání</CardTitle>
        <CardDescription>Bez placených scraperů – ARES, vyhledávače s bezplatným tarifem a odvětvové adresáře.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          action={(fd) =>
            start(async () => {
              const res = await startScrapeJob({
                query: String(fd.get("query") || ""),
                location: String(fd.get("location") || ""),
                maxResults: Number(fd.get("maxResults") || 20),
                sources: selected,
              });
              if (res.ok) toast.success(res.message ?? "Spuštěno");
              else toast.error(res.error);
              router.refresh();
            })
          }
        >
          <div className="grid gap-1.5">
            <Label htmlFor="query">{isDirectory ? "URL adresáře" : "Obor / klíčová slova"}</Label>
            <Input
              id="query"
              name="query"
              required
              placeholder={isDirectory ? "https://asociace.cz/clenove" : "např. účetní kancelář, stavební firma"}
            />
            <p className="text-xs text-muted-foreground">
              ARES hledá v obchodním názvu firmy – zadávej slova, která se v názvu typicky vyskytují (např. „účetnictví“, „stavby“).
            </p>
          </div>
          {!isDirectory && (
            <div className="grid gap-1.5">
              <Label htmlFor="location">Lokalita</Label>
              <Input id="location" name="location" placeholder="např. Brno" />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="maxResults">Max. počet firem</Label>
            <Input id="maxResults" name="maxResults" type="number" min={1} max={200} defaultValue={20} />
          </div>
          <div className="grid gap-2">
            <Label>Zdroje</Label>
            {sources.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selected.includes(s.id)}
                  disabled={!s.available}
                  onCheckedChange={(v) =>
                    setSelected((prev) => (v ? [...prev, s.id] : prev.filter((x) => x !== s.id)))
                  }
                />
                <span className={s.available ? undefined : "text-muted-foreground"}>
                  {s.label}
                  {!s.available && <span className="text-xs"> – chybí {s.needsKey}</span>}
                </span>
              </label>
            ))}
            {selected.includes("directory") && selected.length > 1 && (
              <p className="text-xs text-amber-600">Adresář spouštěj samostatně – do pole zadej jeho URL.</p>
            )}
          </div>
          <Button type="submit" disabled={pending || selected.length === 0}>
            {pending ? <Loader2Icon className="animate-spin" /> : <RadarIcon />} Spustit scraping
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
