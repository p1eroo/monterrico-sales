import { Skeleton } from '@/components/ui/skeleton';

/**
 * Placeholder mientras carga el detalle de entidad CRM (layout tipo DetailLayout).
 */
export function EntityDetailPageSkeleton({
  ariaLabel = 'Cargando detalle',
}: {
  ariaLabel?: string;
}) {
  return (
    <div
      className="text-text-primary"
      aria-busy="true"
      aria-live="polite"
      aria-label={ariaLabel}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Skeleton className="size-9 shrink-0 rounded-lg" />
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-8 w-[min(14rem,50vw)]" />
            <Skeleton className="h-4 w-[min(20rem,70vw)]" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl pt-2 md:pt-4">
        <div className="flex flex-col items-start gap-6 lg:flex-row">
          <div className="min-w-0 w-full flex-1 space-y-6 lg:max-w-[65%]">
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-[5.5rem] rounded-md sm:w-28" />
              ))}
            </div>
            <div className="space-y-4 rounded-lg border border-border/70 bg-card p-4 sm:p-5">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-36 w-full rounded-md" />
              <Skeleton className="h-4 w-full max-w-xl" />
              <Skeleton className="h-4 w-full max-w-lg" />
              <Skeleton className="h-4 w-full max-w-md" />
            </div>
          </div>
          <aside className="w-full space-y-4 lg:w-[35%] lg:flex-shrink-0 lg:pt-14">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-lg border border-border/70 bg-surface-elevated"
              >
                <Skeleton className="h-12 w-full rounded-none" />
                <div className="space-y-3 border-t border-border/70 p-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-[92%]" />
                  <Skeleton className="h-4 w-[70%]" />
                </div>
              </div>
            ))}
          </aside>
        </div>
      </div>
    </div>
  );
}
