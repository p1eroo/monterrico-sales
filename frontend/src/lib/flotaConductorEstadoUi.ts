import { cn } from '@/lib/utils';

export type ConductorEstadoTone =
  | 'disponible'
  | 'no_disponible'
  | 'en_servicio'
  | 'en_ruta'
  | 'en_punto'
  | 'asignacion'
  | 'capacitacion'
  | 'simulacion'
  | 'suspension'
  | 'lista_negra'
  | 'retirado'
  | 'activo'
  | 'inactivo'
  | 'desconocido';

const TONE_CLASS: Record<ConductorEstadoTone, string> = {
  disponible: 'text-emerald-700 dark:text-emerald-300',
  no_disponible: 'text-slate-700 dark:text-slate-300',
  en_servicio: 'text-indigo-700 dark:text-indigo-300',
  en_ruta: 'text-sky-700 dark:text-sky-300',
  en_punto: 'text-cyan-700 dark:text-cyan-300',
  asignacion: 'text-blue-700 dark:text-blue-300',
  capacitacion: 'text-violet-700 dark:text-violet-300',
  simulacion: 'text-purple-700 dark:text-purple-300',
  suspension: 'text-amber-800 dark:text-amber-300',
  lista_negra: 'text-rose-700 dark:text-rose-300',
  retirado: 'text-red-700 dark:text-red-300',
  activo: 'text-emerald-700 dark:text-emerald-300',
  inactivo: 'text-zinc-600 dark:text-zinc-400',
  desconocido: 'text-orange-700 dark:text-orange-300',
};

function resolveConductorEstadoTone(estado: string | undefined | null): ConductorEstadoTone {
  if (!estado?.trim()) return 'desconocido';

  const value = estado.toUpperCase().trim();

  if (value === 'DESCONOCIDO') return 'desconocido';
  if (value.includes('LISTA NEGRA')) return 'lista_negra';
  if (value === 'RETIRADO') return 'retirado';
  if (value === 'PERMISO TEMPORAL') return 'suspension';
  if (value.includes('CAPACITACION') || value.includes('CAPACITACIÓN')) return 'capacitacion';
  if (value.includes('SIMULACION') || value.includes('SIMULACIÓN')) return 'simulacion';
  if (value === 'ACTIVO') return 'activo';
  if (value === 'INACTIVO') return 'inactivo';
  if (value === 'ASIGNACION AUTOMATICA') return 'asignacion';
  if (value.includes('CAMINO AL SERVICIO')) return 'en_ruta';
  if (value === 'EN EL PUNTO') return 'en_punto';
  if (value.includes('SERVICIO EN PROCESO')) return 'en_servicio';
  if (
    value.includes('NO DISPONIBLE') ||
    value.includes('CERRAR SES') ||
    value.includes('SESION CERRADA')
  ) {
    return 'no_disponible';
  }
  if (value === 'DISPONIBLE' || (value.includes('DISPONIBLE') && !value.includes('NO'))) {
    return 'disponible';
  }

  return 'desconocido';
}

export function conductorEstadoBadgeClass(estado: string | undefined | null): string {
  const tone = resolveConductorEstadoTone(estado);
  return TONE_CLASS[tone];
}

export function conductorEstadoLabel(estado: string | undefined | null): string {
  if (!estado?.trim()) return '—';
  return estado;
}

export function conductorEstadoBadgeProps(estado: string | undefined | null): {
  label: string;
  className: string;
} {
  return {
    label: conductorEstadoLabel(estado),
    className: cn(
      'block max-w-full truncate text-[13px] leading-snug',
      conductorEstadoBadgeClass(estado),
    ),
  };
}
