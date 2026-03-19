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
        'flex w-full items-center gap-3 rounded-lg border border-amber-200/60 bg-amber-50/50 p-3 text-left transition-all',
        'hover:bg-amber-50 hover:border-amber-200 hover:shadow-sm',
        'focus:outline-none focus:ring-2 focus:ring-amber-300/50',
      )}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
        <Building2 className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground">Empresas inactivas</p>
        <p className="text-sm text-muted-foreground">
          {count === 0
            ? 'No hay empresas inactivas'
            : count === 1
              ? 'Tienes 1 empresa inactiva'
              : `Hoy tienes ${count} empresas inactivas`}
        </p>
      </div>
      {variant === 'full' && (
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}
