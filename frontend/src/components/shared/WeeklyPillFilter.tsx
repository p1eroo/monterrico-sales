import { cn } from '@/lib/utils';

export type WeeklyPillOption = {
  name: string;
  sourceIndex: number;
};

interface WeeklyPillFilterProps {
  weeks: WeeklyPillOption[];
  selectedIndex: number;
  onChange: (index: number) => void;
  className?: string;
  ariaLabel?: string;
}

/** Píldoras de semana ISO (más reciente primero), estilo Fuentes. */
export function WeeklyPillFilter({
  weeks,
  selectedIndex,
  onChange,
  className,
  ariaLabel = 'Filtrar por semana',
}: WeeklyPillFilterProps) {
  if (weeks.length === 0) return null;

  return (
    <div
      className={cn('flex flex-wrap items-center gap-1', className)}
      role="group"
      aria-label={ariaLabel}
    >
      {weeks.map((week, index) => (
        <button
          key={week.name}
          type="button"
          onClick={() => onChange(index)}
          className={cn(
            'h-7 rounded-md border px-2.5 text-xs font-medium transition-colors',
            selectedIndex === index
              ? 'border-[#13944C] bg-[#13944C]/10 text-[#13944C]'
              : 'border-transparent text-muted-foreground hover:bg-muted/80',
          )}
        >
          {week.name}
        </button>
      ))}
    </div>
  );
}
