import { Badge } from '@/components/ui/badge';
import type { Label } from '../types';

interface LabelChipProps {
  label: Pick<Label, 'name' | 'color'>;
}

const colorClass: Record<string, string> = {
  purple: 'border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300',
  blue: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  yellow: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  red: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
  orange: 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300',
};

export function ChatpoolLabelChip({ label }: LabelChipProps) {
  return (
    <Badge
      variant="outline"
      className={`text-[10px] px-1.5 py-0 font-medium max-w-full truncate ${colorClass[label.color] ?? colorClass.blue}`}
    >
      {label.name}
    </Badge>
  );
}
