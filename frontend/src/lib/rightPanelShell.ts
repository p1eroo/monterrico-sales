import { cn } from '@/lib/utils';

/**
 * Fondo degradado y sombra lateral alineados con el panel de notificaciones
 * (modo claro y oscuro).
 */
export const rightDrawerSurfaceClass =
  'border-l-0 bg-gradient-to-br from-sky-50 via-background to-rose-50 shadow-[-4px_0_24px_-4px_rgba(0,0,0,0.12)] dark:from-sky-950 dark:via-background dark:to-rose-950 dark:shadow-[-4px_0_24px_-4px_rgba(0,0,0,0.4)]';

/** Contenedor tipo: columna flexible sin padding en el shell (el contenido añade padding). */
export const rightDrawerLayoutClass = 'flex w-full flex-col gap-0 p-0';

export const rightDrawerMaxWidth = {
  md: 'sm:max-w-md',
  /** Panel notificaciones / empresas sin cambio de etapa */
  notifications: 'sm:max-w-[440px] md:max-w-[480px]',
  lg: 'sm:max-w-lg',
  /** Resumen de hoy (ancho histórico del briefing) */
  briefing: 'sm:w-[380px] sm:max-w-[380px]',
} as const;

export type RightDrawerWidthKey = keyof typeof rightDrawerMaxWidth;

/**
 * className para `SheetContent` con `side="right"` y estética unificada.
 */
export function rightDrawerSheetContentClass(
  width: RightDrawerWidthKey,
  ...extras: (string | undefined)[]
) {
  return cn(
    rightDrawerLayoutClass,
    rightDrawerSurfaceClass,
    rightDrawerMaxWidth[width],
    ...extras,
  );
}

/**
 * className para paneles derechos que no usan `Sheet` (p. ej. Radix Dialog lateral).
 * Incluye posición fija, animación y superficie; ajustar ancho vía `width`.
 */
export function rightDrawerDialogContentClass(
  width: RightDrawerWidthKey,
  ...extras: (string | undefined)[]
) {
  return cn(
    'fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col',
    rightDrawerSurfaceClass,
    rightDrawerMaxWidth[width],
    'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=closed]:duration-300',
    'data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=open]:duration-500',
    ...extras,
  );
}
