import { HelpCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TaskDueUrgencyFilter } from '@/lib/taskStatus';

const LEGEND: {
  id: TaskDueUrgencyFilter;
  swatch: string;
  activeSwatch: string;
  label: string;
  description: string;
}[] = [
  {
    id: 'overdue',
    swatch: 'bg-red-100 border-red-300 dark:bg-red-950/50 dark:border-red-700',
    activeSwatch: 'ring-2 ring-red-400/70',
    label: 'Rojo',
    description: 'Ya vencieron',
  },
  {
    id: 'today',
    swatch: 'bg-yellow-300 border-yellow-500 dark:bg-yellow-500/45 dark:border-yellow-400',
    activeSwatch: 'ring-2 ring-yellow-500/70',
    label: 'Amarillo',
    description: 'Vencen hoy',
  },
  {
    id: 'tomorrow',
    swatch: 'bg-orange-400 border-orange-600 dark:bg-orange-500/45 dark:border-orange-400',
    activeSwatch: 'ring-2 ring-orange-500/70',
    label: 'Naranja',
    description: 'Vencen mañana',
  },
];

export const TASK_DUE_URGENCY_LABELS: Record<TaskDueUrgencyFilter, string> = {
  overdue: 'Vencidas',
  today: 'Vencen hoy',
  tomorrow: 'Vencen mañana',
  week: 'Próximos 7 días',
};

type TaskDueColorGuideProps = {
  open: boolean;
  onDismiss: () => void;
  onReopen: () => void;
  activeFilter: TaskDueUrgencyFilter | null;
  counts: Record<TaskDueUrgencyFilter, number>;
  onFilterChange: (next: TaskDueUrgencyFilter | null) => void;
  className?: string;
};

export function TaskDueColorGuide({
  open,
  onDismiss,
  onReopen,
  activeFilter,
  counts,
  onFilterChange,
  className,
}: TaskDueColorGuideProps) {
  const toggleFilter = (id: TaskDueUrgencyFilter) => {
    onFilterChange(activeFilter === id ? null : id);
  };

  return (
    <div className={cn('pointer-events-none fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2', className)}>
      {open ? (
        <div
          role="dialog"
          aria-labelledby="task-due-color-guide-title"
          className="pointer-events-auto w-[min(calc(100vw-2rem),22.5rem)] animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <div className="relative overflow-hidden rounded-2xl border border-[#e1e7ee] bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <div className="absolute -right-6 -top-6 size-24 rounded-full bg-[#13944C]/10" aria-hidden />
            <button
              type="button"
              onClick={onDismiss}
              className="absolute right-2 top-2 rounded-md p-1 text-[#8a9aab] transition-colors hover:text-[#1f2933] dark:text-gray-400 dark:hover:text-gray-100"
              aria-label="Cerrar guía de colores"
            >
              <X className="size-4" />
            </button>

            <div className="flex gap-3 p-4 pr-8">
              <div
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#e8f5e9] text-lg dark:bg-green-900/40"
                aria-hidden
              >
                👋
              </div>
              <div className="min-w-0 space-y-2">
                <p
                  id="task-due-color-guide-title"
                  className="text-[13px] font-semibold leading-snug text-[#1f2933] dark:text-gray-100"
                >
                  ¡Hola! Cada color te ayuda a priorizar tus tareas.
                </p>
                <p className="text-[11px] text-[#647789] dark:text-gray-400">
                  Pulsa un color para filtrar la lista.
                </p>
                <ul className="space-y-1">
                  {LEGEND.map((item) => {
                    const count = counts[item.id];
                    const active = activeFilter === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => toggleFilter(item.id)}
                          disabled={count === 0 && !active}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-40',
                            active
                              ? cn('bg-[#e8f5e9]/80 dark:bg-green-950/30', item.activeSwatch)
                              : 'hover:bg-muted/70',
                          )}
                        >
                          <span
                            className={cn('size-3 shrink-0 rounded-sm border', item.swatch)}
                            aria-hidden
                          />
                          <span className="flex-1 whitespace-nowrap text-[#475569] dark:text-gray-300">
                            <span className="font-medium text-[#1f2933] dark:text-gray-100">
                              {item.label}:
                            </span>{' '}
                            {item.description}
                          </span>
                          <span className="shrink-0 rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[#1f2933] dark:bg-white/10 dark:text-gray-100">
                            {count}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 bg-[#13944C] px-2.5 text-xs text-white hover:bg-[#0f7a3d]"
                  onClick={onDismiss}
                >
                  Entendido
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {!open ? (
        <button
          type="button"
          onClick={onReopen}
          className={cn(
            'pointer-events-auto relative flex size-10 items-center justify-center rounded-full border bg-white/95 text-[#647789] shadow-md transition-colors hover:border-[#13944C] hover:text-[#13944C] dark:bg-gray-900/95 dark:text-gray-400 dark:hover:border-green-500 dark:hover:text-green-400',
            activeFilter
              ? 'border-[#13944C] text-[#13944C] ring-2 ring-[#13944C]/25 dark:border-green-500 dark:text-green-400'
              : 'border-[#e1e7ee] dark:border-gray-700',
          )}
          aria-label="Ver guía de colores de vencimiento"
          title={activeFilter ? `Filtro: ${TASK_DUE_URGENCY_LABELS[activeFilter]}` : 'Guía de colores'}
        >
          <HelpCircle className="size-5" />
          {activeFilter ? (
            <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-[#13944C] ring-2 ring-white dark:ring-gray-900" />
          ) : null}
        </button>
      ) : null}
    </div>
  );
}
