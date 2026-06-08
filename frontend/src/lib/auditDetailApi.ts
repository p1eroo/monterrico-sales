import type { AuditLog } from '@/types';
import { api } from '@/lib/api';

export type AuditDetailPageResponse = {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export function fetchAuditDetailLogs(params: {
  page?: number;
  limit?: number;
  search?: string;
  userId?: string;
  module?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
}): Promise<AuditDetailPageResponse> {
  const sp = new URLSearchParams();
  if (params.page != null) sp.set('page', String(params.page));
  if (params.limit != null) sp.set('limit', String(params.limit));
  if (params.search?.trim()) sp.set('search', params.search.trim());
  if (params.userId?.trim()) sp.set('userId', params.userId.trim());
  if (params.module?.trim()) sp.set('module', params.module.trim());
  if (params.action?.trim()) sp.set('action', params.action.trim());
  if (params.entityType?.trim()) sp.set('entityType', params.entityType.trim());
  if (params.entityId?.trim()) sp.set('entityId', params.entityId.trim());
  const q = sp.toString();
  return api<AuditDetailPageResponse>(`/audit-detail${q ? `?${q}` : ''}`);
}
