import { GoalCard } from './GoalCard';
import { getCurrentMonthLabel } from '@/lib/monthlySales';

export function MonthlyGoalCard() {
  return (
    <GoalCard
      period="monthly"
      labelPersonal="Mi meta mensual"
      labelTeam="Meta mensual del equipo"
      periodLabel={getCurrentMonthLabel()}
      periodLabelCapitalize
    />
  );
}
