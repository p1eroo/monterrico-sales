import type { LucideIcon } from 'lucide-react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

interface PremiumMetricCardProps {
  title: string;
  value: string | number;
  change: number;
  icon: LucideIcon;
  sparklineData: { value: number }[];
  color?: 'emerald' | 'blue' | 'amber' | 'rose' | 'red';
  loading?: boolean;
}

const COLOR_MAPS = {
  emerald: {
    bg: 'bg-emerald-50',
    icon: 'bg-emerald-100 text-emerald-600',
    text: 'text-emerald-600',
    stroke: '#10b981',
    fill: 'rgba(16, 185, 129, 0.1)',
  },
  blue: {
    bg: 'bg-blue-50',
    icon: 'bg-blue-100 text-blue-600',
    text: 'text-blue-600',
    stroke: '#3b82f6',
    fill: 'rgba(59, 130, 246, 0.1)',
  },
  amber: {
    bg: 'bg-amber-50',
    icon: 'bg-amber-100 text-amber-600',
    text: 'text-amber-600',
    stroke: '#f59e0b',
    fill: 'rgba(245, 158, 11, 0.1)',
  },
  rose: {
    bg: 'bg-rose-50',
    icon: 'bg-rose-100 text-rose-600',
    text: 'text-rose-600',
    stroke: '#f43f5e',
    fill: 'rgba(244, 63, 94, 0.1)',
  },
  red: {
    bg: 'bg-red-50',
    icon: 'bg-red-100 text-red-600',
    text: 'text-red-600',
    stroke: '#ef4444',
    fill: 'rgba(239, 68, 68, 0.1)',
  },
};

export function PremiumMetricCard({
  title,
  value,
  change,
  icon: Icon,
  sparklineData,
  color = 'blue',
  loading,
}: PremiumMetricCardProps) {
  const colors = COLOR_MAPS[color];
  const isPositive = change >= 0;

  if (loading) {
    return (
      <Card className="overflow-hidden border-none">
        <CardContent className="p-5 space-y-4">
          <div className="flex justify-between items-start">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="size-10 rounded-xl" />
          </div>
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-10 w-full rounded-md" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-none transition-all duration-300 group">
      <CardContent className="p-0">
        <div className="p-4 space-y-1">
          <div className="flex justify-between items-start mb-1">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{title}</span>
            <div className={cn("size-10 flex items-center justify-center rounded-xl transition-transform group-hover:scale-110 duration-300", colors.icon)}>
              <Icon className="size-5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-3xl font-black tracking-tight">{value}</h3>
            <div className={cn("flex items-center gap-1.5 text-xs font-bold", isPositive ? 'text-emerald-500' : 'text-rose-500')}>
              {isPositive ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
              <span>{isPositive ? '+' : ''}{change}% <span className="text-muted-foreground font-normal ml-0.5">vs mes ant.</span></span>
            </div>
          </div>
        </div>
        <div className="h-12 w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparklineData}>
              <defs>
                <linearGradient id={`gradient-${title.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.stroke} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={colors.stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={colors.stroke}
                strokeWidth={2}
                fill={`url(#gradient-${title.replace(/\s+/g, '-')})`}
                isAnimationActive={true}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
