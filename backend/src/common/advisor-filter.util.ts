import type { Prisma } from '../generated/prisma';

/** Token: registros con assignedTo = null */
export const ADVISOR_UNASSIGNED = '__unassigned__';
/** Token: asignados a usuarios fuera del pool de asesores activos */
export const ADVISOR_OTHERS = '__others__';
/** Token: selección vacía → ningún resultado */
export const ADVISOR_NONE = '__none__';

export type ParsedAdvisorFilter = {
  userIds: string[];
  includeUnassigned: boolean;
  includeOthers: boolean;
  /** Pool de asesores activos (para calcular “Otros”) */
  advisorPool: string[];
  /** true = no aplicar filtro de asesor */
  unrestricted: boolean;
  /** true = forzar 0 resultados */
  matchNone: boolean;
  /**
   * Legacy: IDs a excluir; null y no-excluidos siguen visibles.
   * Si está definido, tiene prioridad sobre el modo inclusión.
   */
  legacyExcludeIds?: string[];
};

function splitCsv(raw?: string): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Interpreta assignedTo / excludeAssignedTo / advisorPool del query.
 * - assignedTo puede incluir IDs reales y tokens __unassigned__ / __others__ / __none__
 * - excludeAssignedTo (legacy): excluye IDs; null y fuera de esa lista siguen visibles
 */
export function parseAdvisorFilterQuery(opts: {
  assignedTo?: string;
  excludeAssignedTo?: string;
  advisorPool?: string;
}): ParsedAdvisorFilter {
  const advisorPool = splitCsv(opts.advisorPool);
  const assignedRaw = opts.assignedTo?.trim();
  const excludeRaw = opts.excludeAssignedTo?.trim();

  if (!assignedRaw && !excludeRaw) {
    return {
      userIds: [],
      includeUnassigned: false,
      includeOthers: false,
      advisorPool,
      unrestricted: true,
      matchNone: false,
    };
  }

  // Preferir assignedTo (nuevo modelo de inclusión) si viene presente
  if (assignedRaw) {
    const tokens = splitCsv(assignedRaw);
    if (tokens.includes(ADVISOR_NONE) || tokens.length === 0) {
      return {
        userIds: [],
        includeUnassigned: false,
        includeOthers: false,
        advisorPool,
        unrestricted: false,
        matchNone: true,
      };
    }
    const includeUnassigned = tokens.includes(ADVISOR_UNASSIGNED);
    const includeOthers = tokens.includes(ADVISOR_OTHERS);
    const userIds = tokens.filter(
      (t) =>
        t !== ADVISOR_UNASSIGNED &&
        t !== ADVISOR_OTHERS &&
        t !== ADVISOR_NONE,
    );
    return {
      userIds,
      includeUnassigned,
      includeOthers,
      advisorPool,
      unrestricted: false,
      matchNone: false,
    };
  }

  const excludeIds = splitCsv(excludeRaw);
  if (excludeIds.length === 0) {
    return {
      userIds: [],
      includeUnassigned: false,
      includeOthers: false,
      advisorPool,
      unrestricted: true,
      matchNone: false,
    };
  }
  return {
    userIds: [],
    includeUnassigned: false,
    includeOthers: false,
    advisorPool,
    unrestricted: false,
    matchNone: false,
    legacyExcludeIds: excludeIds,
  };
}

function appendAnd(
  w: { AND?: unknown },
  clause: unknown,
): void {
  const existingAnd = Array.isArray(w.AND)
    ? w.AND
    : w.AND
      ? [w.AND]
      : [];
  w.AND = [...existingAnd, clause];
}

/** Condición OR sobre assignedTo para Contact / Opportunity / Activity. */
export function advisorAssignedToOrClauses(
  parsed: ParsedAdvisorFilter,
): Array<Record<string, unknown>> {
  if (parsed.unrestricted || parsed.matchNone) return [];

  if (parsed.legacyExcludeIds && parsed.legacyExcludeIds.length > 0) {
    return [
      { assignedTo: null },
      { assignedTo: { notIn: parsed.legacyExcludeIds } },
    ];
  }

  const clauses: Array<Record<string, unknown>> = [];

  if (parsed.userIds.length === 1) {
    clauses.push({ assignedTo: parsed.userIds[0] });
  } else if (parsed.userIds.length > 1) {
    clauses.push({ assignedTo: { in: parsed.userIds } });
  }

  if (parsed.includeUnassigned) {
    clauses.push({ assignedTo: null });
  }

  if (parsed.includeOthers) {
    const pool = parsed.advisorPool;
    if (pool.length > 0) {
      clauses.push({
        AND: [{ assignedTo: { not: null } }, { assignedTo: { notIn: pool } }],
      });
    } else if (parsed.userIds.length > 0) {
      clauses.push({
        AND: [
          { assignedTo: { not: null } },
          { assignedTo: { notIn: parsed.userIds } },
        ],
      });
    } else {
      // Sin pool ni IDs: “otros” = cualquiera asignado
      clauses.push({ assignedTo: { not: null } });
    }
  }

  return clauses;
}

/**
 * Aplica filtro de asesor a un where de entidad con campo assignedTo
 * (contact, opportunity, activity).
 */
export function applySimpleAdvisorFilter(
  w: { assignedTo?: unknown; AND?: unknown; OR?: unknown },
  parsed: ParsedAdvisorFilter,
): void {
  if (parsed.unrestricted) return;
  if (parsed.matchNone) {
    appendAnd(w, { AND: [{ assignedTo: null }, { assignedTo: { not: null } }] });
    return;
  }

  const clauses = advisorAssignedToOrClauses(parsed);
  if (clauses.length === 0) {
    appendAnd(w, { AND: [{ assignedTo: null }, { assignedTo: { not: null } }] });
    return;
  }
  if (clauses.length === 1) {
    const only = clauses[0];
    if ('assignedTo' in only && Object.keys(only).length === 1) {
      w.assignedTo = only.assignedTo;
      return;
    }
    appendAnd(w, only);
    return;
  }
  appendAnd(w, { OR: clauses });
}

/**
 * Filtro de asesor para empresas: IDs reales miran empresa o contactos;
 * sin asignar / otros miran company.assignedTo (columna Asesor de la tabla).
 */
export function companyAdvisorWhere(
  parsed: ParsedAdvisorFilter,
): Prisma.CompanyWhereInput | undefined {
  if (parsed.unrestricted) return undefined;
  if (parsed.matchNone) {
    return { AND: [{ assignedTo: null }, { assignedTo: { not: null } }] };
  }

  if (parsed.legacyExcludeIds && parsed.legacyExcludeIds.length > 0) {
    const excludeIds = parsed.legacyExcludeIds;
    return {
      AND: [
        {
          OR: [
            { assignedTo: null },
            { assignedTo: { notIn: excludeIds } },
          ],
        },
        {
          contacts: {
            none: { contact: { assignedTo: { in: excludeIds } } },
          },
        },
      ],
    };
  }

  const orParts: Prisma.CompanyWhereInput[] = [];

  if (parsed.userIds.length > 0) {
    orParts.push({
      OR: [
        {
          assignedTo:
            parsed.userIds.length === 1
              ? parsed.userIds[0]
              : { in: parsed.userIds },
        },
        {
          contacts: {
            some: {
              contact: {
                assignedTo:
                  parsed.userIds.length === 1
                    ? parsed.userIds[0]
                    : { in: parsed.userIds },
              },
            },
          },
        },
      ],
    });
  }

  if (parsed.includeUnassigned) {
    orParts.push({ assignedTo: null });
  }

  if (parsed.includeOthers) {
    const pool = parsed.advisorPool;
    if (pool.length > 0) {
      orParts.push({
        AND: [{ assignedTo: { not: null } }, { assignedTo: { notIn: pool } }],
      });
    } else if (parsed.userIds.length > 0) {
      orParts.push({
        AND: [
          { assignedTo: { not: null } },
          { assignedTo: { notIn: parsed.userIds } },
        ],
      });
    } else {
      orParts.push({ assignedTo: { not: null } });
    }
  }

  if (orParts.length === 0) {
    return { AND: [{ assignedTo: null }, { assignedTo: { not: null } }] };
  }
  if (orParts.length === 1) return orParts[0];
  return { OR: orParts };
}
