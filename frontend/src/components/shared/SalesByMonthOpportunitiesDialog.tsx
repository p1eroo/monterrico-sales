import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { SalesByMonthTooltipRow } from '@/components/shared/SalesByMonthChartTooltip';

const PAGE_SIZE = 5;

type SalesByMonthOpportunitiesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: SalesByMonthTooltipRow | null;
  metaColorClass?: string;
};

export function SalesByMonthOpportunitiesDialog({
  open,
  onOpenChange,
  row,
  metaColorClass = 'text-[#64748b]',
}: SalesByMonthOpportunitiesDialogProps) {
  const [page, setPage] = useState(0);
  const opps = row?.oportunidadesGanadas ?? [];
  const totalPages = Math.max(1, Math.ceil(opps.length / PAGE_SIZE));
  const maxPage = totalPages - 1;
  const safePage = Math.max(0, Math.min(page, maxPage));
  const pageSlice = opps.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  useEffect(() => {
    if (open) setPage(0);
  }, [open, row?.name]);

  if (!row) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[min(90vh,640px)] max-w-md gap-0 overflow-hidden p-0 sm:max-w-md"
        showCloseButton
      >
        <DialogHeader className="space-y-1 border-b border-border px-4 py-3 text-left">
          <DialogTitle className="text-base">{row.name}</DialogTitle>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>
              <span className="text-[#13944C]">Ventas: </span>
              <span className="font-medium text-foreground">{formatCurrency(row.ventas)}</span>
            </span>
            <span>
              <span className={metaColorClass}>Meta: </span>
              <span className="font-medium text-foreground">{formatCurrency(row.meta)}</span>
            </span>
          </div>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col px-4">
          {opps.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No hay oportunidades ganadas listadas en este mes.
            </p>
          ) : (
            <>
              <p className="pt-2 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Oportunidades ganadas
              </p>
              <ul className="min-h-0 space-y-3 overflow-y-auto pr-1">
                {pageSlice.map((o) => (
                  <li
                    key={o.id}
                    className="border-b border-border/60 pb-3 last:border-0 last:pb-0"
                  >
                    <div className="font-medium leading-snug text-foreground">{o.title}</div>
                    {o.companyName ? (
                      <div className="text-xs text-muted-foreground">{o.companyName}</div>
                    ) : null}
                    <div className="text-xs font-medium tabular-nums text-[#13944C]">
                      {formatCurrency(o.amount)}
                    </div>
                  </li>
                ))}
              </ul>
              {opps.length > PAGE_SIZE ? (
                <div className="mt-2 flex items-center justify-between border-t border-border py-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={safePage < 1}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {safePage + 1} / {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={safePage >= totalPages - 1}
                    aria-label="Página siguiente"
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
