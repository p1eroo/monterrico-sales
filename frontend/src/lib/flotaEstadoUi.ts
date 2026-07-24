/** Colores y estilos de estado de prospectos Flota (UI compartida). */

export const FLOTA_ESTADO_CHART_COLORS: Record<string, string> = {
  Nuevo: '#64748b',
  NUEVO: '#64748b',
  Afiliado: '#13944C',
  AFILIADO: '#13944C',
  Citado: '#3b82f6',
  Seguimiento: '#22c55e',
  Informacion: '#06b6d4',
  'Sin Requisitos': '#ef4444',
  'No Responde': '#f59e0b',
};

export const FLOTA_ESTADO_BADGE_CLASS: Record<string, string> = {
  Nuevo: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  NUEVO: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  Afiliado: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  AFILIADO: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  Citado: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  Seguimiento: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  Informacion: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300',
  'Sin Requisitos': 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  'No Responde': 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
};

export function flotaEstadoChartColor(estado: string): string {
  return FLOTA_ESTADO_CHART_COLORS[estado] ?? '#94a3b8';
}

export function flotaEstadoBadgeClass(estado: string): string {
  return (
    FLOTA_ESTADO_BADGE_CLASS[estado] ??
    'bg-muted text-muted-foreground'
  );
}

/** Normaliza claves duplicadas (Nuevo/NUEVO, Afiliado/AFILIADO). */
export function normalizeFlotaEstadoCounts(
  estadoCounts: Record<string, number>,
): { name: string; value: number }[] {
  const merged = new Map<string, number>();
  for (const [raw, count] of Object.entries(estadoCounts)) {
    if (!count) continue;
    const key =
      raw.toUpperCase() === 'NUEVO'
        ? 'Nuevo'
        : raw.toUpperCase() === 'AFILIADO'
          ? 'Afiliado'
          : raw;
    merged.set(key, (merged.get(key) ?? 0) + count);
  }
  return [...merged.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}
