import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';

export type SalesByMonthTooltipRow = {
  name: string;
  ventas: number;
  meta: number;
  oportunidadesGanadas?: {
    id: string;
    title: string;
    amount: number;
    companyName: string | null;
  }[];
};

type PayloadItem = {
  payload?: SalesByMonthTooltipRow;
  name?: string;
  value?: number;
  color?: string;
};

/** Props que Recharts pasa al `content` del Tooltip (tipos genéricos de Recharts omiten payload/label). */
type SalesByMonthChartTooltipProps = {
  active?: boolean;
  payload?: readonly PayloadItem[] | PayloadItem[];
  label?: string | number;
  className?: string;
};

export function SalesByMonthChartTooltip({
  active,
  payload,
  label,
  className,
}: SalesByMonthChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const items = payload as PayloadItem[];
  const row = items[0]?.payload;
  if (!row) return null;

  const ventas = row.ventas;
  const meta = row.meta;
  const oppsCount = row.oportunidadesGanadas?.length ?? 0;

  return (
    <div
      className={cn(
        'max-w-xs rounded-lg border bg-background px-3 py-2.5 text-xs shadow-md',
        className,
      )}
    >
      <p className="mb-2 font-medium text-foreground">{label}</p>
      <div className="space-y-1.5 text-muted-foreground">
        <div className="flex justify-between gap-4">
          <span className="text-[#13944C]">Ventas</span>
          <span className="font-medium tabular-nums text-foreground">{formatCurrency(ventas)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[#64748b]">Meta</span>
          <span className="font-medium tabular-nums text-foreground">{formatCurrency(meta)}</span>
        </div>
      </div>
      {oppsCount > 0 ? (
        <p className="mt-2.5 border-t border-border pt-2 text-[11px] leading-snug text-muted-foreground">
          Clic en las barras para ver el listado ({oppsCount} oportun{oppsCount === 1 ? 'idad' : 'idades'})
        </p>
      ) : null}
    </div>
  );
}
