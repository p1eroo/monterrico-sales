import { useTheme } from 'next-themes';

export function useChartTheme() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return {
    isDark,
    /** Grilla sutil: en oscuro casi invisible para no competir con barras/líneas. */
    gridStroke: isDark ? 'rgba(148, 163, 184, 0.12)' : '#e5e7eb',
    tooltipBorder: isDark ? '#334155' : '#e5e7eb',
    tooltipBg: isDark ? '#1e293b' : '#ffffff',
    /** Texto del Tooltip de Recharts (por defecto puede quedar negro y no leerse en oscuro). */
    tooltipText: isDark ? '#f1f5f9' : '#0f172a',
    tooltipTextMuted: isDark ? '#94a3b8' : '#64748b',
    /** Recharts aplica el fill en SVG: evitar `var(--…)` u hsl con `/` o puede verse negro. */
    tooltipCursorFill: isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(71, 85, 105, 0.1)',
    /** Ejes legibles sobre fondo oscuro. */
    axisColor: isDark ? '#cbd5e1' : '#64748b',
    metaBar: isDark ? '#94a3b8' : '#64748b',
    /** Bandas de fondo opcionales (Apex row.colors). */
    gridRowBand: isDark ? 'rgba(148, 163, 184, 0.06)' : '#f8fafc',
  };
}
