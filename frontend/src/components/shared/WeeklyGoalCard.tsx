import { Target } from 'lucide-react';
import { GoalCard } from './GoalCard';
import { getCurrentWeekLabel } from '@/lib/weeklySales';

export function WeeklyGoalCard() {
  return (
    <GoalCard
      period="weekly"
      icon={Target}
      labelPersonal="Mi meta semanal"
      labelTeam="Meta semanal del equipo"
      periodLabel={getCurrentWeekLabel()}
    />
  );
}
