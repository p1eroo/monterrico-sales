import type { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { dateRangeToLimaYmdBounds } from '@/lib/crmTimezone';
import { UNASSIGNED_SOURCE_SLUG } from '@/lib/sourcesByWeekChartUtils';

/** Mismo borde y fondo que `Card variant="surface"` (sin sombra). */
export const comercialCardSurfaceClass =
  'border-[#e1e7ee] bg-card/30 shadow-none dark:border-gray-700 dark:bg-gray-900/30 dark:shadow-none';

/** Override para controles con estilos base propios (DateRange, MultiSelect, etc.). */
export const comercialFilterSurfaceClass = cn(
  '!border-[#e1e7ee] !bg-card/30 !shadow-none dark:!border-gray-700 dark:!bg-gray-900/30 dark:!shadow-none',
);

export const comercialFilterActionClass = cn(
  'flex h-10 items-center gap-1.5 rounded-lg border px-3 text-[13px] text-black transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-60 dark:text-gray-100',
  comercialCardSurfaceClass,
);

/** Icono izquierdo en botones de filtro estándar (!h-10). Solo tamaño y color del SVG. */
export const comercialFilterIconClass =
  'size-5 shrink-0 text-[#72808f] dark:text-gray-500';

/** Icono izquierdo en botones de filtro altos (!h-12). */
export const comercialFilterIconLgClass =
  'size-6 shrink-0 text-[#72808f] dark:text-gray-500';

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

/**
 * Multi-select inclusivo:
 * - `[]` = todas las opciones activas (sin filtro en API)
 * - `[INCLUSIVE_MULTI_NONE]` = ninguna del catálogo (en fuente → sin fuente en API)
 * - lista parcial = filtro activo
 */
export const INCLUSIVE_MULTI_NONE = '__none__';

export function isInclusiveMultiFilterNone(
  selected: readonly string[],
): boolean {
  return selected.length === 1 && selected[0] === INCLUSIVE_MULTI_NONE;
}

export function isInclusiveMultiFilterAll(
  selected: readonly string[],
): boolean {
  return selected.length === 0;
}

export function isInclusiveMultiFilterSelected(
  selected: readonly string[],
  key: string,
): boolean {
  if (isInclusiveMultiFilterNone(selected)) return false;
  return selected.length === 0 || selected.includes(key);
}

export function matchesInclusiveMultiFilterValue(
  selected: readonly string[],
  value: string | null | undefined,
): boolean {
  if (isInclusiveMultiFilterNone(selected)) return false;
  if (selected.length === 0) return true;
  return value != null && value !== '' && selected.includes(value);
}

export function toggleInclusiveMultiFilter(
  selected: string[],
  key: string,
  allKeys: readonly string[],
): string[] {
  const isSelected = isInclusiveMultiFilterSelected(selected, key);

  if (isSelected) {
    if (selected.length === 0) {
      return allKeys.filter((k) => k !== key);
    }
    const next = selected.filter((k) => k !== key);
    if (next.length === 0) {
      return [INCLUSIVE_MULTI_NONE];
    }
    return next;
  }

  if (isInclusiveMultiFilterNone(selected)) {
    return [key];
  }

  const next = [...selected, key];
  if (
    next.length >= allKeys.length &&
    allKeys.every((k) => next.includes(k))
  ) {
    return [];
  }
  return next;
}

/** Etiqueta del botón: una opción por nombre; varias → contador (evita truncado CSS). */
export function formatInclusiveMultiFilterLabel(
  selected: string[],
  placeholder: string,
  resolveLabel: (key: string) => string,
  countLabel: string,
): string {
  if (isInclusiveMultiFilterNone(selected)) return 'Ninguna';
  if (selected.length === 0) return placeholder;
  if (selected.length === 1) return resolveLabel(selected[0]!);
  return `${selected.length} ${countLabel}`;
}

/** Parámetro API para filtro de fuente: ninguna del catálogo → sin fuente. */
export function inclusiveMultiSourceFilterToApiParam(
  selected: readonly string[],
): string | undefined {
  if (isInclusiveMultiFilterNone(selected)) return UNASSIGNED_SOURCE_SLUG;
  if (selected.length === 0) return undefined;
  return selected.join(',');
}

export function matchesInclusiveMultiSourceFilterValue(
  selected: readonly string[],
  value: string | null | undefined,
): boolean {
  if (isInclusiveMultiFilterNone(selected)) {
    return value == null || value.trim() === '';
  }
  if (selected.length === 0) return true;
  return value != null && value !== '' && selected.includes(value);
}

export function formatInclusiveMultiSourceFilterLabel(
  selected: string[],
  placeholder: string,
  resolveLabel: (key: string) => string,
): string {
  if (isInclusiveMultiFilterNone(selected)) return 'Sin fuente';
  return formatInclusiveMultiFilterLabel(
    selected,
    placeholder,
    resolveLabel,
    'fuentes',
  );
}
