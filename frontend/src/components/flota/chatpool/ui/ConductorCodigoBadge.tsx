import { cn } from '@/lib/utils';

interface ConductorCodigoBadgeProps {
  codigo: string;
  className?: string;
}

export function ConductorCodigoBadge({ codigo, className }: ConductorCodigoBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400',
        className,
      )}
    >
      {codigo}
    </span>
  );
}
