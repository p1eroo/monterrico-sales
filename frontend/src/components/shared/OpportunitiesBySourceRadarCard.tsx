import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartCardTitle } from '@/components/shared/ChartCardTitle';
import { dashboardChartDescriptions } from '@/lib/dashboardChartDescriptions';
import {
  OpportunitiesBySourceRadarChart,
  type SourceRadarPoint,
} from '@/components/shared/OpportunitiesBySourceRadarChart';
import {
  GOALS_ROW_CHART_MIN_HEIGHT,
} from '@/components/shared/GoalGroupedBarChart';

interface OpportunitiesBySourceRadarCardProps {
  data: SourceRadarPoint[];
  loading?: boolean;
}

export function OpportunitiesBySourceRadarCard({
  data,
  loading,
}: OpportunitiesBySourceRadarCardProps) {
  return (
    <Card className="relative flex h-full w-full flex-col overflow-hidden py-0">
      <CardHeader className="shrink-0 pb-2 pt-5">
        <ChartCardTitle
          title="Oportunidades por fuente"
          info={dashboardChartDescriptions.opportunitiesBySource}
        />
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col px-5 pb-5 pt-2">
        {loading ? (
          <Skeleton
            className="w-full shrink-0 rounded-md"
            style={{ height: GOALS_ROW_CHART_MIN_HEIGHT }}
          />
        ) : (
          <OpportunitiesBySourceRadarChart data={data} className="min-h-0 flex-1" />
        )}
      </CardContent>
    </Card>
  );
}
