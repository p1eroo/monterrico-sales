import { Prisma } from '../generated/prisma';

export type AuditDiffEntry = {
  fieldKey: string;
  fieldLabel: string;
  oldValue: string;
  newValue: string;
};

export function stringifyAuditValue(v: unknown): string {
  if (v === Prisma.JsonNull || v === Prisma.DbNull) {
    return '';
  }
  if (v === null || v === undefined) {
    return '';
  }
  if (typeof v === 'bigint') {
    return v.toString();
  }
  if (v instanceof Date) {
    return v.toISOString();
  }
  if (typeof v === 'object') {
    return JSON.stringify(v);
  }
  return String(v);
}

/** Compara `patch` con `before` y genera filas solo donde el valor efectivo cambia. */
export function buildChangeEntries(
  before: Record<string, unknown>,
  patch: Record<string, unknown>,
  fieldLabels: Record<string, string>,
  omitKeys: readonly string[] = [],
): AuditDiffEntry[] {
  const omit = new Set(omitKeys);
  const out: AuditDiffEntry[] = [];
  for (const key of Object.keys(patch)) {
    if (omit.has(key)) continue;
    const prev =
      key in before ? before[key] : undefined;
    const oldV = stringifyAuditValue(prev);
    const newV = stringifyAuditValue(patch[key]);
    if (oldV === newV) continue;
    out.push({
      fieldKey: key,
      fieldLabel: fieldLabels[key] ?? key,
      oldValue: oldV,
      newValue: newV,
    });
  }
  return out;
}
