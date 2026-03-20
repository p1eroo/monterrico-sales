/**
 * Configuración centralizada de colores para badges de etapas.
 * Usado por LinkedContactsCard, LinkedOpportunitiesCard, Opportunities, etc.
 */

/** Clases para Badge de etapa (sin borde, para uso con border-0 en Linked*Card) */
export const etapaColors: Record<string, string> = {
  lead: 'bg-slate-100 text-slate-700',
  contacto: 'bg-blue-100 text-blue-700',
  reunion_agendada: 'bg-indigo-100 text-indigo-700',
  reunion_efectiva: 'bg-cyan-100 text-cyan-700',
  propuesta_economica: 'bg-purple-100 text-purple-700',
  negociacion: 'bg-amber-100 text-amber-700',
  licitacion: 'bg-amber-100 text-amber-700',
  licitacion_etapa_final: 'bg-amber-100 text-amber-700',
  cierre_ganado: 'bg-emerald-100 text-emerald-700',
  firma_contrato: 'bg-emerald-100 text-emerald-700',
  activo: 'bg-emerald-100 text-emerald-700',
  cierre_perdido: 'bg-red-100 text-red-700',
  inactivo: 'bg-gray-100 text-gray-500',
};

/** Con borde para tablas y listas (Opportunities, etc.) */
export const etapaColorsWithBorder: Record<string, string> = {
  lead: 'bg-slate-100 text-slate-700 border-slate-200',
  contacto: 'bg-blue-100 text-blue-700 border-blue-200',
  reunion_agendada: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  reunion_efectiva: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  propuesta_economica: 'bg-purple-100 text-purple-700 border-purple-200',
  negociacion: 'bg-amber-100 text-amber-700 border-amber-200',
  licitacion: 'bg-amber-100 text-amber-700 border-amber-200',
  licitacion_etapa_final: 'bg-amber-100 text-amber-700 border-amber-200',
  cierre_ganado: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  firma_contrato: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  activo: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  cierre_perdido: 'bg-red-100 text-red-700 border-red-200',
  inactivo: 'bg-gray-100 text-gray-700 border-gray-200',
};
