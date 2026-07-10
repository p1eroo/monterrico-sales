import { ArrowDown, ArrowRight, ArrowUp, Equal } from 'lucide-react';
import type {
  AdvisorFunnelMovementCardData,
  AdvisorFunnelMovementSnapshot,
} from '@/lib/companiesAdvisorMovement';
import { cn } from '@/lib/utils';

function movementPct(value: number, total: number): string {
  if (total <= 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

function advisorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

type MetricKey = keyof AdvisorFunnelMovementCardData['metrics'];

const METRIC_CONFIG: Record<
  MetricKey,
  {
    label: string;
    shortLabel: string;
    icon: typeof ArrowUp;
    iconWrapClass: string;
    pctClass: string;
  }
> = {
  nuevoIngreso: {
    label: 'Nuevo ingreso',
    shortLabel: 'Nuevo',
    icon: ArrowUp,
    iconWrapClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    pctClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  avance: {
    label: 'Avance',
    shortLabel: 'Avance',
    icon: ArrowRight,
    iconWrapClass: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
    pctClass: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
  atraso: {
    label: 'Atraso',
    shortLabel: 'Atraso',
    icon: ArrowDown,
    iconWrapClass: 'bg-red-500/10 text-red-700 dark:text-red-300',
    pctClass: 'bg-red-500/10 text-red-700 dark:text-red-300',
  },
  sinCambios: {
    label: 'Sin cambio',
    shortLabel: 'Sin cambio',
    icon: Equal,
    iconWrapClass: 'bg-muted text-muted-foreground',
    pctClass: 'bg-muted text-muted-foreground',
  },
};

const METRIC_ORDER: MetricKey[] = ['nuevoIngreso', 'avance', 'atraso', 'sinCambios'];

function MetricTile({
  metricKey,
  value,
  total,
}: {
  metricKey: MetricKey;
  value: number;
  total: number;
}) {
  const config = METRIC_CONFIG[metricKey];
  const Icon = config.icon;

  return (
    <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              'inline-flex size-7 shrink-0 items-center justify-center rounded-md',
              config.iconWrapClass,
            )}
          >
            <Icon className="size-3.5" aria-hidden />
          </span>
          <span className="truncate text-xs font-medium text-muted-foreground">
            <span className="hidden sm:inline">{config.label}</span>
            <span className="sm:hidden">{config.shortLabel}</span>
          </span>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
            config.pctClass,
          )}
        >
          {movementPct(value, total)}
        </span>
      </div>
      <p className="text-xl font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </p>
    </div>
  );
}

function AdvisorMovementCard({ advisor }: { advisor: AdvisorFunnelMovementCardData }) {
  const total = advisor.activeProspects;

  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <header className="mb-4 flex items-start justify-between gap-3 border-b border-border/70 pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              'inline-flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-2 ring-inset',
              advisor.accentClass,
            )}
          >
            {advisorInitials(advisor.name)}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground">{advisor.name}</h3>
            <p className="text-xs text-muted-foreground">Cartera en etapas 10%–100%</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-semibold tabular-nums text-foreground">{total}</p>
          <p className="text-[11px] font-medium text-muted-foreground">prosp. activos</p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2.5">
        {METRIC_ORDER.map((key) => (
          <MetricTile key={key} metricKey={key} value={advisor.metrics[key]} total={total} />
        ))}
      </div>
    </article>
  );
}

interface CompaniesAdvisorFunnelMovementProps {
  data: AdvisorFunnelMovementSnapshot;
  className?: string;
}

export function CompaniesAdvisorFunnelMovement({
  data,
  className,
}: CompaniesAdvisorFunnelMovementProps) {
  return (
    <section className={cn('space-y-5', className)}>
      <div className="rounded-lg border border-border/80 bg-muted/20 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{data.title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Comparación {data.fromWeekLabel} → {data.toWeekLabel}
          {data.currentWeekLabel ? (
            <>
              {' '}
              · semana en curso {data.currentWeekLabel}
            </>
          ) : null}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {data.advisors.length === 0 ? (
          <div className="col-span-full flex min-h-[12rem] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
            Sin movimiento por asesor en esta semana.
          </div>
        ) : (
          data.advisors.map((advisor) => (
            <AdvisorMovementCard key={advisor.id} advisor={advisor} />
          ))
        )}
      </div>
    </section>
  );
}
