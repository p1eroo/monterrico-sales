import { Card, CardContent } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useGoalsStore } from '@/store/goalsStore';
import { useAnalyticsGoalStore } from '@/store/analyticsGoalStore';
import { useAppStore } from '@/store';
import { usePermissions } from '@/hooks/usePermissions';
import { formatCurrencyShort } from '@/lib/formatters';
import { utcYearMonthKey } from '@/lib/monthlySales';

export type GoalPeriod = 'weekly' | 'monthly';

function GaugeProgress({ percent, sales, goal }: { percent: number; sales: number; goal: number }) {
  const data = [
    { name: 'Restante', value: Math.max(0, 100 - percent) },
    { name: 'Progreso', value: percent },
  ];
  const color = percent >= 100 ? '#13944C' : '#3b82f6';

  return (
    <div className="flex flex-col items-center w-full max-w-[300px]">
      <div className="h-36 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="100%"
              startAngle={180}
              endAngle={0}
              innerRadius={80}
              outerRadius={115}
              dataKey="value"
              stroke="none"
              isAnimationActive={false}
            >
              <Cell fill="#e5e7eb" />
              <Cell fill={color} />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-between w-full mt-2">
        <div className="text-left">
          <p className="text-base font-bold tabular-nums">{formatCurrencyShort(sales)}</p>
          <p className="text-xs text-muted-foreground">actual</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold tabular-nums">{goal > 0 ? formatCurrencyShort(goal) : '—'}</p>
          {goal > 0 && <p className="text-xs text-muted-foreground">meta</p>}
        </div>
      </div>
    </div>
  );
}

interface GoalCardProps {
  period: GoalPeriod;
  labelPersonal: string;
  labelTeam: string;
  periodLabel: string;
  periodLabelCapitalize?: boolean;
}

export function GoalCard({
  period,
  labelPersonal,
  labelTeam,
  periodLabel,
  periodLabelCapitalize = false,
}: GoalCardProps) {
  const { currentUser } = useAppStore();
  const { hasPermission } = usePermissions();
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

  const showGlobal = hasPermission('equipo.datos_completos');

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

  return (
    <Card className="relative overflow-hidden py-0">
      <CardContent className="px-4 py-3">
        <div className="flex flex-col items-center gap-2">
          <p className="self-start text-sm font-medium text-muted-foreground">
            {showGlobal ? labelTeam : labelPersonal}
          </p>
          {goal > 0 ? (
            <GaugeProgress percent={percent} sales={sales} goal={goal} />
          ) : (
            <GaugeProgress percent={percent} sales={sales} goal={0} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
