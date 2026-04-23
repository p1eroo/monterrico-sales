'use client';

import { importJobErrorsList, type ImportJob } from '@/lib/importExportApi';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

function entityLabel(entity: ImportJob['entity']) {
  if (entity === 'contacts') return 'contactos';
  if (entity === 'companies') return 'empresas';
  return 'oportunidades';
}

function nameColumnLabel(entity: ImportJob['entity']) {
  if (entity === 'companies') return 'Empresa / registro';
  if (entity === 'contacts') return 'Nombre';
  return 'Título';
}

export type ImportJobErrorsDialogProps = {
  job: ImportJob | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Lista detallada de errores por fila; no se cierra al hacer clic fuera (solo acciones explícitas).
 */
export function ImportJobErrorsDialog({ job, open, onOpenChange }: ImportJobErrorsDialogProps) {
  const errors = job ? importJobErrorsList(job) : [];
  const hasErrors = errors.length > 0;
  const isFailed = job?.status === 'failed';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="z-[220] flex max-h-[min(90vh,40rem)] w-[min(calc(100vw-2rem),42rem)] max-w-none flex-col gap-0 p-0 sm:max-w-none"
        overlayClassName="z-[219]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4 text-left">
          <DialogTitle>
            {isFailed ? 'Importación fallida' : 'Errores de importación'}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="text-left text-sm text-muted-foreground">
              {job ? (
                <>
                  <span className="font-medium text-foreground">{job.filename ?? 'Archivo'}</span>
                  <span> · {entityLabel(job.entity)}</span>
                  <span className="block pt-1">
                    {isFailed
                      ? 'El proceso no terminó correctamente. Revisa el detalle y corrige el archivo o la plantilla antes de volver a intentar.'
                      : `${errors.length} fila${errors.length === 1 ? '' : 's'} con error. Revisa el detalle y corrige el archivo si necesitas volver a importar.`}
                  </span>
                </>
              ) : null}
            </div>
          </DialogDescription>
        </DialogHeader>

        {hasErrors && job ? (
          <ScrollArea className="max-h-[min(55vh,28rem)] px-2">
            <div className="px-4 pb-2">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs font-medium text-muted-foreground">
                    <th className="py-2 pr-3 align-bottom">{nameColumnLabel(job.entity)}</th>
                    <th className="w-14 shrink-0 py-2 pr-2 align-bottom">Fila</th>
                    <th className="py-2 align-bottom">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.map((err, idx) => (
                    <tr
                      key={`${err.row}-${idx}`}
                      className="border-b border-border/60 align-top last:border-0"
                    >
                      <td className="max-w-[10rem] py-2.5 pr-3 font-medium text-foreground">
                        <span className="line-clamp-3 break-words" title={err.name}>
                          {err.name?.trim() ? err.name.trim() : '—'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-2 tabular-nums text-muted-foreground">
                        {err.row > 0 ? err.row : '—'}
                      </td>
                      <td className="py-2.5 text-muted-foreground">
                        <span className="break-words text-foreground/90">{err.message}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        ) : (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">No hay errores para mostrar.</p>
        )}

        <div className="flex shrink-0 justify-end border-t px-6 py-3">
          <Button type="button" variant="default" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
