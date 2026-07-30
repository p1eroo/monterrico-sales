import type { CreateActivityPayload, UpdateActivityPayload } from '@/lib/activityApi';
import { isLikelyCompanyCuid } from '@/lib/companyApi';
import type { TaskDetailTask } from '@/components/shared/TaskDetailDialog';
import type { TaskFormResult } from '@/components/shared/TaskFormDialog';
import type { TaskAssociation } from '@/types';

/** Quita duplicados exactos (mismo tipo + id). */
export function normalizeTaskAssociations(assocs?: TaskAssociation[]): TaskAssociation[] {
  const seen = new Set<string>();
  const out: TaskAssociation[] = [];
  for (const assoc of assocs ?? []) {
    const key = `${assoc.type}:${assoc.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(assoc);
  }
  return out;
}

/** Añade o quita un asociado sin afectar los demás. */
export function toggleTaskAssociation(
  prev: TaskAssociation[],
  assoc: TaskAssociation,
  checked: boolean,
): TaskAssociation[] {
  if (!checked) {
    return prev.filter((a) => !(a.type === assoc.type && a.id === assoc.id));
  }
  if (prev.some((a) => a.type === assoc.type && a.id === assoc.id)) {
    return prev;
  }
  return [...prev, assoc];
}

export function associationIdsFromTaskAssociations(assocs?: TaskAssociation[]) {
  const normalized = normalizeTaskAssociations(assocs);
  return {
    contactIds: normalized.filter((a) => a.type === 'contacto').map((a) => a.id),
    companyIds: normalized
      .filter((a) => a.type === 'empresa' && isLikelyCompanyCuid(a.id))
      .map((a) => a.id),
    opportunityIds: normalized.filter((a) => a.type === 'negocio').map((a) => a.id),
    clienteEmpresaIds: normalized
      .filter((a) => a.type === 'cliente_empresa')
      .map((a) => a.id),
  };
}

function associationLinkKey(assocs?: TaskAssociation[]): string {
  const ids = associationIdsFromTaskAssociations(assocs);
  return JSON.stringify({
    contactIds: [...ids.contactIds].sort(),
    companyIds: [...ids.companyIds].sort(),
    opportunityIds: [...ids.opportunityIds].sort(),
    clienteEmpresaIds: [...ids.clienteEmpresaIds].sort(),
  });
}

export function taskAssociationsChanged(
  prev?: TaskAssociation[],
  next?: TaskAssociation[],
): boolean {
  return associationLinkKey(prev) !== associationLinkKey(next);
}

export function taskFormHasEntityLinks(data: TaskFormResult): boolean {
  const links = associationIdsFromTaskAssociations(
    normalizeTaskAssociations(data.associations),
  );
  return (
    links.contactIds.length > 0 ||
    links.companyIds.length > 0 ||
    links.opportunityIds.length > 0 ||
    links.clienteEmpresaIds.length > 0
  );
}

export function buildCreateTaskPayloadFromForm(data: TaskFormResult): CreateActivityPayload {
  const links = associationIdsFromTaskAssociations(
    normalizeTaskAssociations(data.associations),
  );
  return {
    type: 'tarea',
    taskKind: data.type,
    title: data.title,
    description: '',
    assignedTo: data.assignee,
    status: data.status,
    priority: data.priority,
    dueDate: data.dueDate,
    startDate: data.startDate,
    startTime: data.startTime,
    ...(data.status === 'completada'
      ? { completedAt: new Date().toISOString().slice(0, 10) }
      : {}),
    contactIds: links.contactIds,
    companyIds: links.companyIds,
    opportunityIds: links.opportunityIds,
    clienteEmpresaIds: links.clienteEmpresaIds,
  };
}

export function buildTaskDetailUpdatePayload(
  oldDetail: TaskDetailTask,
  next: TaskDetailTask,
  options?: { previousAssigneeId?: string },
): UpdateActivityPayload {
  const payload: UpdateActivityPayload = {};

  if (next.title !== oldDetail.title) payload.title = next.title;
  if (next.status !== oldDetail.status) {
    payload.status = next.status;
    if (next.status === 'completada') {
      payload.completedAt = new Date().toISOString().slice(0, 10);
    }
  }
  if (next.type !== oldDetail.type) payload.taskKind = next.type;
  if (next.dueDate !== oldDetail.dueDate) payload.dueDate = next.dueDate;
  if (next.startDate !== oldDetail.startDate) payload.startDate = next.startDate;
  if (next.startTime !== oldDetail.startTime) payload.startTime = next.startTime;
  if ((next.priority ?? 'media') !== (oldDetail.priority ?? 'media')) {
    payload.priority = next.priority ?? 'media';
  }

  if (
    next.assigneeId &&
    next.assigneeId !== options?.previousAssigneeId
  ) {
    payload.assignedTo = next.assigneeId;
  }

  if (taskAssociationsChanged(oldDetail.associations, next.associations)) {
    const links = associationIdsFromTaskAssociations(next.associations);
    payload.contactIds = links.contactIds;
    payload.companyIds = links.companyIds;
    payload.opportunityIds = links.opportunityIds;
    payload.clienteEmpresaIds = links.clienteEmpresaIds;
  }

  return payload;
}
