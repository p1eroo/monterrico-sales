import { Building2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmpresasInactivasCardProps {
  count: number;
  onClick: () => void;
  variant?: 'compact' | 'full';
}

export function EmpresasInactivasCard({
  count,
  onClick,
  variant = 'full',
}: EmpresasInactivasCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all',
        'border-amber-200/70 bg-amber-50/80',
        'hover:border-amber-300 hover:bg-amber-50',
        'dark:border-amber-800/50 dark:bg-amber-950/45',
        'dark:hover:border-amber-700/55 dark:hover:bg-amber-950/60 dark:hover:shadow-md dark:hover:shadow-black/25',
        'focus:outline-none focus:ring-2 focus:ring-amber-400/40 dark:focus:ring-amber-500/35',
      )}
    >
      <div
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-lg',
          'bg-amber-100 text-amber-700 ring-1 ring-amber-200/80',
          'dark:bg-amber-900/55 dark:text-amber-400 dark:ring-amber-700/40',
        )}
      >
        <Building2 className="size-5 shrink-0 stroke-2" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight text-foreground">
          Empresas inactivas
        </p>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground dark:text-amber-100/80">
          {count === 0
            ? 'No hay empresas inactivas'
            : count === 1
              ? 'Tienes 1 empresa inactiva'
              : `Hoy tienes ${count} empresas inactivas`}
        </p>
      </div>
      {variant === 'full' && (
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}
