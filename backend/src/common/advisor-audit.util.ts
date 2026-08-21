export type AdvisorIdentity = { id: string; name: string };

export type AdvisorIdentityIndex = {
  userIds: Set<string>;
  nameToId: Map<string, string>;
  nameById: Map<string, string>;
};

export type AdvisorAuditEv = { at: Date; oldValue: string; newValue: string };

/**
 * Índice id/nombre para reconstruir `assignedTo` desde auditoría.
 * Nombres duplicados no se mapean (evita atribuir al usuario equivocado).
 */
export function buildAdvisorIdentityIndex(
  users: AdvisorIdentity[],
): AdvisorIdentityIndex {
  const userIds = new Set<string>();
  const nameById = new Map<string, string>();
  const nameCounts = new Map<string, number>();

  for (const u of users) {
    const id = u.id.trim();
    if (!id) continue;
    userIds.add(id);
    const name = u.name.trim();
    if (name) nameById.set(id, name);
    const key = name.toLowerCase();
    if (key) nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  }

  const nameToId = new Map<string, string>();
  for (const u of users) {
    const id = u.id.trim();
    const key = u.name.trim().toLowerCase();
    if (!id || !key) continue;
    if ((nameCounts.get(key) ?? 0) !== 1) continue;
    nameToId.set(key, id);
  }

  return { userIds, nameToId, nameById };
}

/**
 * Convierte un valor de auditoría `assignedTo` a user id.
 * Acepta ids reales o el nombre único del usuario. Descarta listas de empresas
 * y cualquier texto que no resuelva a un usuario.
 */
export function resolveAdvisorAuditValue(
  raw: string,
  index: AdvisorIdentityIndex,
): string {
  const v = raw.trim();
  if (!v) return '';
  if (index.userIds.has(v)) return v;
  const byName = index.nameToId.get(v.toLowerCase());
  if (byName) return byName;
  if (v.includes(',') || /\s/.test(v)) return '';
  // Id huérfano (usuario borrado): se conserva para no mezclarlo con "sin asignar".
  if (/^[a-z0-9_-]{16,}$/i.test(v)) return v;
  return '';
}

/**
 * Función escalón de asesor (sin fallback `'lead'` de etapas).
 * Audits con nombres o basura se normalizan a user id o se ignoran.
 */
export function buildAdvisorStepFunction(
  createdAt: Date,
  currentAdvisorId: string,
  audits: AdvisorAuditEv[],
  index: AdvisorIdentityIndex,
): (instant: Date) => string {
  const current = resolveAdvisorAuditValue(currentAdvisorId, index);
  const normalized = audits
    .map((a) => ({
      at: a.at,
      oldValue: resolveAdvisorAuditValue(a.oldValue, index),
      newValue: resolveAdvisorAuditValue(a.newValue, index),
    }))
    .filter((a) => a.oldValue || a.newValue)
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const initial =
    normalized.length > 0 && normalized[0]!.oldValue
      ? normalized[0]!.oldValue
      : current;

  const steps: { t: Date; id: string }[] = [{ t: createdAt, id: initial }];
  for (const a of normalized) {
    steps.push({ t: a.at, id: a.newValue });
  }

  return (instant: Date) => {
    let cur = steps[0]!.id;
    for (let i = 1; i < steps.length; i++) {
      if (steps[i]!.t <= instant) cur = steps[i]!.id;
      else break;
    }
    return cur;
  };
}
