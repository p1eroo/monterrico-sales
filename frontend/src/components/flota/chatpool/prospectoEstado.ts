export const FLOTA_PROSPECTO_ESTADOS = [
  'Nuevo',
  'Afiliado',
  'Citado',
  'Seguimiento',
  'Informacion',
  'Sin Requisitos',
  'No Responde',
] as const;

export type FlotaProspectoEstado = (typeof FLOTA_PROSPECTO_ESTADOS)[number];

export function formatProspectoEstado(status: string): string {
  if (!status) return '';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

export function prospectoEstadoLabel(prospectoId: string, estado: string) {
  return {
    id: `est-${prospectoId}`,
    name: estado,
    color: 'blue',
    inboxId: 'flota-whatsapp',
  };
}
