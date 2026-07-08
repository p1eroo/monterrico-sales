import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { UpArrowSvgIcon } from '@/components/icons/UpArrowSvgIcon';
import { DownArrowSvgIcon } from '@/components/icons/DownArrowSvgIcon';
import { MetricBarSparkline } from '@/components/shared/MetricBarSparkline';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral' | 'warning';
  sparklineData?: number[];
  sparklineLabels?: string[];
  sparklineColor?: string;
  sparklineLoading?: boolean;
  description?: string;
  loading?: boolean;
}

export function MetricCard({
  title,
  value,
  change,
  changeType = 'neutral',
  sparklineData,
  sparklineLabels,
  sparklineColor,
  sparklineLoading,
  description,
  loading,
}: MetricCardProps) {
  if (loading) {
    return (
      <Card className="relative overflow-hidden py-0">
        <CardContent className="px-5 py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-28" />
              <Skeleton className="h-4 w-36" />
            </div>
            <Skeleton className="h-[35px] min-w-[100px] max-w-[160px] shrink-0 rounded-sm" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden py-0">
      <CardContent className="px-5 py-5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-4">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            <div className="flex min-h-5 flex-wrap items-center gap-1.5 text-sm">
              {change ? (
                <>
                  <span className="inline-flex items-center gap-1">
                    {changeType === 'positive' && (
                      <UpArrowSvgIcon className="size-3.5 shrink-0 text-emerald-500" />
                    )}
                    {changeType === 'negative' && (
                      <DownArrowSvgIcon className="size-3.5 shrink-0 text-red-500" />
                    )}
                    <span
                      className={cn(
                        'font-semibold text-foreground',
                        changeType === 'warning' && 'text-amber-600',
                        changeType === 'neutral' && 'text-muted-foreground',
                      )}
                    >
                      {change}
                    </span>
                  </span>
                  {description ? (
                    <span className="text-xs text-muted-foreground">{description}</span>
                  ) : null}
                </>
              ) : description ? (
                <span className="text-xs text-muted-foreground">{description}</span>
              ) : null}
            </div>
          </div>
          {sparklineLoading ? (
            <Skeleton className="h-[35px] min-w-[100px] max-w-[160px] shrink-0 rounded-sm" />
          ) : sparklineData && sparklineData.length > 0 ? (
            <MetricBarSparkline
              data={sparklineData}
              labels={sparklineLabels}
              color={sparklineColor}
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
