import { useState, useMemo } from 'react';
import { Users, UserPlus, Car, TrendingUp, Phone, MessageSquare, Clock, AlertTriangle, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { MetricCard } from '@/components/shared/MetricCard';
import { formatCurrency } from '@/lib/formatters';
import { Skeleton } from '@/components/ui/skeleton';

const FLAOTA_MOCK_KPIS = {
  prospectosNuevos: 12,
  prospectosNuevosPrev: 8,
  conversionTasa: 15,
  conductoresActivos: 156,
  conductoresInactivos: 24,
  prospectosContactados: 45,
  prospectosSinContacto: 23,
  totalProspectos: 80,
};

const FLAOTA_WEEKLY_DATA = [
  { name: 'Ene', nuevos: 5, conversion: 2 },
  { name: 'Feb', nuevos: 8, conversion: 1 },
  { name: 'Mar', nuevos: 12, conversion: 3 },
  { name: 'Abr', nuevos: 6, conversion: 1 },
];

const RECENT_PROSPECTS = [
  { id: '1', name: 'Juan Pérez López', telefono: '+51 999 111 222', estado: 'Nuevo', fecha: '2026-05-05' },
  { id: '2', name: 'María García Torres', telefono: '+51 999 333 444', estado: 'Contactado', fecha: '2026-05-04' },
  { id: '3', name: 'Carlos Mendoza Soto', telefono: '+51 999 555 666', estado: 'Conversión', fecha: '2026-05-03' },
  { id: '4', name: 'Ana López Rivera', telefono: '+51 999 777 888', estado: 'Nuevo', fecha: '2026-05-02' },
  { id: '5', name: 'Pedro Castro Ruiz', telefono: '+51 999 000 111', estado: 'NoInteresado', fecha: '2026-05-01' },
];

export default function FlotaDashboard() {
  const [loading] = useState(false);

  const kpis = useMemo(() => FLAOTA_MOCK_KPIS, []);
  const weeklyData = useMemo(() => FLAOTA_WEEKLY_DATA, []);
  const recentProspects = useMemo(() => RECENT_PROSPECTS, []);

  const changeTone = (change: number) => {
    if (change > 0) return 'positive';
    if (change < 0) return 'negative';
    return 'neutral';
  };

  const prospectosChange = ((kpis.prospectosNuevos - kpis.prospectosNuevosPrev) / kpis.prospectosNuevosPrev * 100).toFixed(0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Flota"
        description="Resumen de prospectos y conductores de Taxi Monterrico"
      />

      {/* KPI Row 1 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Prospectos Nuevos"
          value={kpis.prospectosNuevos}
          change={`+${prospectosChange}% vs mes anterior`}
          changeType={changeTone(Number(prospectosChange))}
          icon={UserPlus}
          loading={loading}
        />
        <MetricCard
          title="Tasa Conversión"
          value={`${kpis.conversionTasa}%`}
          changeType="neutral"
          icon={TrendingUp}
          loading={loading}
        />
        <MetricCard
          title="Conductores Activos"
          value={kpis.conductoresActivos}
          change={`${kpis.conductoresInactivos} inactivos`}
          changeType={kpis.conductoresInactivos > 20 ? 'warning' : 'neutral'}
          icon={Car}
          loading={loading}
        />
        <MetricCard
          title="Total Prospectos"
          value={kpis.totalProspectos}
          changeType="neutral"
          icon={Users}
          loading={loading}
        />
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Contactados"
          value={kpis.prospectosContactados}
          changeType="neutral"
          icon={Phone}
          loading={loading}
        />
        <MetricCard
          title="Sin Contactar"
          value={kpis.prospectosSinContacto}
          changeType={kpis.prospectosSinContacto > 20 ? 'warning' : 'neutral'}
          icon={AlertTriangle}
          loading={loading}
        />
        <MetricCard
          title="WhatsApp Enviados"
          value="234"
          change="+15% vs semana anterior"
          changeType="positive"
          icon={MessageSquare}
          loading={loading}
        />
        <MetricCard
          title="Cartera Estimada"
          value={formatCurrency(450000)}
          changeType="neutral"
          icon={DollarSign}
          loading={loading}
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
                        {prospect.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{prospect.name}</p>
                        <p className="text-xs text-muted-foreground">{prospect.telefono}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        prospect.estado === 'Nuevo' ? 'bg-blue-100 text-blue-700' :
                        prospect.estado === 'Contactado' ? 'bg-amber-100 text-amber-700' :
                        prospect.estado === 'Conversión' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {prospect.estado}
                      </span>
                      <p className="text-xs text-muted-foreground mt-1">{prospect.fecha}</p>
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
                <span className="font-medium">{kpis.prospectosContactados}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${(kpis.prospectosContactados / kpis.totalProspectos) * 100}%` }} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Sin contactar</span>
                <span className="font-medium">{kpis.prospectosSinContacto}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-amber-500" style={{ width: `${(kpis.prospectosSinContacto / kpis.totalProspectos) * 100}%` }} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Convertidos</span>
                <span className="font-medium">12</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: '15%' }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}