import { cn } from '@/lib/utils';

/** Cabecera de tabla CRM (claro: franja gris; oscuro: fondo card + texto secundario). */
export const crmTableHeaderRowClass = cn(
  'bg-[#eef1f5] text-[11px] font-bold text-[#647789]',
  'dark:bg-card dark:text-muted-foreground',
);

export const crmTableHeaderRowClassSticky = cn(
  crmTableHeaderRowClass,
  'sticky top-0 z-10',
);

export const crmTableHeaderRowClassTall = cn(
  'bg-[#eef1f5] text-xs font-bold text-[#647789]',
  'dark:bg-card dark:text-muted-foreground',
);

export const crmTableBodyRowClass = cn(
  'border-b border-dashed border-[#e8ecf0] bg-card/30 transition-colors hover:bg-[#fafbfc]',
  'dark:border-border dark:bg-card dark:hover:bg-muted',
);

export const crmTableBodyRowClassInteractive = cn(
  crmTableBodyRowClass,
  'cursor-pointer',
);

export const crmTableFooterClass = cn(
  'border-t border-dashed border-[#e8ecf0] bg-card/30',
  'dark:border-border dark:bg-card',
);
