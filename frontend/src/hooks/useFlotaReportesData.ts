import { useEffect } from 'react';
import { format } from 'date-fns';
import type { DateRangeValue } from '@/components/shared/DateRangeCalendar';
import { useFlotaReportesStore } from '@/store/flotaReportesStore';

/**
 * Datos base de reportes flota (prospectos + conductores) con caché en memoria
 * entre navegaciones, al estilo de reportes comercial (sin polling ni realtime).
 */
export function useFlotaReportesData() {
  const conductores = useFlotaReportesStore((s) => s.conductores);
  const prospectos = useFlotaReportesStore((s) => s.prospectos);
  const baseLoaded = useFlotaReportesStore((s) => s.baseLoaded);
  const baseLoading = useFlotaReportesStore((s) => s.baseLoading);
  const loadBaseData = useFlotaReportesStore((s) => s.loadBaseData);

  useEffect(() => {
    void loadBaseData();
  }, [loadBaseData]);

  const loadingProspectos = baseLoading && !baseLoaded;
  const loadingConductores = baseLoading && !baseLoaded;

  return {
    conductores,
    prospectos,
    loadingProspectos,
    loadingConductores,
    refreshBaseData: () => loadBaseData({ force: true }),
  };
}

export function useFlotaReportesOperadorStats(dateRange: DateRangeValue | undefined) {
  const operadorStats = useFlotaReportesStore((s) => s.operadorStats);
  const operadorNames = useFlotaReportesStore((s) => s.operadorNames);
  const operadorStatsRange = useFlotaReportesStore((s) => s.operadorStatsRange);
  const operadorStatsLoading = useFlotaReportesStore((s) => s.operadorStatsLoading);
  const loadOperadorStats = useFlotaReportesStore((s) => s.loadOperadorStats);

  useEffect(() => {
    if (!dateRange?.from || !dateRange?.to) return;
    const fecini = format(dateRange.from, 'yyyy-MM-dd');
    const fecfin = format(dateRange.to, 'yyyy-MM-dd');
    void loadOperadorStats(fecini, fecfin);
  }, [
    dateRange?.from?.getTime(),
    dateRange?.to?.getTime(),
    loadOperadorStats,
  ]);

  const rangeKey =
    dateRange?.from && dateRange?.to
      ? `${format(dateRange.from, 'yyyy-MM-dd')}|${format(dateRange.to, 'yyyy-MM-dd')}`
      : null;
  const hasCachedRange = rangeKey !== null && operadorStatsRange === rangeKey;
  const loadingOperadorStats =
    operadorStatsLoading && !(hasCachedRange && operadorStats.length > 0);

  return { operadorStats, operadorNames, loadingOperadorStats };
}

export function useFlotaReportesSunat(sunatDateRange: DateRangeValue | undefined) {
  const sunatHistory = useFlotaReportesStore((s) => s.sunatHistory);
  const sunatRange = useFlotaReportesStore((s) => s.sunatRange);
  const sunatLoading = useFlotaReportesStore((s) => s.sunatLoading);
  const loadSunatHistory = useFlotaReportesStore((s) => s.loadSunatHistory);

  useEffect(() => {
    if (!sunatDateRange?.from || !sunatDateRange?.to) return;
    const fecini = format(sunatDateRange.from, 'yyyy-MM-dd');
    const fecfin = format(sunatDateRange.to, 'yyyy-MM-dd');
    void loadSunatHistory(fecini, fecfin);
  }, [
    sunatDateRange?.from?.getTime(),
    sunatDateRange?.to?.getTime(),
    loadSunatHistory,
  ]);

  const rangeKey =
    sunatDateRange?.from && sunatDateRange?.to
      ? `${format(sunatDateRange.from, 'yyyy-MM-dd')}|${format(sunatDateRange.to, 'yyyy-MM-dd')}`
      : null;
  const hasCachedRange = rangeKey !== null && sunatRange === rangeKey;
  const loadingSunatReal =
    sunatLoading && !(hasCachedRange && sunatHistory.length > 0);

  return { sunatHistory, loadingSunatReal };
}
