import { useState, useMemo, useEffect } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { MetricCard } from '@/components/shared/MetricCard';
import { FlotaRecentProspectsPanel } from '@/components/flota/FlotaRecentProspectsPanel';
import { FlotaEstadoDistributionCard } from '@/components/flota/FlotaEstadoDistributionCard';
import { FlotaConductoresWeeklyCard } from '@/components/flota/FlotaConductoresWeeklyCard';
import { FlotaSunatGestionCard } from '@/components/flota/FlotaSunatGestionCard';
import { useFlotaReportesData } from '@/hooks/useFlotaReportesData';
import { flotaDashboardKpiDescriptions } from '@/lib/dashboardChartDescriptions';
import {
  flotaProspectosList,
  flotaProspectosCounts,
  type FlotaProspectoRow,
  type FlotaProspectosCounts,
} from '@/lib/flotaProspectosApi';

function changeTone(s: string): 'positive' | 'negative' | 'neutral' {
  const t = s.trim();
  if (t.startsWith('-')) return 'negative';
  if (t.startsWith('+')) return 'positive';
  return 'neutral';
}

export default function FlotaDashboard() {
  const { conductores } = useFlotaReportesData();
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<FlotaProspectosCounts | null>(null);
  const [recentProspects, setRecentProspects] = useState<FlotaProspectoRow[]>([]);

  const activeConductores = useMemo(
    () =>
      conductores.filter((c) => c.estado === 'ACTIVO' || c.estado === 'DISPONIBLE').length,
    [conductores],
  );

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      try {
        const [c, recent] = await Promise.all([
          flotaProspectosCounts(),
          flotaProspectosList({ limit: 5 }),
        ]);
        setCounts(c);
        setRecentProspects(recent.data);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }
    void loadDashboardData();
  }, []);

  const kpis = useMemo(() => {
    if (!counts) {
      return {
        contactados: 0,
        sinContactar: 0,
        convertidos: 0,
        total: 0,
        nuevosEsteMes: 0,
        nuevosMesPasado: 0,
        nuevosChange: 0,
      };
    }

    const sinContactar = counts.estadoCounts['Nuevo'] || counts.estadoCounts['NUEVO'] || 0;
    const convertidos =
      (counts.estadoCounts['AFILIADO'] || 0) + (counts.estadoCounts['Afiliado'] || 0);
    const total = counts.total;
    const contactados = total - sinContactar - convertidos;

    let nuevosChange = 0;
    if (counts.nuevosMesPasado > 0) {
      nuevosChange =
        ((counts.nuevosEsteMes - counts.nuevosMesPasado) / counts.nuevosMesPasado) * 100;
    } else if (counts.nuevosEsteMes > 0) {
      nuevosChange = 100;
    }

    return {
      contactados,
      sinContactar,
      convertidos,
      total,
      nuevosEsteMes: counts.nuevosEsteMes,
      nuevosMesPasado: counts.nuevosMesPasado,
      nuevosChange,
    };
  }, [counts]);

  const nuevosChangeLabel =
    kpis.nuevosChange === 0
      ? '0%'
      : `${kpis.nuevosChange > 0 ? '+' : ''}${kpis.nuevosChange.toFixed(0)}%`;

  const nuevosSparkline = [4, 6, 5, 9, 8, kpis.nuevosEsteMes];
  const contactadosSparkline = [30, 35, 32, 40, 42, kpis.contactados];
  const sinContactarSparkline = [28, 25, 26, 24, 22, kpis.sinContactar];
  const conductoresSparkline = [140, 145, 148, 152, 154, activeConductores];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Flota"
        description="Resumen de prospectos y conductores de Taxi Monterrico"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Prospectos Nuevos"
          info={flotaDashboardKpiDescriptions.nuevosProspectos}
          value={kpis.nuevosEsteMes}
          change={loading ? undefined : nuevosChangeLabel}
          changeType={changeTone(nuevosChangeLabel)}
          description="vs mes anterior"
          sparklineData={nuevosSparkline}
          sparklineColor="#3b82f6"
          sparklineVariant="line"
          sparklineLoading={loading}
          loading={loading}
        />
        <MetricCard
          title="Contactados"
          info={flotaDashboardKpiDescriptions.contactados}
          value={kpis.contactados}
          description="En el periodo actual"
          sparklineData={contactadosSparkline}
          sparklineColor="#22c55e"
          sparklineVariant="line"
          sparklineLoading={loading}
          loading={loading}
        />
        <MetricCard
          title="Sin Contactar"
          info={flotaDashboardKpiDescriptions.sinContactar}
          value={kpis.sinContactar}
          description="En el periodo actual"
          sparklineData={sinContactarSparkline}
          sparklineColor="#f59e0b"
          sparklineVariant="line"
          sparklineLoading={loading}
          loading={loading}
        />
        <MetricCard
          title="Conductores Activos"
          info={flotaDashboardKpiDescriptions.conductoresActivos}
          value={activeConductores}
          description="Estado ACTIVO o DISPONIBLE"
          sparklineData={conductoresSparkline}
          sparklineColor="#1DB954"
          sparklineVariant="line"
          sparklineLoading={loading}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
        <FlotaConductoresWeeklyCard />
        <FlotaSunatGestionCard />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:items-stretch">
        <FlotaRecentProspectsPanel
          className="lg:col-span-3"
          prospects={recentProspects}
          loading={loading}
        />
        <FlotaEstadoDistributionCard
          className="lg:col-span-2"
          estadoCounts={counts?.estadoCounts ?? {}}
          total={kpis.total}
          convertidos={kpis.convertidos}
          sinContactar={kpis.sinContactar}
          loading={loading}
        />
      </div>
    </div>
  );
}
