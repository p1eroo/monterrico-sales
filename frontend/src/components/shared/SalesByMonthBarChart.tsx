import { useState, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useChartTheme } from '@/hooks/useChartTheme';
import { SalesByMonthChartTooltip, type SalesByMonthTooltipRow } from '@/components/shared/SalesByMonthChartTooltip';
import { SalesByMonthOpportunitiesDialog } from '@/components/shared/SalesByMonthOpportunitiesDialog';

type Variant = 'dashboard' | 'reports';

type SalesByMonthBarChartProps = {
  data: SalesByMonthTooltipRow[];
  variant: Variant;
  /** grosor de barra (reportes suele usar 28) */
  barSize?: number;
};

function payloadFromClick(data: unknown): SalesByMonthTooltipRow | null {
  if (!data || typeof data !== 'object') return null;
  const o = data as { payload?: SalesByMonthTooltipRow } & SalesByMonthTooltipRow;
  if (o.payload && typeof o.payload === 'object' && 'ventas' in o.payload) {
    return o.payload;
  }
  if ('ventas' in o && 'name' in o) {
    return o as SalesByMonthTooltipRow;
  }
  return null;
}

export function SalesByMonthBarChart({ data, variant, barSize }: SalesByMonthBarChartProps) {
  const chartTheme = useChartTheme();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<SalesByMonthTooltipRow | null>(null);

  const onBarClick = useCallback((clicked: unknown) => {
    const row = payloadFromClick(clicked);
    if (row) {
      setSelected(row);
      setDialogOpen(true);
    }
  }, []);

  const yFormatter =
    variant === 'dashboard'
      ? (v: number) => `S/${(v / 1000).toFixed(0)}k`
      : (v: number) => `${(v / 1000).toFixed(0)}k`;

  return (
    <>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          barGap={variant === 'dashboard' ? 4 : 6}
          margin={
            variant === 'dashboard'
              ? { top: 8, right: 8, left: 4, bottom: 0 }
              : { top: 8, right: 8, left: 4, bottom: 0 }
          }
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.gridStroke} />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={yFormatter}
          />
          <Tooltip
            content={<SalesByMonthChartTooltip />}
            cursor={{ fill: chartTheme.tooltipCursorFill }}
          />
          {variant === 'reports' ? (
            <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
          ) : null}
          <Bar
            dataKey="ventas"
            fill="#13944C"
            radius={[4, 4, 0, 0]}
            name="ventas"
            barSize={barSize}
            onClick={onBarClick}
            className="cursor-pointer outline-none"
          />
          <Bar
            dataKey="meta"
            fill={variant === 'dashboard' ? '#3b82f6' : chartTheme.metaBar}
            radius={[4, 4, 0, 0]}
            opacity={variant === 'dashboard' ? 0.5 : 1}
            name="meta"
            barSize={barSize}
            onClick={onBarClick}
            className="cursor-pointer outline-none"
          />
        </BarChart>
      </ResponsiveContainer>
      <SalesByMonthOpportunitiesDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setSelected(null);
        }}
        row={selected}
        metaColorClass={variant === 'dashboard' ? 'text-[#64748b]' : 'text-muted-foreground'}
      />
    </>
  );
}
