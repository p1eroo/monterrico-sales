import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useGoalsStore } from '@/store/goalsStore';
import { useAnalyticsGoalStore } from '@/store/analyticsGoalStore';
import { useAppStore } from '@/store';
import { formatCurrencyShort } from '@/lib/formatters';
import { utcYearMonthKey } from '@/lib/monthlySales';
import { cn } from '@/lib/utils';

export type GoalPeriod = 'weekly' | 'monthly';

interface GoalCardProps {
  period: GoalPeriod;
  icon: LucideIcon;
  labelPersonal: string;
  labelTeam: string;
  periodLabel: string;
  periodLabelCapitalize?: boolean;
}

function roleShowsTeamAggregate(role?: string, roleName?: string): boolean {
  const r = `${role ?? ''} ${roleName ?? ''}`.toLowerCase();
  return (
    r.includes('admin') ||
    r.includes('supervisor') ||
    r.includes('gerente')
  );
}

export function GoalCard({
  period,
  icon: Icon,
  labelPersonal,
  labelTeam,
  periodLabel,
  periodLabelCapitalize = false,
}: GoalCardProps) {
  const { currentUser } = useAppStore();
  const { getGlobalWeeklyGoal, getUserWeeklyGoal } = useGoalsStore();
  const ymUtc = utcYearMonthKey();
  const teamMonthlyOrgGoal = useGoalsStore((s) => s.monthlyOrgByYm[ymUtc] ?? 0);
  const personalMonthlyOrgGoal = useGoalsStore(
    (s) => s.advisorMonthlyByYm[currentUser.id]?.[ymUtc] ?? 0,
  );

  const teamWeekly = useAnalyticsGoalStore((s) => s.teamWeeklyClosed);
  const myWeekly = useAnalyticsGoalStore((s) => s.myWeeklyClosed);
  const teamMonthly = useAnalyticsGoalStore((s) => s.teamMonthlyClosed);
  const myMonthly = useAnalyticsGoalStore((s) => s.myMonthlyClosed);

  const showGlobal = roleShowsTeamAggregate(
    currentUser.role,
    currentUser.roleName,
  );

  const goal =
    period === 'weekly'
      ? showGlobal
        ? getGlobalWeeklyGoal()
        : getUserWeeklyGoal(currentUser.id)
      : showGlobal
        ? teamMonthlyOrgGoal
        : personalMonthlyOrgGoal;

  const sales =
    period === 'weekly'
      ? showGlobal
        ? teamWeekly
        : myWeekly
      : showGlobal
        ? teamMonthly
        : myMonthly;

  const percent = goal > 0 ? Math.min(100, Math.round((sales / goal) * 100)) : 0;
  const isComplete = goal > 0 && sales >= goal;

  if (goal <= 0) {
    return (
      <Card className="border-dashed py-0">
        <CardContent className="px-4 py-2.5">
          <div className="flex items-start gap-2">
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">
                {showGlobal ? labelTeam : labelPersonal}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                No hay una meta establecida.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden border-primary/20 py-0">
      <CardContent className="px-4 py-2.5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Icon className="size-4 shrink-0 text-primary" />
              <p className="text-sm font-medium text-muted-foreground">
                {showGlobal ? labelTeam : labelPersonal}
              </p>
            </div>
            <p className="mt-0.5 text-2xl font-bold tracking-tight">
              {formatCurrencyShort(sales)}
              <span className="ml-1 text-base font-normal text-muted-foreground">
                / {formatCurrencyShort(goal)}
              </span>
            </p>
            <p
              className={cn(
                'mt-0.5 text-xs text-muted-foreground',
                periodLabelCapitalize && 'capitalize'
              )}
            >
              {periodLabel}
            </p>
            <Progress value={percent} className="mt-2 h-2" />
            <p
              className={cn(
                'mt-0.5 text-xs font-medium',
                isComplete ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
              )}
            >
              {isComplete ? '¡Meta cumplida!' : `${percent}% completado`}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
