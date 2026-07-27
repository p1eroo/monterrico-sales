import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Loader2,
  Mail,
  Phone,
  Target,
  User,
  Users,
} from 'lucide-react';
import {
  fetchActivitiesByAdvisorDetails,
  fetchTasksByAdvisorDetails,
  type ActivitiesByAdvisorDetailRow,
  type ActivitiesByAdvisorDetailsPage,
  type ActivitiesByAdvisorDetailsQuery,
} from '@/lib/analyticsApi';
import {
  companyDetailHref,
  contactDetailHref,
  opportunityDetailHref,
} from '@/lib/detailRoutes';
import { Pagination } from '@/components/shared/Pagination';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 25;

export type AdvisorWeeklyDetailSheetKind = 'activities' | 'tasks';

const SHEET_COPY: Record<
  AdvisorWeeklyDetailSheetKind,
  {
    defaultTitle: string;
    subtitle: string;
    loading: string;
    loadError: string;
    empty: string;
  }
> = {
  activities: {
    defaultTitle: 'Actividades',
    subtitle: 'interacciones completadas',
    loading: 'Cargando actividades…',
    loadError: 'No se pudo cargar el detalle de actividades.',
    empty: 'Sin actividades en esta semana.',
  },
  tasks: {
    defaultTitle: 'Tareas',
    subtitle: 'tareas completadas',
    loading: 'Cargando tareas…',
    loadError: 'No se pudo cargar el detalle de tareas.',
    empty: 'Sin tareas en esta semana.',
  },
};

const TYPE_ICON: Record<string, typeof Phone> = {
  llamada: Phone,
  reunion: Users,
  correo: Mail,
};

function formatCompletedAt(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface ActivitiesByAdvisorDetailSheetProps {
  kind?: AdvisorWeeklyDetailSheetKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  advisorId: string | null;
  advisorName: string | null;
  weekLabel: string | null;
  weekStart: string | null;
  weekEnd: string | null;
  detailQuery: Omit<
    ActivitiesByAdvisorDetailsQuery,
    'advisorId' | 'weekStart' | 'weekEnd' | 'page' | 'limit'
  >;
}

export function ActivitiesByAdvisorDetailSheet({
  kind = 'activities',
  open,
  onOpenChange,
  advisorId,
  advisorName,
  weekLabel,
  weekStart,
  weekEnd,
  detailQuery,
}: ActivitiesByAdvisorDetailSheetProps) {
  const copy = SHEET_COPY[kind];
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ActivitiesByAdvisorDetailsPage | null>(
    null,
  );

  const loadPage = useCallback(
    async (nextPage: number) => {
      if (!advisorId || !weekStart || !weekEnd) return;
      setLoading(true);
      setError(null);
      try {
        const fetchDetails =
          kind === 'tasks'
            ? fetchTasksByAdvisorDetails
            : fetchActivitiesByAdvisorDetails;
        const data = await fetchDetails({
          ...detailQuery,
          advisorId,
          weekStart,
          weekEnd,
          page: nextPage,
          limit: PAGE_SIZE,
        });
        setResult(data);
        setPage(data.page);
      } catch (err) {
        const message =
          err instanceof Error && err.message.trim()
            ? err.message
            : copy.loadError;
        setError(message);
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    [advisorId, copy.loadError, detailQuery, kind, weekEnd, weekStart],
  );

  useEffect(() => {
    if (!open || !advisorId || !weekStart || !weekEnd) return;
    void loadPage(1);
  }, [open, advisorId, weekStart, weekEnd, loadPage]);

  useEffect(() => {
    if (!open) {
      setPage(1);
      setResult(null);
      setError(null);
    }
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="shrink-0 border-b border-border/60 px-5 py-4 text-left">
          <SheetTitle className="text-base">
            {advisorName ?? result?.advisorName ?? copy.defaultTitle}
          </SheetTitle>
          <SheetDescription>
            {weekLabel ?? result?.weekLabel
              ? `Semana ${weekLabel ?? result?.weekLabel} · ${copy.subtitle}`
              : copy.subtitle}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {copy.loading}
            </div>
          ) : error ? (
            <p className="px-2 py-12 text-center text-sm text-muted-foreground">
              {error}
            </p>
          ) : result && result.data.length > 0 ? (
            <ul className="space-y-2">
              {result.data.map((row) => (
                <ActivityDetailItem key={row.id} row={row} />
              ))}
            </ul>
          ) : (
            <p className="px-2 py-12 text-center text-sm text-muted-foreground">
              {copy.empty}
            </p>
          )}
        </div>

        {result && result.total > 0 ? (
          <div className="shrink-0 border-t border-border/60 px-2 py-2">
            <Pagination
              page={page}
              totalPages={Math.max(1, result.totalPages)}
              totalItems={result.total}
              pageSize={result.limit}
              onPageChange={(next) => void loadPage(next)}
            />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function ActivityDetailItem({ row }: { row: ActivitiesByAdvisorDetailRow }) {
  const typeKey = row.type?.toLowerCase().trim() ?? '';
  const Icon = TYPE_ICON[typeKey] ?? Phone;

  return (
    <li className="rounded-xl border border-border/70 bg-card/60 p-3">
      <div className="flex items-start gap-2.5">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-3.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">
              {row.typeLabel}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {formatCompletedAt(row.completedAt)}
            </span>
          </div>
          {row.title ? (
            <p className="mt-1 text-sm font-medium text-foreground">{row.title}</p>
          ) : null}

          <div className="mt-2.5 space-y-1.5 text-xs">
            <EntityLine
              icon={Building2}
              label="Empresa"
              empty="Sin empresa vinculada"
              items={row.companies}
              href={(item) => companyDetailHref(item)}
            />
            <EntityLine
              icon={User}
              label="Contacto"
              empty="Sin contacto vinculado"
              items={row.contacts}
              href={(item) => contactDetailHref(item)}
            />
            <EntityLine
              icon={Target}
              label="Oportunidad"
              empty="Sin oportunidad vinculada"
              items={row.opportunities.map((o) => ({
                id: o.id,
                name: o.title,
                urlSlug: o.urlSlug,
              }))}
              href={(item) =>
                opportunityDetailHref({
                  id: item.id,
                  title: item.name,
                  urlSlug: item.urlSlug,
                })
              }
            />
          </div>
        </div>
      </div>
    </li>
  );
}

function EntityLine({
  icon: Icon,
  label,
  empty,
  items,
  href,
}: {
  icon: typeof Building2;
  label: string;
  empty: string;
  items: { id: string; name: string; urlSlug: string }[];
  href: (item: { id: string; name: string; urlSlug: string }) => string;
}) {
  if (items.length === 0) {
    return (
      <div className="flex items-start gap-2 text-muted-foreground">
        <Icon className="mt-0.5 size-3.5 shrink-0 opacity-60" aria-hidden />
        <span>
          <span className="font-medium text-foreground/70">{label}:</span> {empty}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <span className="font-medium text-foreground/80">{label}: </span>
        {items.map((item, index) => (
          <span key={item.id}>
            {index > 0 ? ', ' : null}
            <Link
              to={href(item)}
              className={cn(
                'font-medium text-primary underline-offset-2 hover:underline',
              )}
            >
              {item.name.trim() || 'Sin nombre'}
            </Link>
          </span>
        ))}
      </div>
    </div>
  );
}
