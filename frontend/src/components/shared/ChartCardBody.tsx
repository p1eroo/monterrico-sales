import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartSilhouette, type ChartSilhouetteVariant } from '@/components/shared/ChartSilhouette';

type ChartCardBodyProps = {
  loading: boolean;
  isEmpty: boolean;
  emptyMessage?: string;
  /** Silueta del mismo tipo que el gráfico real */
  variant?: ChartSilhouetteVariant;
  /** Clases del contenedor (p. ej. flex-1) */
  className?: string;
  /**
   * Altura del área del gráfico en px.
   * Skeleton y estado vacío usan la misma altura que el chart cargado.
   */
  chartHeight?: number;
  children: ReactNode;
};

export function ChartCardBody({
  loading,
  isEmpty,
  emptyMessage = 'Sin datos en este periodo.',
  variant = 'bar',
  className,
  chartHeight,
  children,
}: ChartCardBodyProps) {
  const heightStyle: CSSProperties | undefined =
    chartHeight != null
      ? { height: chartHeight, minHeight: chartHeight }
      : undefined;

  const outer = cn(
    'w-full',
    chartHeight == null && (className ?? 'h-72'),
    chartHeight != null && className,
  );

  if (loading) {
    return (
      <div className={outer} style={heightStyle}>
        <Skeleton className="h-full w-full rounded-md" />
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className={outer} style={heightStyle}>
        <ChartSilhouette variant={variant} caption={emptyMessage} />
      </div>
    );
  }

  return (
    <div className={outer} style={heightStyle} data-chart-capture>
      {children}
    </div>
  );
}

export type { ChartSilhouetteVariant };
