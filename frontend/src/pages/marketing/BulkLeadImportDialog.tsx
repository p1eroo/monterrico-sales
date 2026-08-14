import { useEffect, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ImportInProgressDialog } from '@/components/shared/ImportInProgressDialog';
import { toast } from '@/lib/notify';
import { cn } from '@/lib/utils';
import {
  previewBulkLeadImport,
  sendBulkLeadImport,
  type BulkLeadImportPreview,
  type BulkLeadSelectParams,
} from '@/lib/marketingApi';
import {
  ComercialEntityPicker,
  type ComercialEntityType,
  type LeadImportTarget,
} from '@/pages/marketing/LeadImportForm';

function previewCell(v: string | undefined) {
  const t = (v ?? '').trim();
  if (t === '') {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className="block truncate" title={t}>
      {t}
    </span>
  );
}

export function BulkLeadImportDialog({
  open,
  target,
  selection,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  target: LeadImportTarget | null;
  selection: BulkLeadSelectParams;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  const [entity, setEntity] = useState<ComercialEntityType | null>(null);
  const [preview, setPreview] = useState<BulkLeadImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const choosingComercial = target === 'comercial' && !entity;

  useEffect(() => {
    if (!open) {
      setEntity(null);
      setPreview(null);
      setLoading(false);
      setImporting(false);
    }
  }, [open, target]);

  useEffect(() => {
    if (!open || !target) return;
    if (target === 'comercial' && !entity) return;
    let cancelled = false;
    setLoading(true);
    setPreview(null);
    void previewBulkLeadImport({
      ...selection,
      target,
      entity: entity === 'empresa' ? 'empresa' : 'contacto',
    })
      .then((data) => {
        if (!cancelled) setPreview(data);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : 'No se pudo generar la vista previa');
          onOpenChange(false);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // selection se congela al abrir el diálogo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target, entity]);

  const close = () => onOpenChange(false);

  const handleImport = async () => {
    if (!target || !preview || preview.okCount === 0) return;
    setImporting(true);
    try {
      const result = await sendBulkLeadImport({
        ...selection,
        target,
        entity: entity === 'empresa' ? 'empresa' : 'contacto',
      });
      const dest = target === 'flota' ? 'Flota' : 'Comercial';
      if (result.failed > 0) {
        toast.error(
          `${result.sent} importado(s) a ${dest} · ${result.failed} con error · ${result.skipped} omitido(s)`,
        );
      } else {
        toast.success(
          `${result.sent} lead(s) importado(s) a ${dest}${
            result.skipped ? ` · ${result.skipped} omitido(s)` : ''
          }`,
        );
      }
      onImported();
      close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al importar');
    } finally {
      setImporting(false);
    }
  };

  const title =
    target === 'flota'
      ? 'Vista previa · importar a Flota'
      : choosingComercial
        ? 'Enviar a Comercial'
        : entity === 'empresa'
          ? 'Vista previa · importar empresas'
          : 'Vista previa · importar contactos';

  return (
    <>
      <ImportInProgressDialog
        open={loading}
        title="Generando vista previa"
        description="Mapeando los leads seleccionados para revisar qué se va a importar."
        footerNote=""
      />
      <ImportInProgressDialog
        open={importing}
        title="Importando leads"
        description="Creando los registros en el destino. Puede tardar unos segundos."
      />
      <Dialog
        open={open && !loading && !importing}
        onOpenChange={(next) => {
          if (!next) close();
        }}
      >
        <DialogContent
          className={
            choosingComercial
              ? 'sm:max-w-md'
              : 'flex h-[min(92vh,880px)] max-h-[92vh] w-[min(96vw,calc(100vw-2rem))] max-w-[min(96vw,87.5rem)] flex-col gap-0 p-0 sm:max-w-[min(96vw,87.5rem)]'
          }
        >
          <DialogHeader
            className={cn(
              'text-left',
              !choosingComercial && 'shrink-0 space-y-1 border-b px-6 py-4',
            )}
          >
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="text-left">
              {choosingComercial
                ? 'Elige si los leads se crean como contactos o como empresas.'
                : preview ? (
                    <>
                      <span className="block">
                        {preview.okCount} fila(s) lista(s) · {preview.errorCount} con error
                        {preview.truncated
                          ? ' · se muestran las primeras 500'
                          : ''}
                        .
                      </span>
                      {preview.errorCount > 0 ? (
                        <span className="mt-2 block text-muted-foreground">
                          Las filas con error se omitirán durante la importación.
                        </span>
                      ) : null}
                    </>
                  ) : null}
            </DialogDescription>
          </DialogHeader>

          {choosingComercial ? (
            <ComercialEntityPicker
              onSelect={(next) => {
                if (next === 'oportunidad') return;
                setEntity(next);
              }}
            />
          ) : (
            <>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-3">
                {preview && preview.rows.length > 0 ? (
                  <div className="min-h-0 flex-1 overflow-auto rounded-md border">
                    <Table
                      containerClassName="overflow-visible"
                      className="w-max min-w-full text-sm"
                    >
                      <TableHeader className="sticky top-0 z-10">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="sticky left-0 z-20 w-12 min-w-12 whitespace-nowrap bg-background px-2 shadow-[2px_0_6px_-4px_rgba(0,0,0,0.25)]">
                            Fila
                          </TableHead>
                          <TableHead className="sticky left-12 z-20 w-[5.5rem] min-w-[5.5rem] whitespace-nowrap bg-background px-2 shadow-[2px_0_6px_-4px_rgba(0,0,0,0.25)]">
                            Estado
                          </TableHead>
                          {preview.columns.map((col) => (
                            <TableHead
                              key={col.key}
                              className="w-[8.5rem] min-w-[8.5rem] max-w-[8.5rem] align-bottom font-normal text-muted-foreground"
                            >
                              <span className="block truncate" title={col.label}>
                                {col.label}
                              </span>
                            </TableHead>
                          ))}
                          <TableHead className="w-[14rem] min-w-[14rem] max-w-[14rem] align-bottom">
                            Motivo / detalle
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.rows.map((row) => (
                          <TableRow key={row.leadId}>
                            <TableCell className="sticky left-0 z-10 bg-background px-2 align-top tabular-nums text-muted-foreground shadow-[2px_0_6px_-4px_rgba(0,0,0,0.2)]">
                              {row.row}
                            </TableCell>
                            <TableCell className="sticky left-12 z-10 bg-background px-2 align-top shadow-[2px_0_6px_-4px_rgba(0,0,0,0.2)]">
                              {row.ok ? (
                                <Badge
                                  variant="outline"
                                  className="border-emerald-200 bg-emerald-50 font-normal text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                                >
                                  OK
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="font-normal">
                                  Error
                                </Badge>
                              )}
                            </TableCell>
                            {preview.columns.map((col) => (
                              <TableCell
                                key={`${row.leadId}-${col.key}`}
                                className="w-[8.5rem] min-w-[8.5rem] max-w-[8.5rem] align-top text-xs"
                              >
                                {previewCell(row.columns[col.key])}
                              </TableCell>
                            ))}
                            <TableCell className="w-[14rem] min-w-[14rem] max-w-[14rem] align-top text-muted-foreground">
                              <span
                                className="block truncate"
                                title={row.ok ? undefined : row.error}
                              >
                                {row.ok ? previewCell(undefined) : (row.error ?? '—')}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : preview ? (
                  <p className="text-sm text-muted-foreground">No hay filas que mostrar.</p>
                ) : null}
              </div>
              <DialogFooter className="shrink-0 border-t px-6 py-4">
                <Button type="button" variant="outline" onClick={close}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={!preview || preview.okCount === 0}
                  onClick={() => void handleImport()}
                >
                  <Send className="size-4" />
                  Importar {preview ? `(${preview.okCount}/${preview.totalRows})` : ''}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
