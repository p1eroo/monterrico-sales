import { CardTitle } from '@/components/ui/card';
import { ChartInfoTooltip } from '@/components/shared/ChartInfoTooltip';
import { cn } from '@/lib/utils';

type ChartCardTitleProps = {
  title: string;
  info?: string;
  className?: string;
};

export function ChartCardTitle({ title, info, className }: ChartCardTitleProps) {
  return (
    <div className={cn('flex min-h-8 min-w-0 items-center gap-1.5', className)}>
      <CardTitle className="text-base font-medium">{title}</CardTitle>
      {info ? <ChartInfoTooltip description={info} /> : null}
    </div>
  );
}
