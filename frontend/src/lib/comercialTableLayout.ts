import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

/** Mismas medidas que Contactos.tsx */
export const COMERCIAL_TABLE_SELECT_SIZE = 44;
export const COMERCIAL_TABLE_ACTIONS_SIZE = 40;

export const comercialTableSelectColumnSizing = {
  size: COMERCIAL_TABLE_SELECT_SIZE,
  minSize: COMERCIAL_TABLE_SELECT_SIZE,
  maxSize: COMERCIAL_TABLE_SELECT_SIZE,
  enableSorting: false,
  enableResizing: false,
} as const;

export const comercialTableActionsColumnSizing = {
  size: COMERCIAL_TABLE_ACTIONS_SIZE,
  minSize: COMERCIAL_TABLE_ACTIONS_SIZE,
  maxSize: COMERCIAL_TABLE_ACTIONS_SIZE,
  enableSorting: false,
  enableResizing: false,
  enableHiding: false,
} as const;

export function isComercialTableFixedColumn(columnId: string): boolean {
  return columnId === 'select' || columnId === 'actions';
}

export function comercialTableFixedColStyle(columnId: string): CSSProperties | undefined {
  if (columnId === 'select') {
    return {
      width: `${COMERCIAL_TABLE_SELECT_SIZE}px`,
    };
  }
  if (columnId === 'actions') {
    return {
      width: `${COMERCIAL_TABLE_ACTIONS_SIZE}px`,
    };
  }
  return undefined;
}

/** Solo columnas flexibles llevan width inline; las fijas usan CSS + colgroup */
export function comercialTableCellStyle(columnId: string, size: number): CSSProperties | undefined {
  if (isComercialTableFixedColumn(columnId)) return undefined;
  return { width: size };
}

type LeadingCellClassOptions = {
  primaryColumnId?: string;
  alignRight?: boolean;
  sortable?: boolean;
  extra?: string;
};

export function comercialTableLeadingCellClass(
  columnId: string,
  options?: LeadingCellClassOptions,
): string {
  const { primaryColumnId, alignRight, sortable, extra } = options ?? {};
  const isFixed = isComercialTableFixedColumn(columnId);

  return cn(
    'relative overflow-hidden align-middle',
    sortable && 'cursor-pointer select-none hover:text-[#1f2933] dark:hover:text-gray-100',
    columnId === 'select' && 'comercial-table-col-select',
    columnId === 'actions' && 'comercial-table-col-actions',
    !isFixed && 'px-3',
    primaryColumnId && columnId === primaryColumnId && 'comercial-table-col-primary',
    alignRight && 'text-right',
    extra,
  );
}

/** Wrapper del checkbox (misma alineación que Contactos) */
export const comercialTableCheckboxWrapClass =
  'inline-flex items-center justify-center rounded-full p-1.5 transition-colors hover:bg-primary/10';
