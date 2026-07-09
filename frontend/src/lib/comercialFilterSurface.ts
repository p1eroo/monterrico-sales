import { cn } from '@/lib/utils';

/** Mismo borde y fondo que `Card variant="surface"` (sin sombra). */
export const comercialCardSurfaceClass =
  'border-[#e1e7ee] bg-card/30 shadow-none dark:border-gray-700 dark:bg-gray-900/30 dark:shadow-none';

/** Override para controles con estilos base propios (DateRange, MultiSelect, etc.). */
export const comercialFilterSurfaceClass = cn(
  '!border-[#e1e7ee] !bg-card/30 !shadow-none dark:!border-gray-700 dark:!bg-gray-900/30 dark:!shadow-none',
);

export const comercialFilterActionClass = cn(
  'flex h-12 items-center gap-1.5 rounded-lg border px-3 text-sm text-black transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-60 dark:text-gray-100',
  comercialCardSurfaceClass,
);
