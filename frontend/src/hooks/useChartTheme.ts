import { useTheme } from 'next-themes';

export function useChartTheme() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return {
    gridStroke: isDark ? '#334155' : '#e5e7eb',
    tooltipBorder: isDark ? '#334155' : '#e5e7eb',
    tooltipBg: isDark ? '#1e293b' : '#ffffff',
    axisColor: isDark ? '#94a3b8' : '#64748b',
    metaBar: isDark ? '#94a3b8' : '#64748b',
  };
}
