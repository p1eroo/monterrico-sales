import { useMemo } from 'react';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { ChartCardTitle } from '@/components/shared/ChartCardTitle';
import { flotaDashboardChartDescriptions } from '@/lib/dashboardChartDescriptions';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  flotaEstadoChartColor,
  normalizeFlotaEstadoCounts,
} from '@/lib/flotaEstadoUi';
import { cn } from '@/lib/utils';

type FlotaEstadoDistributionCardProps = {
  estadoCounts: Record<string, number>;
  total: number;
  convertidos: number;
  sinContactar: number;
  loading?: boolean;
  className?: string;
};

const MAX_SLICES = 6;

function buildChartData(estadoCounts: Record<string, number>) {
  const sorted = normalizeFlotaEstadoCounts(estadoCounts);
  if (sorted.length <= MAX_SLICES) return sorted;

  const top = sorted.slice(0, MAX_SLICES - 1);
  const others = sorted.slice(MAX_SLICES - 1).reduce((sum, row) => sum + row.value, 0);
  if (others > 0) {
    top.push({ name: 'Otros', value: others });
  }
  return top;
}

export function FlotaEstadoDistributionCard({
  estadoCounts,
  total,
  convertidos,
  sinContactar,
  loading,
  className,
}: FlotaEstadoDistributionCardProps) {
  const chartData = useMemo(() => buildChartData(estadoCounts), [estadoCounts]);

  const tasaAfiliacion = total > 0 ? Math.round((convertidos / total) * 100) : 0;
  const pendientesPct = total > 0 ? Math.round((sinContactar / total) * 100) : 0;

  return (
    <Card className={cn('flex flex-col py-0', className)}>
      <CardHeader className="pb-2 pt-5">
        <ChartCardTitle
          title="Distribución por estado"
          info={flotaDashboardChartDescriptions.distribucionEstado}
        />
        <p className="text-xs text-muted-foreground">
          Composición actual del pipeline de prospectos
        </p>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col px-5 pb-5 pt-0">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="mx-auto size-[220px] rounded-full" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : total === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No hay prospectos para mostrar.
          </p>
        ) : (
          <>
            <div className="relative mx-auto h-[220px] w-full max-w-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={62}
                    outerRadius={96}
                    dataKey="value"
                    nameKey="name"
                    stroke="none"
                    paddingAngle={2}
                    animationDuration={400}
                  >
                    {chartData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={
                          entry.name === 'Otros'
                            ? '#cbd5e1'
                            : flotaEstadoChartColor(entry.name)
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => {
                      const count = typeof value === 'number' ? value : 0;
                      return [
                        `${count.toLocaleString('es-PE')} (${total > 0 ? Math.round((count / total) * 100) : 0}%)`,
                        name,
                      ];
                    }}
                    contentStyle={{
                      borderRadius: 10,
                      fontSize: 12,
                      border: '1px solid var(--border)',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-2xl font-bold tabular-nums">{total.toLocaleString('es-PE')}</p>
                <p className="text-[11px] text-muted-foreground">prospectos</p>
              </div>
            </div>

            <div className="mt-4 grid max-h-[140px] grid-cols-2 gap-x-3 gap-y-2 overflow-y-auto pr-1">
              {chartData.map((row) => (
                <div key={row.name} className="flex min-w-0 items-center gap-2 text-xs">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        row.name === 'Otros'
                          ? '#cbd5e1'
                          : flotaEstadoChartColor(row.name),
                    }}
                  />
                  <span className="truncate text-muted-foreground">{row.name}</span>
                  <span className="ml-auto shrink-0 font-semibold tabular-nums">
                    {row.value.toLocaleString('es-PE')}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/60 pt-4">
              <div className="rounded-xl bg-emerald-500/[0.08] px-3 py-2.5">
                <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                  Tasa afiliación
                </p>
                <p className="text-lg font-bold tabular-nums text-emerald-800 dark:text-emerald-300">
                  {tasaAfiliacion}%
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {convertidos.toLocaleString('es-PE')} afiliados
                </p>
              </div>
              <div className="rounded-xl bg-amber-500/[0.08] px-3 py-2.5">
                <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                  Sin contactar
                </p>
                <p className="text-lg font-bold tabular-nums text-amber-800 dark:text-amber-300">
                  {pendientesPct}%
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {sinContactar.toLocaleString('es-PE')} pendientes
                </p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
