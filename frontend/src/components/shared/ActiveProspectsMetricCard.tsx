import { TrendingDown, TrendingUp } from 'lucide-react';
import { SquareBottomUpSvgIcon } from '@/components/icons/SquareBottomUpSvgIcon';
import { chartExpandIconClass } from '@/components/shared/ChartExpandToggleIcon';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ActiveProspectsAreaChart } from '@/components/shared/ActiveProspectsAreaChart';
import { cn } from '@/lib/utils';
import type { ActiveProspectsWeekly } from '@/lib/analyticsApi';

const CHART_HEIGHT = 270;

interface ActiveProspectsMetricCardProps {
  data: ActiveProspectsWeekly | null | undefined;
  loading?: boolean;
  className?: string;
  onMaximize?: () => void;
  maximizeDisabled?: boolean;
}

export function ActiveProspectsMetricCard({
  data,
  loading,
  className,
  onMaximize,
  maximizeDisabled,
}: ActiveProspectsMetricCardProps) {
  const changePct = data?.changePct ?? null;
  const isPositive = changePct != null && changePct >= 0;
  const isEmpty =
    !data?.weeks?.length || data.weeks.every((w) => w.total <= 0);

  if (loading) {
    return (
      <Card className={cn('min-h-[320px]', className)}>
        <CardContent className="flex min-h-[320px] flex-col space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="size-8 rounded-md" />
          </div>
          <div className="flex items-baseline justify-between">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-5 w-14" />
          </div>
          <div className="-mx-5 my-4 border-t border-[#e1e7ee] dark:border-border" />
          <Skeleton className="h-4 w-40 self-center" />
          <Skeleton className="h-[270px] w-full flex-1 rounded-md" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('min-h-[320px]', className)}>
      <CardContent className="flex min-h-[320px] flex-col p-5">
        <div className="flex min-h-8 items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[#0f172a] dark:text-gray-100">
            Prospectos Activos
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground"
            onClick={onMaximize}
            disabled={maximizeDisabled || isEmpty}
            aria-label="Ampliar prospectos activos"
          >
            <SquareBottomUpSvgIcon className={chartExpandIconClass} />
          </Button>
        </div>

        <div className="mt-2 flex items-baseline justify-between gap-4">
          <span className="text-3xl font-bold tracking-tight text-[#0f172a] dark:text-gray-50">
            {data?.currentTotal ?? 0}
          </span>
          {changePct != null ? (
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-0.5 text-sm font-semibold',
                isPositive ? 'text-emerald-600' : 'text-rose-600',
              )}
            >
              {isPositive ? (
                <TrendingUp className="size-3.5" />
              ) : (
                <TrendingDown className="size-3.5" />
              )}
              {isPositive ? '+' : ''}
              {changePct}%
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </div>

        <div
          className="-mx-5 my-4 border-t border-[#e1e7ee] dark:border-border"
          role="separator"
        />

        <div className="w-full min-w-0 flex-1">
          <ActiveProspectsAreaChart
            data={data}
            height={CHART_HEIGHT}
            className="w-full"
            showChartTitle
          />
        </div>
      </CardContent>
    </Card>
  );
}
