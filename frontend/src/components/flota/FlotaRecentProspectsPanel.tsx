import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowUpRight, MapPin, Phone } from 'lucide-react';
import { ChartCardTitle } from '@/components/shared/ChartCardTitle';
import { flotaDashboardChartDescriptions } from '@/lib/dashboardChartDescriptions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { flotaEstadoBadgeClass } from '@/lib/flotaEstadoUi';
import type { FlotaProspectoRow } from '@/lib/flotaProspectosApi';
import { cn } from '@/lib/utils';

type FlotaRecentProspectsPanelProps = {
  prospects: FlotaProspectoRow[];
  loading?: boolean;
  className?: string;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function FlotaRecentProspectsPanel({
  prospects,
  loading,
  className,
}: FlotaRecentProspectsPanelProps) {
  const navigate = useNavigate();

  return (
    <Card className={cn('flex flex-col py-0', className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2 pt-5">
        <div className="min-w-0 flex-1 space-y-1">
          <ChartCardTitle
            title="Prospectos recientes"
            info={flotaDashboardChartDescriptions.prospectosRecientes}
          />
          <p className="text-xs text-muted-foreground">
            Últimos registros en la flota · clic para abrir ficha
          </p>
        </div>
        <Button variant="ghost" size="sm" className="h-8 shrink-0 gap-1 text-xs" asChild>
          <Link to="/flota/prospectos">
            Ver todos
            <ArrowUpRight className="size-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 px-5 pb-5 pt-0">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
            ))}
          </div>
        ) : prospects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 py-12 text-center">
            <p className="text-sm font-medium text-foreground">Sin prospectos recientes</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Los nuevos registros aparecerán aquí automáticamente.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {prospects.map((prospect) => {
              const when = prospect.createdAt
                ? formatDistanceToNow(new Date(prospect.createdAt), {
                    addSuffix: true,
                    locale: es,
                  })
                : null;

              return (
                <button
                  key={prospect.id}
                  type="button"
                  onClick={() => navigate(`/flota/prospectos/${prospect.id}`)}
                  className="group flex w-full items-center gap-3 rounded-xl border border-border/70 bg-card/40 px-3 py-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/[0.03]"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {initials(prospect.nombreCompleto)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                        {prospect.nombreCompleto}
                      </p>
                      <span
                        className={cn(
                          'inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                          flotaEstadoBadgeClass(prospect.estado),
                        )}
                      >
                        {prospect.estado}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {prospect.celular ? (
                        <span className="inline-flex items-center gap-1 font-mono">
                          <Phone className="size-3 shrink-0 opacity-70" />
                          {prospect.celular}
                        </span>
                      ) : null}
                      {prospect.distrito ? (
                        <span className="inline-flex items-center gap-1 truncate">
                          <MapPin className="size-3 shrink-0 opacity-70" />
                          {prospect.distrito}
                        </span>
                      ) : null}
                      {prospect.redSocial ? (
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium capitalize">
                          {prospect.redSocial}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    {when ? (
                      <p className="text-[11px] text-muted-foreground">{when}</p>
                    ) : null}
                    <p className="mt-0.5 text-[10px] text-muted-foreground/80">
                      {prospect.createdAt
                        ? new Date(prospect.createdAt).toLocaleDateString('es-PE', {
                            day: '2-digit',
                            month: 'short',
                          })
                        : '—'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
