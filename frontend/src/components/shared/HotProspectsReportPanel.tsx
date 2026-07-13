import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatWeekRangeLima } from '@/lib/crmTimezone';
import { formatCurrency } from '@/lib/formatters';
import { companyDetailHref } from '@/lib/detailRoutes';
import type { HotProspectsSummary } from '@/lib/analyticsApi';
import {
  mapHotProspectsSparklines,
  type HotProspectSparkline,
} from '@/lib/hotProspectUtils';
import { cn } from '@/lib/utils';

interface HotProspectsReportPanelProps {
  data: HotProspectsSummary | null | undefined;
  sparklines?: Partial<
    Record<'total' | 'pipeline' | 'cierre' | 'activos', HotProspectSparkline>
  >;
  loading?: boolean;
  className?: string;
}

type StatCardKey = 'total' | 'pipeline' | 'cierre' | 'activos';

type StatCard = {
  cardKey: StatCardKey;
  label: string;
  value: string;
  hint?: string;
  sparkline?: HotProspectSparkline;
};

function formatSparkTooltipValue(key: StatCardKey, value: number): string {
  if (key === 'pipeline') {
    return formatCurrency(Math.round(value));
  }
  return value.toLocaleString('es-PE');
}

function HotProspectMiniChart({
  sparkline,
  cardKey,
}: {
  sparkline: HotProspectSparkline;
  cardKey: StatCardKey;
}) {
  const { data, color, variant = 'area', labels } = sparkline;
  const chartType = variant === 'bar' ? 'bar' : 'area';

  const options = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: chartType,
        height: 56,
        sparkline: { enabled: true },
        animations: { enabled: false },
        toolbar: { show: false },
      },
      colors: [color],
      stroke: {
        width: variant === 'area' ? 2 : 0,
        curve: 'smooth',
      },
      fill: {
        type: variant === 'area' ? 'gradient' : 'solid',
        opacity: variant === 'bar' ? 1 : 1,
        gradient: {
          opacityFrom: 0.35,
          opacityTo: 0.04,
        },
      },
      plotOptions: {
        bar: {
          columnWidth: '55%',
          borderRadius: 2,
          borderRadiusApplication: 'end',
        },
      },
      dataLabels: { enabled: false },
      tooltip: {
        enabled: true,
        custom({ series, seriesIndex, dataPointIndex }) {
          const value = series[seriesIndex]?.[dataPointIndex];
          if (value == null) return '';
          const displayValue = formatSparkTooltipValue(cardKey, Number(value));
          const weekLabel = labels?.[dataPointIndex] ?? '';
          return (
            '<div style="border-radius:8px;overflow:hidden;box-shadow:0 4px 14px rgba(15,23,42,0.12);background:#fff;min-width:72px;font-family:inherit;">' +
            (weekLabel
              ? `<div style="background:#f1f5f9;padding:5px 10px;text-align:center;font-size:11px;font-weight:500;color:#64748b;">${weekLabel}</div>`
              : '') +
            `<div style="padding:6px 10px;font-size:12px;font-weight:600;color:#1e293b;text-align:center;">${displayValue}</div>` +
            '</div>'
          );
        },
      },
    }),
    [cardKey, chartType, color, labels, variant],
  );

  const series = useMemo(() => [{ data }], [data]);

  return (
    <div className="h-14 max-w-full min-w-0 overflow-hidden">
      <Chart
        options={options}
        series={series}
        type={chartType}
        height={56}
        width="100%"
      />
    </div>
  );
}

function HotProspectStatCard({
  label,
  value,
  hint,
  sparkline,
  cardKey,
  loading,
}: StatCard & { loading?: boolean }) {
  if (loading) {
    return (
      <Card className="h-full overflow-hidden py-0">
        <CardContent className="flex h-full min-w-0 flex-col px-3 py-4">
          <Skeleton className="mb-2 h-3.5 w-28" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="mt-auto h-14 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full overflow-hidden py-0">
      <CardContent className="flex h-full min-w-0 flex-col px-4 py-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-foreground">
            {value}
          </p>
          {hint ? (
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        {sparkline ? (
          <div className="mt-auto min-w-0 overflow-hidden pt-3">
            <HotProspectMiniChart sparkline={sparkline} cardKey={cardKey} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function buildStatCards(
  data: HotProspectsSummary | null | undefined,
  sparklines?: HotProspectsReportPanelProps['sparklines'],
): StatCard[] {
  return [
    {
      cardKey: 'total',
      label: 'Total Calientes',
      value: (data?.totalCalientes ?? 0).toLocaleString('es-PE'),
      hint: 'Empresas en etapas 70%–100%',
      sparkline: sparklines?.total,
    },
    {
      cardKey: 'pipeline',
      label: 'Pipeline caliente',
      value: formatCurrency(data?.pipelineCaliente ?? 0),
      hint: 'Facturación estimada (70%+)',
      sparkline: sparklines?.pipeline,
    },
    {
      cardKey: 'cierre',
      label: 'En cierre',
      value: (data?.enCierre ?? 0).toLocaleString('es-PE'),
      hint: 'Etapas 85%–99%',
      sparkline: sparklines?.cierre,
    },
    {
      cardKey: 'activos',
      label: 'Ya activos',
      value: (data?.yaActivos ?? 0).toLocaleString('es-PE'),
      hint: 'Etapa Activo (100%)',
      sparkline: sparklines?.activos,
    },
  ];
}

function formatEtapaWithProbability(label: string, probability: number): string {
  return `${label} · ${probability}%`;
}

export function HotProspectsReportPanel({
  data,
  sparklines: sparklinesProp,
  loading,
  className,
}: HotProspectsReportPanelProps) {
  const sparklines = useMemo(
    () => sparklinesProp ?? mapHotProspectsSparklines(data),
    [sparklinesProp, data],
  );
  const statCards = buildStatCards(data, sparklines);
  const rows = data?.topProspects ?? [];
  const weekRangeLabel =
    data?.week?.weekStart && data?.week?.weekEnd
      ? formatWeekRangeLima(data.week.weekStart, data.week.weekEnd)
      : null;
  const weekCaption = data?.week?.name
    ? weekRangeLabel
      ? `Semana ${data.week.name} (${weekRangeLabel})`
      : `Semana ${data.week.name}`
    : 'Semana anterior';
  const isEmpty =
    !loading &&
    (data?.totalCalientes ?? 0) === 0 &&
    (data?.yaActivos ?? 0) === 0 &&
    rows.length === 0;

  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4 lg:grid-cols-[minmax(240px,26%)_minmax(0,74%)] lg:items-stretch lg:gap-6',
        className,
      )}
    >
      <div className="grid min-h-[420px] min-w-0 grid-rows-4 gap-3 lg:min-h-0 lg:h-full">
        {statCards.map((card) => (
          <HotProspectStatCard key={card.cardKey} {...card} loading={loading} />
        ))}
      </div>

      <Card className="flex min-h-0 min-w-0 flex-col py-0">
        <CardHeader className="shrink-0 gap-1 px-5 pb-2 pt-5">
          <CardTitle className="text-base font-medium">
            Top 15 prospectos calientes
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Cartera al cierre de {weekCaption} · etapas 70%–99% · por facturación estimada
          </p>
        </CardHeader>
        <CardContent className="min-h-0 min-w-0 flex-1 px-5 pb-5 pt-0">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : isEmpty ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Sin prospectos calientes en {weekCaption.toLowerCase()}.
            </p>
          ) : (
            <div className="h-full overflow-x-auto rounded-lg border border-border">
              <table className="w-full table-fixed text-xs sm:text-sm">
                <colgroup>
                  <col className="w-9" />
                  <col className="w-[30%]" />
                  <col className="w-[30%]" />
                  <col className="w-[22%]" />
                  <col className="w-[18%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-[11px] text-muted-foreground sm:text-xs">
                    <th className="px-2 py-2 font-medium">#</th>
                    <th className="px-2 py-2 font-medium">Empresa</th>
                    <th className="px-2 py-2 font-medium">Etapa</th>
                    <th className="px-2 py-2 font-medium">Asesor</th>
                    <th className="px-2 py-2 text-right font-medium">Fact. est.</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr
                      key={row.id}
                      className="border-b border-border/70 last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-2 py-2 tabular-nums text-muted-foreground">
                        {index + 1}
                      </td>
                      <td className="px-2 py-2">
                        <Link
                          to={companyDetailHref({ id: row.id, urlSlug: row.urlSlug })}
                          className="block truncate font-medium text-primary hover:underline"
                          title={row.name}
                        >
                          {row.name}
                        </Link>
                      </td>
                      <td className="truncate px-2 py-2 text-foreground" title={formatEtapaWithProbability(row.etapaLabel, row.probability)}>
                        {formatEtapaWithProbability(row.etapaLabel, row.probability)}
                      </td>
                      <td className="truncate px-2 py-2 text-muted-foreground" title={row.assignedToName ?? undefined}>
                        {row.assignedToName ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right font-medium tabular-nums">
                        {formatCurrency(row.facturacionEstimada)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
