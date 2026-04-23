'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, FileSpreadsheet, Loader2, TriangleAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useImportJobsStore } from '@/store/importJobsStore';
import { importJobErrorsList, type ImportJob } from '@/lib/importExportApi';
import { ImportJobErrorsDialog } from '@/components/layout/ImportJobErrorsDialog';

function entityLabel(entity: 'contacts' | 'companies' | 'opportunities') {
  if (entity === 'contacts') return 'contactos';
  if (entity === 'companies') return 'empresas';
  return 'oportunidades';
}

export function ImportJobsPanel() {
  const jobs = useImportJobsStore((s) => s.jobs);
  const pollActiveJobs = useImportJobsStore((s) => s.pollActiveJobs);
  const dismissJob = useImportJobsStore((s) => s.dismissJob);
  const notified = useRef(new Set<string>());
  const [errorsModalJob, setErrorsModalJob] = useState<ImportJob | null>(null);

  const visibleJobs = useMemo(() => jobs.slice(0, 4), [jobs]);
  const activeCount = jobs.filter(
    (job) =>
      (job.status === 'queued' || job.status === 'running') &&
      !job.id.startsWith('mock-import-'),
  ).length;

  useEffect(() => {
    if (activeCount === 0) return;
    void pollActiveJobs();
    const timer = window.setInterval(() => {
      void pollActiveJobs();
    }, 1500);
    return () => window.clearInterval(timer);
  }, [activeCount, pollActiveJobs]);

  useEffect(() => {
    for (const job of jobs) {
      if (notified.current.has(job.id)) continue;
      if (job.status === 'completed') {
        notified.current.add(job.id);
        continue;
      }
      if (job.status === 'failed') {
        notified.current.add(job.id);
        toast.error(`Falló la importación de ${entityLabel(job.entity)}`, {
          description: job.errorMessage,
        });
      }
    }
  }, [jobs]);

  return (
    <>
      <ImportJobErrorsDialog
        open={errorsModalJob != null}
        job={errorsModalJob}
        onOpenChange={(o) => {
          if (!o) setErrorsModalJob(null);
        }}
      />
      {visibleJobs.length > 0 ? (
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3 md:bottom-6 md:right-6">
      {visibleJobs.map((job) => {
        const running = job.status === 'queued' || job.status === 'running';
        const completed = job.status === 'completed';
        const failed = job.status === 'failed';
        const errorRows = importJobErrorsList(job);
        const canOpenErrors = errorRows.length > 0;
        return (
          <Card key={job.id} className="pointer-events-auto border shadow-lg">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {running ? (
                    <Loader2 className="size-5 animate-spin text-primary" />
                  ) : completed ? (
                    <CheckCircle2 className="size-5 text-emerald-600" />
                  ) : (
                    <TriangleAlert className="size-5 text-destructive" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {running
                          ? `Importando ${entityLabel(job.entity)}`
                          : completed
                            ? `Importación completada`
                            : `Importación fallida`}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {job.filename || `Archivo de ${entityLabel(job.entity)}`}
                      </p>
                    </div>
                    {!running ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0"
                        onClick={() => {
                          if (errorsModalJob?.id === job.id) setErrorsModalJob(null);
                          dismissJob(job.id);
                        }}
                      >
                        <X className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FileSpreadsheet className="size-3.5" />
                    <span>
                      {job.processedRows} / {job.totalRows} filas
                    </span>
                    <span>·</span>
                    <span>{job.percent}%</span>
                  </div>
                </div>
              </div>

              <Progress value={job.percent} />

              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>Creadas: {job.created}</span>
                <span>Omitidas: {job.skipped}</span>
                <span>Errores: {job.errorCount}</span>
              </div>

              {failed && job.errorMessage ? (
                <p className="text-xs text-destructive">{job.errorMessage}</p>
              ) : null}

              {canOpenErrors ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={
                    failed
                      ? 'w-full border-destructive/50 text-destructive hover:bg-destructive/10'
                      : 'w-full border-amber-600/40 text-amber-900 hover:bg-amber-50 dark:border-amber-500/35 dark:text-amber-100 dark:hover:bg-amber-950/40'
                  }
                  onClick={() => setErrorsModalJob(job)}
                >
                  Ver errores ({errorRows.length})
                </Button>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
      </div>
      ) : null}
    </>
  );
}
