/**
 * Convierte la celda de etapa del import (slug, nombre, % entero o formato funnel decimal)
 * al porcentaje del catálogo CRM.
 *
 * Formato funnel histórico: 0.1 = 10 %, 1 = 100 %, -0.01 = -1 %, 0 = 0 %.
 */
export function normalizeEtapaPercentFromCsvCell(raw: string): number | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return null;

  const pctClean = trimmed.replace(/%/g, '').trim().replace(',', '.');
  const pctNum = Number.parseFloat(pctClean);
  if (!Number.isFinite(pctNum)) return null;

  if (pctNum === 0) return 0;

  if (trimmed.includes('%')) {
    return Math.round(pctNum);
  }

  const hasDecimalSep = /[.,]/.test(pctClean);

  if (pctNum === 1) {
    return 100;
  }

  if (pctNum === -1 && !hasDecimalSep) {
    return -1;
  }

  if (!Number.isInteger(pctNum) && Math.abs(pctNum) <= 1) {
    return Math.round(pctNum * 100);
  }

  return Math.round(pctNum);
}
