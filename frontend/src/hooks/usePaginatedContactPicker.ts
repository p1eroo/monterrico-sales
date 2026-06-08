import { useState, useEffect, useCallback, useRef } from 'react';
import {
  contactListPaginated,
  type ApiContactListRow,
} from '@/lib/contactApi';

export type PaginatedContactPickerOptions = {
  pageSize?: number;
  linkedToCompanyId?: string;
  excludeCompanyLinkId?: string;
  excludeOpportunityLinkId?: string;
  /** Lista global paginada (sin filtros de vínculo empresa/oportunidad) */
  fetchAll?: boolean;
};

/**
 * Contactos paginados para modales “vincular existente” (debounce en búsqueda con texto).
 */
export function usePaginatedContactPicker(
  open: boolean,
  search: string,
  options: PaginatedContactPickerOptions | null,
) {
  const pageSize = options?.pageSize ?? 25;
  const linkedToCompanyId = options?.linkedToCompanyId?.trim() || undefined;
  const excludeCompanyLinkId = options?.excludeCompanyLinkId?.trim() || undefined;
  const excludeOpportunityLinkId =
    options?.excludeOpportunityLinkId?.trim() || undefined;
  const fetchAll = options?.fetchAll === true;

  const shouldFetch =
    !!options &&
    (fetchAll ||
      !!linkedToCompanyId ||
      !!excludeCompanyLinkId ||
      !!excludeOpportunityLinkId);

  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [items, setItems] = useState<ApiContactListRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const requestSeq = useRef(0);

  useEffect(() => {
    if (!open) {
      setDebouncedSearch('');
      return;
    }
    const q = search.trim();
    if (q === '') {
      setDebouncedSearch('');
      return;
    }
    const t = setTimeout(() => setDebouncedSearch(q), 400);
    return () => clearTimeout(t);
  }, [search, open]);

  useEffect(() => {
    if (!open || !shouldFetch) {
      requestSeq.current += 1;
      setItems([]);
      setPage(1);
      setTotalPages(1);
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    const seq = ++requestSeq.current;
    setLoading(true);
    setLoadingMore(false);

    const params: Parameters<typeof contactListPaginated>[0] = {
      page: 1,
      limit: pageSize,
      search: debouncedSearch || undefined,
    };
    if (linkedToCompanyId) params.linkedToCompanyId = linkedToCompanyId;
    else if (excludeCompanyLinkId) params.excludeCompanyLinkId = excludeCompanyLinkId;
    else if (excludeOpportunityLinkId) {
      params.excludeOpportunityLinkId = excludeOpportunityLinkId;
    }

    void contactListPaginated(params)
      .then((res) => {
        if (seq !== requestSeq.current) return;
        setItems(res.data);
        setTotalPages(Math.max(1, res.totalPages));
        setPage(1);
      })
      .catch(() => {
        if (seq !== requestSeq.current) return;
        setItems([]);
        setTotalPages(1);
      })
      .finally(() => {
        if (seq !== requestSeq.current) return;
        setLoading(false);
      });
  }, [
    open,
    shouldFetch,
    linkedToCompanyId,
    excludeCompanyLinkId,
    excludeOpportunityLinkId,
    fetchAll,
    debouncedSearch,
    pageSize,
  ]);

  const loadMore = useCallback(() => {
    if (!open || !shouldFetch || loading || loadingMore) return;
    const nextPage = page + 1;
    if (nextPage > totalPages) return;

    const params: Parameters<typeof contactListPaginated>[0] = {
      page: nextPage,
      limit: pageSize,
      search: debouncedSearch || undefined,
    };
    if (linkedToCompanyId) params.linkedToCompanyId = linkedToCompanyId;
    else if (excludeCompanyLinkId) params.excludeCompanyLinkId = excludeCompanyLinkId;
    else if (excludeOpportunityLinkId) {
      params.excludeOpportunityLinkId = excludeOpportunityLinkId;
    }

    const seq = requestSeq.current;
    setLoadingMore(true);
    void contactListPaginated(params)
      .then((res) => {
        if (seq !== requestSeq.current) return;
        setItems((prev) => {
          const seen = new Set(prev.map((r) => r.id));
          const merged = [...prev];
          for (const row of res.data) {
            if (!seen.has(row.id)) {
              seen.add(row.id);
              merged.push(row);
            }
          }
          return merged;
        });
        setPage(nextPage);
      })
      .catch(() => {
        /* noop */
      })
      .finally(() => {
        if (seq === requestSeq.current) setLoadingMore(false);
      });
  }, [
    open,
    shouldFetch,
    linkedToCompanyId,
    excludeCompanyLinkId,
    excludeOpportunityLinkId,
    loading,
    loadingMore,
    page,
    totalPages,
    debouncedSearch,
    pageSize,
  ]);

  return {
    items,
    loading,
    loadingMore,
    hasMore: page < totalPages,
    loadMore,
  };
}
