import { cn } from '@/lib/utils';

/** Botones de acción del topbar (IA, notificaciones, tema, mensajes). */
export const topbarActionButtonClass = cn(
  'text-[#13944C]/72 hover:text-[#13944C]',
  'dark:text-[#2ECC87]/80 dark:hover:text-[#2ECC87]',
);

export function topbarActionButtonClassName(
  active = false,
  className?: string,
) {
  return cn(
    topbarActionButtonClass,
    active && 'text-[#13944C] dark:text-[#2ECC87]',
    className,
  );
}
