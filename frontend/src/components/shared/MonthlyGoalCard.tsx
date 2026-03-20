import { Calendar } from 'lucide-react';
import { GoalCard } from './GoalCard';
import { getCurrentMonthLabel } from '@/lib/monthlySales';

export function MonthlyGoalCard() {
  return (
    <GoalCard
      period="monthly"
      icon={Calendar}
      labelPersonal="Mi meta mensual"
      labelTeam="Meta mensual del equipo"
      periodLabel={getCurrentMonthLabel()}
      periodLabelCapitalize
    />
  );
}
