import { useState, useMemo, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, Car, UserPlus, Download, Loader2 } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { subMonths } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { MetricCard } from '@/components/shared/MetricCard';
import { formatCurrency } from '@/lib/formatters';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { getConductores, type Conductor } from '@/lib/flotaConductoresApi';

const REPORTES_MOCK = {
  prospectosMes: 45,
  prospectosMesPrev: 38,
  conversionMes: 12,
  conversionMesPrev: 9,
  conductoresNuevos: 8,
  conductoresNuevosPrev: 5,
  conductoresActivos: 156,
  conductoresInactivos: 24,
  ingresosMes: 289000,
  ingresosMesPrev: 245000,
};

const PROSPECTOS_BY_MONTH = [
  { name: 'Ene', nuevos: 12, conversion: 3 },
  { name: 'Feb', nuevos: 15, conversion: 4 },
  { name: 'Mar', nuevos: 18, conversion: 5 },
  { name: 'Abr', nuevos: 10, conversion: 2 },
  { name: 'May', nuevos: 22, conversion: 6 },
  { name: 'Jun', nuevos: 25, conversion: 8 },
];

const FUENTE_DATA = [
  { name: 'Web', value: 35 },
  { name: 'Facebook', value: 25 },
  { name: 'Referido', value: 20 },
  { name: 'Instagram', value: 15 },
  { name: 'TikTok', value: 5 },
];

const ZONA_DATA = [
  { name: 'Lima Centro', value: 28 },
  { name: 'Miraflores', value: 18 },
  { name: 'Surco', value: 15 },
  { name: 'Barranco', value: 12 },
  { name: 'Other', value: 27 },
];

export default function FlotaReportes() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subMonths(new Date(), 6),
    to: new Date(),
  });
  const [conductores, setConductores] = useState<Conductor[]>([]);
  const [loadingSunat, setLoadingSunat] = useState(true);

  const data = useMemo(() => REPORTES_MOCK, []);

  useEffect(() => {
    async function load() {
      setLoadingSunat(true);
      try {
        const all = await getConductores();
        setConductores(Array.isArray(all) ? all : []);
      } catch {
        setConductores([]);
      } finally {
        setLoadingSunat(false);
      }
    }
    void load();
  }, []);

  const sunatAutorizados = useMemo(() => {
    return conductores.filter(
      (c) => c.codigo?.startsWith('1S') && c.estado !== 'RETIRADO'
    );
  }, [conductores]);

  const sunatByEstado = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of sunatAutorizados) {
      const estado = c.estado || '(Vacío)';
      map[estado] = (map[estado] || 0) + 1;
    }
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [sunatAutorizados]);

  const changeTone = (change: number) => {
    if (change > 0) return 'positive';
    if (change < 0) return 'negative';
    return 'neutral';
  };

  const prospectosChange = ((data.prospectosMes - data.prospectosMesPrev) / data.prospectosMesPrev * 100).toFixed(0);
  const conversionChange = ((data.conversionMes - data.conversionMesPrev) / data.conversionMesPrev * 100).toFixed(0);
  const conductoresChange = ((data.conductoresNuevos - data.conductoresNuevosPrev) / data.conductoresNuevosPrev * 100).toFixed(0);
  const ingresosChange = ((data.ingresosMes - data.ingresosMesPrev) / data.ingresosMesPrev * 100).toFixed(0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes Flota"
        description="Métricas de prospectos y conductores"
      >
        <div className="flex items-center gap-2">
          <DateRangePicker 
            value={dateRange} 
            onChange={setDateRange} 
            className="w-[260px]"
          />
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="size-4" />
            Exportar
          </Button>
        </div>
      </PageHeader>

      {/* KPI Row 1 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Prospectos Nuevos"
          value={data.prospectosMes}
          change={`+${prospectosChange}% vs mes anterior`}
          changeType={changeTone(Number(prospectosChange))}
          icon={UserPlus}
        />
        <MetricCard
          title="Conversiones"
          value={data.conversionMes}
          change={`+${conversionChange}% vs mes anterior`}
          changeType={changeTone(Number(conversionChange))}
          icon={TrendingUp}
        />
        <MetricCard
          title="Conductores Nuevos"
          value={data.conductoresNuevos}
          change={`+${conductoresChange}% vs mes anterior`}
          changeType={changeTone(Number(conductoresChange))}
          icon={Car}
        />
        <MetricCard
          title="Ingresos Flota"
          value={formatCurrency(data.ingresosMes)}
          change={`+${ingresosChange}% vs mes anterior`}
          changeType={changeTone(Number(ingresosChange))}
          icon={Users}
        />
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Conductores por Estado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <div className="size-3 rounded-full bg-emerald-500" />
                    Activos
                  </span>
                  <span className="font-medium">{data.conductoresActivos}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${(data.conductoresActivos / (data.conductoresActivos + data.conductoresInactivos)) * 100}%` }} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <div className="size-3 rounded-full bg-red-500" />
                    Inactivos
                  </span>
                  <span className="font-medium">{data.conductoresInactivos}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-red-500" style={{ width: `${(data.conductoresInactivos / (data.conductoresActivos + data.conductoresInactivos)) * 100}%` }} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Prospectos por Fuente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {FUENTE_DATA.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{item.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 rounded-full bg-primary/20 overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${item.value}%` }} />
                    </div>
                    <span className="font-medium w-8 text-right">{item.value}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Prospectos por Zona</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {ZONA_DATA.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{item.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 rounded-full bg-primary/20 overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${item.value}%` }} />
                    </div>
                    <span className="font-medium w-8 text-right">{item.value}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: 2 columns */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Conversion Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Conversión Mensual</CardTitle>
            <CardDescription>Prospectos convertidos a conductores por mes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-32">
              {PROSPECTOS_BY_MONTH.map((item) => (
                <div key={item.name} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex flex-col items-center gap-1">
                    <div
                      className="w-8 rounded-t bg-primary"
                      style={{ height: `${item.conversion * 4}px` }}
                      title={`${item.conversion} conversiones`}
                    />
                    <span className="text-[10px] text-muted-foreground">{item.nuevos}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{item.name}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-center gap-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="size-3 rounded bg-primary" />
                Prospectos nuevos
              </div>
              <div className="flex items-center gap-1">
                <div className="size-3 rounded bg-muted-foreground/30" />
                Conversiones
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SUNAT - Conductores Autorizados */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">SUNAT - Cond. Autorizados</CardTitle>
            <CardDescription>
              Conductores con código 1S (excluyendo RETIRADO)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingSunat ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{sunatAutorizados.length}</span>
                  <span className="text-sm text-muted-foreground">conductores autorizados</span>
                </div>
                <div className="space-y-2.5">
                  {sunatByEstado.map((item) => {
                    const pct = sunatAutorizados.length > 0
                      ? Math.round((item.count / sunatAutorizados.length) * 100)
                      : 0;
                    return (
                      <div key={item.name} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground truncate max-w-[160px]">{item.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium tabular-nums">{item.count}</span>
                            <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-primary/15 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}