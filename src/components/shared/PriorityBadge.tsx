import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { LeadPriority } from '@/types';

const priorityConfig: Record<LeadPriority, { label: string; className: string }> = {
  alta: { label: 'Alta', className: 'bg-red-100 text-red-700 border-red-200' },
  media: { label: 'Media', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  baja: { label: 'Baja', className: 'bg-slate-100 text-slate-700 border-slate-200' },
};

interface PriorityBadgeProps {
  priority: LeadPriority;
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const config = priorityConfig[priority] ?? {
    label: priority,
    className: 'bg-gray-100 text-gray-700 border-gray-200',
  };
  return (
    <Badge variant="outline" className={cn('text-[11px] font-medium', config.className)}>
      {config.label}
    </Badge>
  );
}
