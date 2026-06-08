import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ChartSilhouette, type ChartSilhouetteVariant } from '@/components/shared/ChartSilhouette';

type ChartCardBodyProps = {
  loading: boolean;
  isEmpty: boolean;
  emptyMessage?: string;
  /** Silueta del mismo tipo que el gráfico real */
  variant?: ChartSilhouetteVariant;
  /** Altura del área del gráfico (p. ej. h-72 o h-[300px]) */
  className?: string;
  children: ReactNode;
};

export function ChartCardBody({
  loading,
  isEmpty,
  emptyMessage = 'Sin datos en este periodo.',
  variant = 'bar',
  className = 'h-72',
  children,
}: ChartCardBodyProps) {
  const outer = cn('w-full', className);

  if (loading) {
    return (
      <div className={outer}>
        <ChartSilhouette variant={variant} animate />
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className={outer}>
        <ChartSilhouette variant={variant} caption={emptyMessage} />
      </div>
    );
  }

  return <div className={outer}>{children}</div>;
}

export type { ChartSilhouetteVariant };
