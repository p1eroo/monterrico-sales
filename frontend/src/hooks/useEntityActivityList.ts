import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import type { Activity } from '@/types';
import {
  fetchActivitiesList,
  type UpdateActivityPayload,
} from '@/lib/activityApi';

export type EntityActivitiesQuery = {
  linkedToCompanyId?: string;
  linkedToContactId?: string;
  linkedToOpportunityId?: string;
  linkedToClienteEmpresa?: string;
  linkedToContactoCliente?: string;
  type?: string;
  excludeType?: string;
};

function hasLink(query: EntityActivitiesQuery | null): query is EntityActivitiesQuery {
  if (!query) return false;
  return Boolean(
    query.linkedToCompanyId?.trim() ||
      query.linkedToContactId?.trim() ||
      query.linkedToOpportunityId?.trim() ||
      query.linkedToClienteEmpresa?.trim() ||
      query.linkedToContactoCliente?.trim(),
  );
}

function mergeStaleFetch(
  serverRows: Activity[],
  local: Activity[],
  deletedIds: Set<string>,
): Activity[] {
  const filtered = serverRows.filter((row) => !deletedIds.has(row.id));
  const serverIds = new Set(filtered.map((row) => row.id));
  const extras = local.filter((row) => !serverIds.has(row.id) && !deletedIds.has(row.id));
  const localById = new Map(local.map((row) => [row.id, row]));
  const merged = filtered.map((row) => localById.get(row.id) ?? row);
  return [...extras, ...merged];
}

/**
 * Lista de actividades de una ficha, pedida al backend (no a la caché global).
 * Las mutaciones locales invalidan fetches en vuelo para no pisar altas nuevas.
 */
export function useEntityActivityList(query: EntityActivitiesQuery | null) {
  const [activities, setActivitiesState] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const seqRef = useRef(0);
  const deletedIdsRef = useRef(new Set<string>());

  const setActivities = useCallback((update: SetStateAction<Activity[]>) => {
    seqRef.current += 1;
    setActivitiesState(update);
  }, []);

  const reload = useCallback(async () => {
    if (!hasLink(query)) {
      seqRef.current += 1;
      setActivitiesState([]);
      setLoading(false);
      return;
    }
    const gen = ++seqRef.current;
    setLoading(true);
    try {
      const rows = await fetchActivitiesList({
        linkedToCompanyId: query.linkedToCompanyId,
        linkedToContactId: query.linkedToContactId,
        linkedToOpportunityId: query.linkedToOpportunityId,
        linkedToClienteEmpresa: query.linkedToClienteEmpresa,
        linkedToContactoCliente: query.linkedToContactoCliente,
        type: query.type,
        excludeType: query.excludeType,
        limit: 500,
      });
      if (gen !== seqRef.current) {
        setActivitiesState((prev) => mergeStaleFetch(rows, prev, deletedIdsRef.current));
        return;
      }
      setActivitiesState(rows.filter((row) => !deletedIdsRef.current.has(row.id)));
    } catch {
      if (gen !== seqRef.current) return;
      setActivitiesState([]);
    } finally {
      if (gen === seqRef.current) setLoading(false);
    }
  }, [
    query?.linkedToCompanyId,
    query?.linkedToContactId,
    query?.linkedToOpportunityId,
    query?.linkedToClienteEmpresa,
    query?.linkedToContactoCliente,
    query?.type,
    query?.excludeType,
  ]);

  useEffect(() => {
    deletedIdsRef.current = new Set();
    void reload();
  }, [reload]);

  const syncUpdated = useCallback((updated: Activity) => {
    setActivities((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
  }, [setActivities]);

  const syncDeleted = useCallback((id: string) => {
    deletedIdsRef.current.add(id);
    setActivities((prev) => prev.filter((row) => row.id !== id));
  }, [setActivities]);

  const wrapUpdate = useCallback(
    (updateActivity: (id: string, payload: UpdateActivityPayload) => Promise<Activity>) =>
      async (id: string, payload: UpdateActivityPayload) => {
        const updated = await updateActivity(id, payload);
        syncUpdated(updated);
        return updated;
      },
    [syncUpdated],
  );

  const wrapDelete = useCallback(
    (deleteActivity: (id: string) => Promise<void>) =>
      async (id: string) => {
        await deleteActivity(id);
        syncDeleted(id);
      },
    [syncDeleted],
  );

  return {
    activities,
    setActivities,
    loading,
    reload,
    wrapUpdate,
    wrapDelete,
  };
}
