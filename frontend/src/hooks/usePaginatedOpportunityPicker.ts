import { useState, useEffect, useCallback, useRef } from 'react';
import {
  opportunityListPaginated,
  type ApiOpportunityListRow,
} from '@/lib/opportunityApi';

export type OpportunityPickerExcludeFilter =
  | { excludeCompanyLinkId: string }
  | { excludeContactLinkId: string };

/**
 * Lista oportunidades paginadas para modales “vincular existente”:
 * búsqueda con debounce (solo cuando hay texto) y “cargar más”.
 *
 * Las dependencias internas usan ids string (no el objeto `filter`) para
 * evitar bucles si el padre recrea `{ exclude… }` en cada render.
 */
export function usePaginatedOpportunityPicker(
  open: boolean,
  search: string,
  filter: OpportunityPickerExcludeFilter | null,
  pageSize = 25,
) {
  const excludeCompanyLinkId =
    filter && 'excludeCompanyLinkId' in filter
      ? filter.excludeCompanyLinkId
      : undefined;
  const excludeContactLinkId =
    filter && 'excludeContactLinkId' in filter
      ? filter.excludeContactLinkId
      : undefined;

  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [items, setItems] = useState<ApiOpportunityListRow[]>([]);
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
    const hasExclude =
      (excludeCompanyLinkId?.trim() ?? '') !== '' ||
      (excludeContactLinkId?.trim() ?? '') !== '';

    if (!open || !hasExclude) {
      requestSeq.current += 1;
      setItems([]);
      setPage(1);
      setTotalPages(1);
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    const params =
      excludeCompanyLinkId != null && excludeCompanyLinkId.trim() !== ''
        ? {
            page: 1,
            limit: pageSize,
            search: debouncedSearch || undefined,
            excludeCompanyLinkId: excludeCompanyLinkId.trim(),
          }
        : {
            page: 1,
            limit: pageSize,
            search: debouncedSearch || undefined,
            excludeContactLinkId: excludeContactLinkId!.trim(),
          };

    const seq = ++requestSeq.current;
    setLoading(true);
    setLoadingMore(false);
    void opportunityListPaginated(params)
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
    excludeCompanyLinkId,
    excludeContactLinkId,
    debouncedSearch,
    pageSize,
  ]);

  const loadMore = useCallback(() => {
    const hasExclude =
      (excludeCompanyLinkId?.trim() ?? '') !== '' ||
      (excludeContactLinkId?.trim() ?? '') !== '';
    if (!open || !hasExclude || loading || loadingMore) return;
    const nextPage = page + 1;
    if (nextPage > totalPages) return;

    const params =
      excludeCompanyLinkId != null && excludeCompanyLinkId.trim() !== ''
        ? {
            page: nextPage,
            limit: pageSize,
            search: debouncedSearch || undefined,
            excludeCompanyLinkId: excludeCompanyLinkId.trim(),
          }
        : {
            page: nextPage,
            limit: pageSize,
            search: debouncedSearch || undefined,
            excludeContactLinkId: excludeContactLinkId!.trim(),
          };

    const seq = requestSeq.current;
    setLoadingMore(true);
    void opportunityListPaginated(params)
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
    excludeCompanyLinkId,
    excludeContactLinkId,
    loading,
    loadingMore,
    page,
    totalPages,
    debouncedSearch,
    pageSize,
  ]);

  const hasMore = page < totalPages;

  return {
    items,
    loading,
    loadingMore,
    hasMore,
    loadMore,
  };
}
