import type { AdvancedContactsWeekly } from '@/lib/analyticsApi';
import { CompanyWeeklyStageMixedBarChart } from '@/components/shared/CompanyWeeklyStageMixedBarChart';
import { ADVANCED_CONTACTS_WEEKLY_CHART } from '@/lib/reportsWeeklyMetricChartColors';

interface AdvancedContactsBarChartProps {
  data: AdvancedContactsWeekly | null | undefined;
  height?: number;
  className?: string;
  showLegend?: boolean;
  showChartTitle?: boolean;
}

export function AdvancedContactsBarChart({
  data,
  height = 270,
  className,
  showLegend = true,
  showChartTitle = false,
}: AdvancedContactsBarChartProps) {
  return (
    <CompanyWeeklyStageMixedBarChart
      data={data}
      height={height}
      className={className}
      showLegend={showLegend}
      showChartTitle={showChartTitle}
      seriesColor={ADVANCED_CONTACTS_WEEKLY_CHART.bar}
      hotStageLineColor={ADVANCED_CONTACTS_WEEKLY_CHART.hotLine}
      totalSeriesName="Contactos avanzados"
      totalLegendLabel="Contactos avanzados del año (etapas 30%–100%)"
      chartTitle="Contactos avanzados del año en el tiempo"
      emptyMessage="Sin contactos avanzados en las últimas 6 semanas."
    />
  );
}
