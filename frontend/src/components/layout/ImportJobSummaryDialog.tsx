'use client';

import {
  importJobErrorsList,
  type BulkImportRowAction,
  type BulkImportRowResult,
  type ImportJob,
} from '@/lib/importExportApi';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function entityLabel(entity: ImportJob['entity']) {
  if (entity === 'contacts') return 'contactos';
  if (entity === 'companies') return 'empresas';
  if (entity === 'flota-prospecto') return 'prospectos flota';
  return 'oportunidades';
}

function actionLabel(action: BulkImportRowAction): string {
  if (action === 'created') return 'Nueva';
  if (action === 'updated') return 'Actualizada';
  if (action === 'blocked') return 'Bloqueada';
  return 'Vinculada';
}

function actionBadgeClass(action: BulkImportRowAction): string {
  if (action === 'created') {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200';
  }
  if (action === 'updated') {
    return 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200';
  }
  if (action === 'blocked') {
    return 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200';
  }
  return 'bg-muted text-muted-foreground';
}

function RowDetailLists({ row }: { row: BulkImportRowResult }) {
  const changes = row.changes ?? [];
  const unchanged = row.unchanged ?? [];
  if (changes.length === 0 && unchanged.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">{row.detail}</p>
    );
  }
  return (
    <div className="space-y-2 text-xs">
      {changes.length > 0 ? (
        <div>
          <p className="mb-1 font-medium text-emerald-700 dark:text-emerald-300">
            Cambios
          </p>
          <ul className="list-inside list-disc space-y-0.5 text-foreground/90">
            {changes.map((item) => (
              <li key={item} className="break-words">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {unchanged.length > 0 ? (
        <div>
          <p className="mb-1 font-medium text-muted-foreground">
            Sin cambios
          </p>
          <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
            {unchanged.map((item) => (
              <li key={item} className="break-words">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export type ImportJobSummaryDialogProps = {
  job: ImportJob | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewErrors?: () => void;
};

export function ImportJobSummaryDialog({
  job,
  open,
  onOpenChange,
  onViewErrors,
}: ImportJobSummaryDialogProps) {
  const rows: BulkImportRowResult[] = job?.result?.rows ?? [];
  const errors = job ? importJobErrorsList(job) : [];
  const hasRows = rows.length > 0;
  const result = job?.result;
  const detailedRows = rows.some(
    (r) => (r.changes?.length ?? 0) > 0 || (r.unchanged?.length ?? 0) > 0,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="z-[220] flex max-h-[min(90vh,44rem)] w-[min(calc(100vw-2rem),56rem)] max-w-none flex-col gap-0 p-0 sm:max-w-none"
        overlayClassName="z-[219]"
      >
        <DialogHeader className="shrink-0 space-y-2 border-b px-6 py-4 text-left">
          <DialogTitle>Resumen de importación</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-left text-sm text-muted-foreground">
              {job ? (
                <>
                  <div>
                    <span className="font-medium text-foreground">
                      {job.filename ?? 'Archivo'}
                    </span>
                    <span> · {entityLabel(job.entity)}</span>
                  </div>
                  {result ? (
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                      <span>Procesadas: {result.processed}</span>
                      <span>Nuevas: {result.created}</span>
                      {result.updated > 0 ? (
                        <span>Actualizadas: {result.updated}</span>
                      ) : null}
                      {result.linked > 0 ? (
                        <span>Vinculadas: {result.linked}</span>
                      ) : null}
                      {result.blocked > 0 ? (
                        <span className="text-amber-800 dark:text-amber-200">
                          Bloqueadas: {result.blocked}
                        </span>
                      ) : null}
                      {result.skipped > 0 ? (
                        <span>Omitidas: {result.skipped}</span>
                      ) : null}
                      {errors.length > 0 ? (
                        <span className="text-destructive">
                          Errores: {errors.length}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </DialogDescription>
        </DialogHeader>

        {hasRows ? (
          <div className="min-h-0 flex-1 overflow-y-auto border-b">
            {detailedRows ? (
              <div className="divide-y">
                {rows.map((row) => (
                  <div
                    key={`${row.row}-${row.name}`}
                    className="space-y-2 px-4 py-3 sm:px-6"
                  >
                    <div className="flex flex-wrap items-start gap-2 gap-y-1">
                      <span className="tabular-nums text-xs text-muted-foreground">
                        Fila {row.row}
                      </span>
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium',
                          actionBadgeClass(row.action),
                        )}
                      >
                        {actionLabel(row.action)}
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
                        {row.name}
                      </span>
                      {job?.entity === 'companies' && row.contactoVista?.trim() ? (
                        <span className="text-xs text-muted-foreground">
                          Contacto: {row.contactoVista}
                        </span>
                      ) : null}
                    </div>
                    <RowDetailLists row={row} />
                  </div>
                ))}
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-xs font-medium text-muted-foreground">
                    <th className="w-14 shrink-0 px-4 py-2">Fila</th>
                    <th className="px-4 py-2">Empresa</th>
                    {job?.entity === 'companies' ? (
                      <th className="hidden px-4 py-2 sm:table-cell">Contacto</th>
                    ) : null}
                    <th className="w-28 px-4 py-2">Resultado</th>
                    <th className="px-4 py-2">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={`${row.row}-${row.name}`}
                      className="border-b border-border/60 align-top last:border-0"
                    >
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-muted-foreground">
                        {row.row}
                      </td>
                      <td className="max-w-[10rem] px-4 py-2.5 font-medium text-foreground">
                        <span className="line-clamp-2 break-words" title={row.name}>
                          {row.name}
                        </span>
                      </td>
                      {job?.entity === 'companies' ? (
                        <td className="hidden max-w-[9rem] px-4 py-2.5 text-muted-foreground sm:table-cell">
                          <span
                            className="line-clamp-2 break-words"
                            title={row.contactoVista}
                          >
                            {row.contactoVista?.trim() ? row.contactoVista : '—'}
                          </span>
                        </td>
                      ) : null}
                      <td className="px-4 py-2.5">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium',
                            actionBadgeClass(row.action),
                          )}
                        >
                          {actionLabel(row.action)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        <span className="break-words text-foreground/90">
                          {row.detail}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <p className="border-b px-6 py-8 text-center text-sm text-muted-foreground">
            No hay detalle fila por fila para esta importación.
          </p>
        )}

        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t px-6 py-3">
          {errors.length > 0 && onViewErrors ? (
            <Button type="button" variant="outline" onClick={onViewErrors}>
              Ver errores ({errors.length})
            </Button>
          ) : null}
          <Button type="button" variant="default" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
