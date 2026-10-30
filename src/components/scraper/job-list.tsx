"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ScrapeJob } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/labels";

const statusVariant = {
  PENDING: "secondary",
  RUNNING: "default",
  DONE: "outline",
  FAILED: "destructive",
} as const;

export function JobList({ jobs }: { jobs: ScrapeJob[] }) {
  const router = useRouter();
  const running = jobs.some((j) => j.status === "RUNNING" || j.status === "PENDING");

  // Dokud nějaký job běží, obnovujeme stránku každé 3 s
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(t);
  }, [running, router]);

  if (jobs.length === 0) {
    return <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Zatím žádné scrapovací joby.</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      {jobs.map((job) => (
        <Card key={job.id}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-sm">
                {job.query}
                {job.location && <span className="text-muted-foreground"> · {job.location}</span>}
              </CardTitle>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{formatDate(job.createdAt)}</span>
                <Badge variant={statusVariant[job.status]}>{job.status}</Badge>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {job.sources.join(", ")} · nalezeno {job.found} · vytvořeno {job.created} leadů
            </p>
          </CardHeader>
          {(job.log.length > 0 || job.error) && (
            <CardContent>
              <pre className="max-h-48 overflow-auto rounded-md bg-muted p-2 text-xs whitespace-pre-wrap">
                {[...job.log].reverse().join("\n")}
                {job.error && `\nCHYBA: ${job.error}`}
              </pre>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}
