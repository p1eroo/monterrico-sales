import type { LucideIcon } from 'lucide-react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral' | 'warning';
  icon: LucideIcon;
  description?: string;
}

export function MetricCard({
  title,
  value,
  change,
  changeType = 'neutral',
  icon: Icon,
  description,
}: MetricCardProps) {
  return (
    <Card className="relative overflow-hidden py-0">
      <CardContent className="px-4 py-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
          </div>
          <div
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-lg',
              changeType === 'positive' && 'bg-emerald-100 text-emerald-600',
              changeType === 'negative' && 'bg-red-100 text-red-600',
              changeType === 'warning' && 'bg-amber-100 text-amber-600',
              changeType === 'neutral' && 'bg-blue-100 text-blue-600',
            )}
          >
            <Icon className="size-5" />
          </div>
        </div>
        {(change || description) && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            {change && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 font-medium',
                  changeType === 'positive' && 'text-emerald-600',
                  changeType === 'negative' && 'text-red-600',
                  changeType === 'warning' && 'text-amber-600',
                  changeType === 'neutral' && 'text-blue-600',
                )}
              >
                {changeType === 'positive' && <TrendingUp className="size-3.5" />}
                {changeType === 'negative' && <TrendingDown className="size-3.5" />}
                {change}
              </span>
            )}
            {description && (
              <span className="text-muted-foreground">{description}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
