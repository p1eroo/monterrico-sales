/**
 * Círculos de icono por tipo de actividad (HSL explícitos).
 * Misma base visual que el menú «Nueva actividad» (`QuickActionsWithDialogs`);
 * incluye `whatsapp` para listados/tareas. Evita depender solo de tokens
 * `text-activity-*` con el stroke de Lucide en tablas/timeline.
 */
export const ACTIVITY_TYPE_ICON_CIRCLE = {
  llamada:
    'text-[hsl(142_82%_38%)] bg-[hsl(142_72%_91%)] shadow-[inset_0_0_0_1px_hsl(142_60%_78%/0.45)] dark:text-[hsl(142_82%_58%)] dark:bg-[hsl(142_71%_36%/0.32)] dark:shadow-none',
  nota:
    'text-[hsl(24_94%_46%)] bg-[hsl(34_90%_92%)] shadow-[inset_0_0_0_1px_hsl(32_78%_78%/0.42)] dark:text-[hsl(43_96%_60%)] dark:bg-[hsl(38_92%_42%/0.3)] dark:shadow-none',
  reunion:
    'text-[hsl(218_96%_52%)] bg-[hsl(212_92%_92%)] shadow-[inset_0_0_0_1px_hsl(215_75%_78%/0.4)] dark:text-[hsl(210_100%_70%)] dark:bg-[hsl(210_100%_50%/0.26)] dark:shadow-none',
  tarea:
    'text-[hsl(275_82%_50%)] bg-[hsl(278_70%_92%)] shadow-[inset_0_0_0_1px_hsl(280_55%_78%/0.4)] dark:text-[hsl(280_78%_68%)] dark:bg-[hsl(280_67%_45%/0.28)] dark:shadow-none',
  correo:
    'text-[hsl(220_24%_40%)] bg-[hsl(216_38%_91%)] shadow-[inset_0_0_0_1px_hsl(220_22%_76%/0.45)] dark:text-[hsl(214_20%_76%)] dark:bg-[hsl(215_10%_34%/0.4)] dark:shadow-none',
  whatsapp:
    'text-[hsl(142_76%_34%)] bg-[hsl(142_60%_90%)] shadow-[inset_0_0_0_1px_hsl(142_50%_72%/0.45)] dark:text-[hsl(142_72%_58%)] dark:bg-[hsl(142_65%_38%/0.3)] dark:shadow-none',
  archivo:
    'text-[hsl(220_18%_38%)] bg-[hsl(218_32%_90%)] shadow-[inset_0_0_0_1px_hsl(220_18%_74%/0.4)] dark:text-[hsl(214_14%_70%)] dark:bg-[hsl(215_10%_30%/0.38)] dark:shadow-none',
} as const;

/** Lucide usa `currentColor` en el trazo: forzar herencia desde el círculo coloreado. */
export const ACTIVITY_ICON_INHERIT = '[&_svg]:shrink-0 [&_svg]:text-[inherit]';

export function activityTypeIconCircleClass(
  type: string | undefined | null,
): string | null {
  if (!type) return null;
  const k = type.trim().toLowerCase();
  const map: Record<string, string> = ACTIVITY_TYPE_ICON_CIRCLE;
  return map[k] ?? null;
}
