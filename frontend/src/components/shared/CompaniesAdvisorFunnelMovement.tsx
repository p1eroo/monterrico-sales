import { useCallback, useEffect, useRef, useState, type UIEvent, type WheelEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Building2,
  ChevronRight,
  Equal,
  Loader2,
} from 'lucide-react';
import type {
  AdvisorFunnelMovementCardData,
  AdvisorFunnelMovementSnapshot,
} from '@/lib/companiesAdvisorMovement';
import {
  fetchAdvisorFunnelMovementCompanies,
  type AdvisorFunnelMovementCompaniesPage,
  type AdvisorFunnelMovementDetailQuery,
  type AdvisorFunnelMovementMetricKey,
} from '@/lib/analyticsApi';
import { companyDetailHref } from '@/lib/detailRoutes';
import { Pagination } from '@/components/shared/Pagination';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { comercialProPopoverClass } from '@/lib/comercialFilterSurface';
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

const METRIC_CONFIG: Record<
  AdvisorFunnelMovementMetricKey,
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

const METRIC_ORDER: AdvisorFunnelMovementMetricKey[] = [
  'nuevoIngreso',
  'avance',
  'atraso',
  'sinCambios',
];

const PAGE_SIZE = 25;

function stopScrollBubble(e: UIEvent | WheelEvent) {
  e.stopPropagation();
}

function MetricCompaniesPopover({
  metricKey,
  value,
  total,
  advisorId,
  advisorName,
  period,
  detailQuery,
}: {
  metricKey: AdvisorFunnelMovementMetricKey;
  value: number;
  total: number;
  advisorId: string;
  advisorName: string;
  period: Pick<
    AdvisorFunnelMovementSnapshot,
    'fromWeekLabel' | 'toWeekLabel' | 'toWeekNumber'
  >;
  detailQuery: AdvisorFunnelMovementDetailQuery;
}) {
  const config = METRIC_CONFIG[metricKey];
  const Icon = config.icon;
  const disabled = value <= 0;

  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AdvisorFunnelMovementCompaniesPage | null>(
    null,
  );
  const listRef = useRef<HTMLDivElement>(null);

  const loadPage = useCallback(
    async (nextPage: number) => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchAdvisorFunnelMovementCompanies({
          ...detailQuery,
          advisorId,
          metric: metricKey,
          toWeekNumber: period.toWeekNumber,
          page: nextPage,
          limit: PAGE_SIZE,
        });
        setResult(data);
        setPage(data.page);
        listRef.current?.scrollTo({ top: 0 });
      } catch (err) {
        const message =
          err instanceof Error && err.message.trim()
            ? err.message
            : 'No se pudo cargar la lista de empresas.';
        setError(message);
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    [advisorId, detailQuery, metricKey, period.toWeekNumber],
  );

  useEffect(() => {
    if (!open || disabled) return;
    void loadPage(1);
  }, [open, disabled, loadPage]);

  useEffect(() => {
    if (!open) {
      setPage(1);
      setResult(null);
      setError(null);
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'w-full rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5 text-left transition-colors',
            disabled
              ? 'cursor-default opacity-80'
              : 'cursor-pointer hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
          )}
          aria-label={
            disabled
              ? `${config.label}: sin empresas`
              : `Ver empresas en ${config.label.toLowerCase()}`
          }
        >
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
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={8}
        collisionPadding={12}
        className={cn(
          comercialProPopoverClass,
          'z-[120] flex w-[min(92vw,24rem)] max-h-[min(72vh,26rem)] flex-col overflow-hidden p-0 shadow-none',
        )}
        onWheel={stopScrollBubble}
        onTouchMove={stopScrollBubble}
      >
        <div
          className={cn(
            'shrink-0 border-b border-border/60 px-4 py-3',
            'bg-gradient-to-r from-transparent via-transparent to-transparent',
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <span
                className={cn(
                  'inline-flex size-8 shrink-0 items-center justify-center rounded-lg shadow-sm',
                  config.iconWrapClass,
                )}
              >
                <Icon className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight text-foreground">
                  {config.label}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {advisorName}
                </p>
                <p className="mt-1 inline-flex items-center rounded-md bg-muted/70 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                  {period.fromWeekLabel} → {period.toWeekLabel}
                </p>
              </div>
            </div>
            {result && !loading ? (
              <span className="shrink-0 rounded-full bg-foreground/5 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-foreground">
                {result.total}
              </span>
            ) : null}
          </div>
        </div>

        <div
          ref={listRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-1.5 [scrollbar-gutter:stable]"
          onWheel={stopScrollBubble}
          onTouchMove={stopScrollBubble}
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Cargando empresas…
            </div>
          ) : error ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {error}
            </p>
          ) : result && result.data.length > 0 ? (
            <ul className="space-y-0.5">
              {result.data.map((company) => (
                <li key={company.id}>
                  <Link
                    to={companyDetailHref(company)}
                    className="group flex items-center gap-2.5 rounded-xl border border-transparent px-2.5 py-2 transition-colors hover:border-border/60 hover:bg-white/80 dark:hover:bg-neutral-800/80"
                    onClick={() => setOpen(false)}
                  >
                    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                      <Building2 className="size-3.5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {company.name}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {company.etapaLabel}
                      </p>
                    </span>
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Sin empresas en esta categoría.
            </p>
          )}
        </div>

        {result && result.total > 0 ? (
          <div
            className="shrink-0 border-t border-border/60 bg-white/50 px-2 py-2 dark:bg-neutral-900/50"
            onWheel={stopScrollBubble}
          >
            <Pagination
              page={page}
              totalPages={Math.max(1, result.totalPages)}
              totalItems={result.total}
              pageSize={result.limit}
              onPageChange={(next) => void loadPage(next)}
            />
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function AdvisorMovementCard({
  advisor,
  period,
  detailQuery,
}: {
  advisor: AdvisorFunnelMovementCardData;
  period: Pick<
    AdvisorFunnelMovementSnapshot,
    'fromWeekLabel' | 'toWeekLabel' | 'toWeekNumber'
  >;
  detailQuery: AdvisorFunnelMovementDetailQuery;
}) {
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
            <h3 className="truncate text-sm font-semibold text-foreground">
              {advisor.name}
            </h3>
            <p className="text-xs text-muted-foreground">
              Cartera en etapas 10%–100%
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-semibold tabular-nums text-foreground">
            {total}
          </p>
          <p className="text-[11px] font-medium text-muted-foreground">
            prosp. activos
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2.5">
        {METRIC_ORDER.map((key) => (
          <MetricCompaniesPopover
            key={key}
            metricKey={key}
            value={advisor.metrics[key]}
            total={total}
            advisorId={advisor.id}
            advisorName={advisor.name}
            period={period}
            detailQuery={detailQuery}
          />
        ))}
      </div>
    </article>
  );
}

interface CompaniesAdvisorFunnelMovementProps {
  data: AdvisorFunnelMovementSnapshot;
  detailQuery: AdvisorFunnelMovementDetailQuery;
  className?: string;
}

export function CompaniesAdvisorFunnelMovement({
  data,
  detailQuery,
  className,
}: CompaniesAdvisorFunnelMovementProps) {
  return (
    <section className={cn(className)}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {data.advisors.length === 0 ? (
          <div className="col-span-full flex min-h-[12rem] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
            Sin movimiento por asesor en esta semana.
          </div>
        ) : (
          data.advisors.map((advisor) => (
            <AdvisorMovementCard
              key={advisor.id}
              advisor={advisor}
              period={{
                fromWeekLabel: data.fromWeekLabel,
                toWeekLabel: data.toWeekLabel,
                toWeekNumber: data.toWeekNumber,
              }}
              detailQuery={detailQuery}
            />
          ))
        )}
      </div>
    </section>
  );
}
