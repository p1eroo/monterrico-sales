import { useEffect, useRef } from 'react';
import {
  OPERADOR_ACTIVITY_METRICS,
  type OperadorDetallePorDia,
} from '@/lib/flotaOperadorReportUtils';
import { cn } from '@/lib/utils';

interface OperadorAsignacionesZonaPanelProps {
  data: OperadorDetallePorDia[];
  selectedDayIndex: number;
  className?: string;
}

function formatCount(n: number): string {
  return n.toLocaleString('es-PE');
}

export function OperadorAsignacionesZonaPanel({
  data,
  selectedDayIndex,
  className,
}: OperadorAsignacionesZonaPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const day =
    selectedDayIndex >= 0 && selectedDayIndex < data.length
      ? data[selectedDayIndex]
      : null;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selectedDayIndex]);

  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border/80 bg-muted/20',
        className,
      )}
    >
      <div className="shrink-0 border-b border-border/60 px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Detalle por operador
        </p>
        <p className="mt-0.5 text-sm font-medium text-foreground">
          {day?.dayLabel ?? 'Haz clic en un día del gráfico'}
        </p>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
        {!day ? (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">
            Haz clic en un día del gráfico para ver la actividad y asignaciones
            por zona de cada operador.
          </p>
        ) : day.operadores.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">
            Sin actividad registrada este día.
          </p>
        ) : (
          <ul className="space-y-2">
            {day.operadores.map((row) => (
              <li
                key={row.operador}
                className="rounded-md border border-border/70 bg-background p-2.5 shadow-sm"
              >
                <p className="mb-2 truncate text-xs font-semibold text-foreground">
                  {row.operador}
                </p>

                <div className="mb-2 grid grid-cols-2 gap-x-2 gap-y-1">
                  {OPERADOR_ACTIVITY_METRICS.map((metric) => {
                    const val = row[metric.key];
                    return (
                      <div
                        key={metric.key}
                        className="flex items-center justify-between gap-1 text-[10px]"
                      >
                        <span
                          className={cn(
                            'truncate',
                            val > 0
                              ? 'text-muted-foreground'
                              : 'text-muted-foreground/50',
                          )}
                        >
                          {metric.label}
                        </span>
                        <span
                          className={cn(
                            'shrink-0 font-medium tabular-nums',
                            val > 0
                              ? 'text-foreground'
                              : 'text-muted-foreground/50',
                          )}
                        >
                          {formatCount(val)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {row.zonas.length > 0 ? (
                  <>
                    <p className="mb-1 border-t border-border/60 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Asignaciones por zona
                    </p>
                    <ul className="space-y-0.5">
                      {row.zonas.map((z) => (
                        <li
                          key={z.zona}
                          className="flex items-center justify-between gap-2 text-[11px]"
                        >
                          <span className="truncate text-muted-foreground">
                            {z.zona}
                          </span>
                          <span className="shrink-0 font-medium tabular-nums text-foreground">
                            {formatCount(z.count)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
