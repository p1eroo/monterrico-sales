import type { EstimatedBillingWeekly } from '@/lib/analyticsApi';
import { EstimatedBillingMixedBarChart } from '@/components/shared/EstimatedBillingMixedBarChart';

interface EstimatedBillingAreaChartProps {
  data: EstimatedBillingWeekly | null | undefined;
  height?: number;
  className?: string;
  showLegend?: boolean;
  showChartTitle?: boolean;
}

export function EstimatedBillingAreaChart({
  data,
  height = 270,
  className,
  showLegend = true,
  showChartTitle = false,
}: EstimatedBillingAreaChartProps) {
  return (
    <EstimatedBillingMixedBarChart
      data={data}
      height={height}
      className={className}
      showLegend={showLegend}
      showChartTitle={showChartTitle}
    />
  );
}
