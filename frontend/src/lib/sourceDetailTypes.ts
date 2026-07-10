export type SourceStageSlice = {
  slug: string;
  label: string;
  shortLabel: string;
  count: number;
  color: string;
  probability: number;
};

/** Detalle ampliado de una fuente (solo empresas, etapas 10%–100%). */
export type SourceDetail = {
  slug: string;
  name: string;
  accentColor: string;
  companyCount: number;
  estimatedBilling: number;
  stages: SourceStageSlice[];
  hot70Count: number;
  hot70Billing: number;
};

/** % de empresas que avanzaron más allá de Contacto (10%). */
export function sourceAdvanceRate(detail: SourceDetail): number {
  const total = detail.stages.reduce((sum, s) => sum + s.count, 0);
  if (total <= 0) return 0;
  const contacto =
    detail.stages.find((s) => s.slug === 'contacto')?.count ?? 0;
  const advanced = total - contacto;
  return Math.round((advanced / total) * 1000) / 10;
}
