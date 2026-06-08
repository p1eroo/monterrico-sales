/** Slugs de etapas iniciales del CRM (no se pueden eliminar del catálogo). */
export const SYSTEM_STAGE_SLUGS = new Set([
  'lead',
  'contacto',
  'reunion_agendada',
  'reunion_efectiva',
  'propuesta_economica',
  'negociacion',
  'licitacion',
  'licitacion_etapa_final',
  'cierre_ganado',
  'firma_contrato',
  'activo',
  'cierre_perdido',
  'inactivo',
]);

export const SEED_LEAD_SOURCES: { slug: string; name: string }[] = [
  { slug: 'referido', name: 'Referido' },
  { slug: 'base', name: 'Base' },
  { slug: 'entorno', name: 'Entorno' },
  { slug: 'feria', name: 'Feria' },
  { slug: 'masivo', name: 'Masivo' },
];

export const SEED_STAGES: {
  slug: string;
  name: string;
  color: string;
  probability: number;
  isSystem: boolean;
}[] = [
  { slug: 'lead', name: 'Lead', color: '#64748b', probability: 0, isSystem: true },
  { slug: 'contacto', name: 'Contacto', color: '#3b82f6', probability: 10, isSystem: true },
  {
    slug: 'reunion_agendada',
    name: 'Reunión Agendada',
    color: '#6366f1',
    probability: 30,
    isSystem: true,
  },
  {
    slug: 'reunion_efectiva',
    name: 'Reunión Efectiva',
    color: '#06b6d4',
    probability: 40,
    isSystem: true,
  },
  {
    slug: 'propuesta_economica',
    name: 'Propuesta Económica',
    color: '#8b5cf6',
    probability: 50,
    isSystem: true,
  },
  { slug: 'negociacion', name: 'Negociación', color: '#f97316', probability: 70, isSystem: true },
  { slug: 'licitacion', name: 'Licitación', color: '#f59e0b', probability: 75, isSystem: true },
  {
    slug: 'licitacion_etapa_final',
    name: 'Licitación Etapa Final',
    color: '#eab308',
    probability: 85,
    isSystem: true,
  },
  { slug: 'cierre_ganado', name: 'Cierre Ganado', color: '#22c55e', probability: 90, isSystem: true },
  {
    slug: 'firma_contrato',
    name: 'Firma de Contrato',
    color: '#16a34a',
    probability: 95,
    isSystem: true,
  },
  { slug: 'activo', name: 'Activo', color: '#15803d', probability: 100, isSystem: true },
  { slug: 'cierre_perdido', name: 'Cierre Perdido', color: '#ef4444', probability: -1, isSystem: true },
  { slug: 'inactivo', name: 'Inactivo', color: '#6b7280', probability: -5, isSystem: true },
];

/** Si el slug no existe aún en BD (migración, registros legacy). */
export const STAGE_PROBABILITY_FALLBACK: Record<string, number> = Object.fromEntries(
  SEED_STAGES.map((s) => [s.slug, s.probability]),
);

export const SEED_PRIORITIES: {
  slug: string;
  name: string;
  color: string;
  description: string;
}[] = [
  {
    slug: 'alta',
    name: 'Alta',
    color: '#ef4444',
    description: 'Atención inmediata requerida',
  },
  {
    slug: 'media',
    name: 'Media',
    color: '#f59e0b',
    description: 'Seguimiento regular programado',
  },
  {
    slug: 'baja',
    name: 'Baja',
    color: '#3b82f6',
    description: 'Sin urgencia, atender cuando sea posible',
  },
];

export const SEED_ACTIVITY_TYPES: { slug: string; name: string }[] = [
  { slug: 'llamada', name: 'Llamada' },
  { slug: 'reunion', name: 'Reunión' },
  { slug: 'tarea', name: 'Tarea' },
  { slug: 'correo', name: 'Correo' },
  { slug: 'whatsapp', name: 'WhatsApp' },
];

export const SYSTEM_PRIORITY_SLUGS = new Set(SEED_PRIORITIES.map((p) => p.slug));
export const SYSTEM_ACTIVITY_SLUGS = new Set(SEED_ACTIVITY_TYPES.map((a) => a.slug));
