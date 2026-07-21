import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  GoalGroupedBarChart,
  GOAL_AVANCE_COLOR,
  GOAL_META_COLOR,
  GOALS_ROW_CHART_MIN_HEIGHT,
  GOALS_SUMMARY_BLOCK_CLASS,
} from '@/components/shared/GoalGroupedBarChart';
import { useAnalyticsGoalStore } from '@/store/analyticsGoalStore';
import { usePermissions } from '@/hooks/usePermissions';
import { ChartCardTitle } from '@/components/shared/ChartCardTitle';
import { chartCardHeaderClass } from '@/components/shared/ChartExpandToggleIcon';
import { dashboardChartDescriptions } from '@/lib/dashboardChartDescriptions';
import { cn } from '@/lib/utils';

type GoalPeriodView = 'week' | 'month';

function formatCompactTotal(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}k`;
  return String(Math.round(value));
}

function SummaryMetric({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center gap-2">
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="text-base font-medium tabular-nums text-foreground">{value}</p>
    </div>
  );
}

export function GoalsStatisticsCard() {
  const { hasPermission } = usePermissions();
  const loaded = useAnalyticsGoalStore((s) => s.loaded);
  const weeklyChart = useAnalyticsGoalStore((s) => s.weeklyChart);
  const monthlyChart = useAnalyticsGoalStore((s) => s.monthlyChart);
  const [period, setPeriod] = useState<GoalPeriodView>('month');

  const showTeam = hasPermission('equipo.datos_completos');
  const title = showTeam ? 'Metas del equipo' : 'Mis metas';

  const chartData = period === 'week' ? weeklyChart : monthlyChart;

  const { totalMeta, totalAvance } = useMemo(() => {
    let avance = 0;
    for (const row of chartData) {
      avance += row.avance;
    }
    const meta =
      period === 'week'
        ? (chartData[chartData.length - 1]?.meta ?? 0)
        : chartData.reduce((sum, row) => sum + row.meta, 0);
    return { totalMeta: meta, totalAvance: avance };
  }, [chartData, period]);

  return (
    <Card className="relative flex h-full w-full flex-col overflow-hidden py-0">
      <CardHeader className={cn(chartCardHeaderClass, 'shrink-0 pb-2')}>
        <ChartCardTitle
          title={title}
          info={
            showTeam
              ? dashboardChartDescriptions.teamGoals
              : dashboardChartDescriptions.myGoals
          }
        />
        <Select value={period} onValueChange={(v) => setPeriod(v as GoalPeriodView)}>
          <SelectTrigger
            size="sm"
            className="h-9 w-[120px] shrink-0 border-[#e1e7ee] bg-transparent text-sm font-medium shadow-none dark:border-gray-700 dark:bg-transparent"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="month">Mensual</SelectItem>
            <SelectItem value="week">Semanal</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col pb-4">
        {!loaded ? (
          <div className="flex min-h-0 flex-1 flex-col space-y-4">
            <div className="flex gap-8">
              <Skeleton className="h-14 w-24" />
              <Skeleton className="h-14 w-24" />
            </div>
            <Skeleton
              className="w-full shrink-0 rounded-md"
              style={{ height: GOALS_ROW_CHART_MIN_HEIGHT }}
            />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className={`flex flex-wrap items-end gap-8 sm:gap-12 ${GOALS_SUMMARY_BLOCK_CLASS}`}>
              <SummaryMetric
                color={GOAL_META_COLOR}
                label="Meta"
                value={
                  totalMeta > 0 ? formatCompactTotal(totalMeta) : '—'
                }
              />
              <SummaryMetric
                color={GOAL_AVANCE_COLOR}
                label="Avance"
                value={formatCompactTotal(totalAvance)}
              />
            </div>
            <GoalGroupedBarChart data={chartData} className="shrink-0" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
