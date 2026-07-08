import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
        <CardTitle className="text-base font-medium">Oportunidades por fuente</CardTitle>
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
