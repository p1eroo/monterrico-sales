import type { ActiveProspectsWeekly } from '@/lib/analyticsApi';
import { CompanyWeeklyStageMixedBarChart } from '@/components/shared/CompanyWeeklyStageMixedBarChart';
import { ACTIVE_PROSPECTS_WEEKLY_CHART } from '@/lib/reportsWeeklyMetricChartColors';

interface ActiveProspectsAreaChartProps {
  data: ActiveProspectsWeekly | null | undefined;
  height?: number;
  className?: string;
  showLegend?: boolean;
  showChartTitle?: boolean;
}

export function ActiveProspectsAreaChart({
  data,
  height = 270,
  className,
  showLegend = true,
  showChartTitle = false,
}: ActiveProspectsAreaChartProps) {
  return (
    <CompanyWeeklyStageMixedBarChart
      data={data}
      height={height}
      className={className}
      showLegend={showLegend}
      showChartTitle={showChartTitle}
      seriesColor={ACTIVE_PROSPECTS_WEEKLY_CHART.bar}
      hotStageLineColor={ACTIVE_PROSPECTS_WEEKLY_CHART.hotLine}
      totalSeriesName="Prospectos activos"
      totalLegendLabel="Prospectos activos del año (etapas 10%–100%)"
      chartTitle="Prospectos activos del año en el tiempo"
      emptyMessage="Sin prospectos activos en las últimas 6 semanas."
    />
  );
}
