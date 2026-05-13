import { useState, useMemo, useEffect } from 'react';
import { UserPlus, Car, Phone, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { PremiumMetricCard } from '@/components/shared/PremiumMetricCard';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  flotaProspectosList, 
  flotaProspectosCounts, 
  type FlotaProspectoRow, 
  type FlotaProspectosCounts 
} from '@/lib/flotaProspectosApi';
import { getConductores } from '@/lib/flotaConductoresApi';

export default function FlotaDashboard() {
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<FlotaProspectosCounts | null>(null);
  const [activeConductores, setActiveConductores] = useState<number>(0);
  const [recentProspects, setRecentProspects] = useState<FlotaProspectoRow[]>([]);

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      try {
        const [c, conductors, recent] = await Promise.all([
          flotaProspectosCounts(),
          getConductores(),
          flotaProspectosList({ limit: 5 })
        ]);
        setCounts(c);
        setActiveConductores(conductors.filter(c => c.estado === 'ACTIVO' || c.estado === 'DISPONIBLE').length);
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
    if (!counts) return {
      contactados: 0,
      sinContactar: 0,
      convertidos: 0,
      total: 0,
      nuevosEsteMes: 0,
      nuevosMesPasado: 0,
      nuevosChange: 0
    };

    const sinContactar = counts.estadoCounts['Nuevo'] || counts.estadoCounts['NUEVO'] || 0;
    const convertidos = (counts.estadoCounts['AFILIADO'] || 0) + (counts.estadoCounts['Afiliado'] || 0);
    const total = counts.total;
    const contactados = total - sinContactar - convertidos;
    
    let nuevosChange = 0;
    if (counts.nuevosMesPasado > 0) {
      nuevosChange = ((counts.nuevosEsteMes - counts.nuevosMesPasado) / counts.nuevosMesPasado) * 100;
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
      nuevosChange
    };
  }, [counts]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Flota"
        description="Resumen de prospectos y conductores de Taxi Monterrico"
      />

      {/* KPI Row - Premium Design */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PremiumMetricCard
          title="Prospectos Nuevos"
          value={kpis.nuevosEsteMes}
          change={Number(kpis.nuevosChange.toFixed(0))}
          icon={UserPlus}
          color="blue"
          loading={loading}
          sparklineData={[
            { value: 4 }, { value: 6 }, { value: 5 }, { value: 9 }, { value: 8 }, { value: kpis.nuevosEsteMes }
          ]}
        />
        <PremiumMetricCard
          title="Contactados"
          value={kpis.contactados}
          change={0}
          icon={Phone}
          color="emerald"
          loading={loading}
          sparklineData={[
            { value: 30 }, { value: 35 }, { value: 32 }, { value: 40 }, { value: 42 }, { value: kpis.contactados }
          ]}
        />
        <PremiumMetricCard
          title="Sin Contactar"
          value={kpis.sinContactar}
          change={0}
          icon={AlertTriangle}
          color="amber"
          loading={loading}
          sparklineData={[
            { value: 28 }, { value: 25 }, { value: 26 }, { value: 24 }, { value: 22 }, { value: kpis.sinContactar }
          ]}
        />
        <PremiumMetricCard
          title="Conductores Activos"
          value={activeConductores}
          change={0}
          icon={Car}
          color="emerald"
          loading={loading}
          sparklineData={[
            { value: 140 }, { value: 145 }, { value: 148 }, { value: 152 }, { value: 154 }, { value: activeConductores }
          ]}
        />
      </div>

      {/* Quick Actions & Recent */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Prospectos Recientes</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-[200px]" />
                      <Skeleton className="h-3 w-[150px]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y">
                {recentProspects.map((prospect) => (
                  <div key={prospect.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary font-medium text-sm">
                        {prospect.nombreCompleto.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{prospect.nombreCompleto}</p>
                        <p className="text-xs text-muted-foreground">{prospect.celular || '—'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        prospect.estado === 'Nuevo' ? 'bg-blue-100 text-blue-700' :
                        prospect.estado === 'AFILIADO' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {prospect.estado}
                      </span>
                      <p className="text-xs text-muted-foreground mt-1">
                        {prospect.createdAt ? new Date(prospect.createdAt).toLocaleDateString() : '—'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base"> Estado general</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Contactados</span>
                <span className="font-medium">{kpis.contactados}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-500" 
                  style={{ width: `${kpis.total > 0 ? (kpis.contactados / kpis.total) * 100 : 0}%` }} 
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Sin contactar</span>
                <span className="font-medium">{kpis.sinContactar}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div 
                  className="h-full bg-amber-500 transition-all duration-500" 
                  style={{ width: `${kpis.total > 0 ? (kpis.sinContactar / kpis.total) * 100 : 0}%` }} 
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Convertidos</span>
                <span className="font-medium">{kpis.convertidos}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-500" 
                  style={{ width: `${kpis.total > 0 ? (kpis.convertidos / kpis.total) * 100 : 0}%` }} 
                />
              </div>
            </div>
            <div className="pt-4 border-t border-border/50">
              <p className="text-xs text-muted-foreground text-center">
                Total de prospectos: <span className="font-semibold text-foreground">{kpis.total}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}