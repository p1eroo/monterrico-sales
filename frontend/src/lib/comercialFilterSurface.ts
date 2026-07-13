import type { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { dateRangeToLimaYmdBounds } from '@/lib/crmTimezone';

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

/** Popovers de filtros / columnas / switcher: look pro (gradiente, sombra, radio amplio). */
export const comercialProPopoverClass = cn(
  'overflow-hidden rounded-2xl border border-border/60 p-0',
  'bg-gradient-to-b from-white to-[#f7f8fa]',
  'shadow-[0_12px_40px_rgba(15,23,42,0.12)]',
  'dark:border-neutral-700/80 dark:from-neutral-900 dark:to-neutral-950',
  'dark:shadow-[0_12px_40px_rgba(0,0,0,0.45)]',
);

/** Command list dentro del popover pro (fondo transparente para ver el gradiente). */
export const comercialProCommandClass = 'bg-transparent';

/**
 * Convierte un rango de calendario a YYYY-MM-DD (días completos en hora Perú).
 * El backend interpreta estos valores con `parseDayStartLima` / `parseDayEndLima`.
 */
export function dateRangeToQueryBounds(range: DateRange | undefined): {
  from?: string;
  to?: string;
} {
  return dateRangeToLimaYmdBounds(range);
}
