/**
 * Colores de etapa por slug (tema / Tailwind). Fallback cuando aún no hay catálogo CRM
 * o la etapa no tiene color válido en configuración.
 */

import type { CSSProperties } from 'react';
import type { CrmConfigBundle } from '@/lib/crmConfigApi';
import { stageBadgeStyleFromCatalogColor } from '@/lib/stageCatalogColors';

const FALLBACK_BADGE = 'border-border bg-muted text-text-secondary';

export type StageBadgeTone = {
  className: string;
  style?: CSSProperties;
};

/** Clases para Badge de etapa (sin borde, para uso con border-0 en Linked*Card) */
export const etapaColors: Record<string, string> = {
  lead: 'bg-stage-lead/15 text-stage-lead',
  contacto: 'bg-stage-prospect/15 text-stage-prospect',
  reunion_agendada: 'bg-stage-prospect/15 text-stage-prospect',
  reunion_efectiva: 'bg-info/15 text-info',
  propuesta_economica: 'bg-activity-task/15 text-activity-task',
  negociacion: 'bg-activity-note/15 text-activity-note',
  licitacion: 'bg-activity-note/15 text-activity-note',
  licitacion_etapa_final: 'bg-warning/15 text-warning',
  cierre_ganado: 'bg-stage-client/15 text-stage-client',
  firma_contrato: 'bg-stage-client/15 text-stage-client',
  activo: 'bg-stage-client/15 text-stage-client',
  cierre_perdido: 'bg-stage-lost/15 text-stage-lost',
  inactivo: 'bg-muted text-text-tertiary',
};

/** Con borde para tablas y listas (Opportunities, etc.) */
export const etapaColorsWithBorder: Record<string, string> = {
  lead: 'border-stage-lead/30 bg-stage-lead/15 text-stage-lead',
  contacto: 'border-stage-prospect/30 bg-stage-prospect/15 text-stage-prospect',
  reunion_agendada: 'border-stage-prospect/30 bg-stage-prospect/15 text-stage-prospect',
  reunion_efectiva: 'border-info/30 bg-info/15 text-info',
  propuesta_economica: 'border-activity-task/30 bg-activity-task/15 text-activity-task',
  negociacion: 'border-activity-note/30 bg-activity-note/15 text-activity-note',
  licitacion: 'border-activity-note/30 bg-activity-note/15 text-activity-note',
  licitacion_etapa_final: 'border-warning/30 bg-warning/15 text-warning',
  cierre_ganado: 'border-stage-client/30 bg-stage-client/15 text-stage-client',
  firma_contrato: 'border-stage-client/30 bg-stage-client/15 text-stage-client',
  activo: 'border-stage-client/30 bg-stage-client/15 text-stage-client',
  cierre_perdido: 'border-stage-lost/30 bg-stage-lost/15 text-stage-lost',
  inactivo: 'border-border bg-muted text-text-secondary',
};

/**
 * Tono del badge de etapa: prioriza `color` del catálogo CRM (Ajustes);
 * si no hay bundle, etapa o color válido, usa `etapaColorsWithBorder`.
 */
export function getStageBadgeTone(
  bundle: CrmConfigBundle | null | undefined,
  slug: string | null | undefined,
): StageBadgeTone {
  if (!slug) {
    return { className: FALLBACK_BADGE };
  }
  const row = bundle?.catalog?.stages?.find((s) => s.slug === slug);
  const raw = row?.color?.trim();
  if (raw) {
    const style = stageBadgeStyleFromCatalogColor(raw);
    if (style) {
      return {
        className: 'border border-solid',
        style,
      };
    }
  }
  return {
    className: etapaColorsWithBorder[slug] ?? FALLBACK_BADGE,
    style: undefined,
  };
}
