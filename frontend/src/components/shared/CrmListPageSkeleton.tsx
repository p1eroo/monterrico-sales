import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

export function CrmStatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className={cn(
        'grid gap-4 sm:grid-cols-2',
        count >= 4 && 'lg:grid-cols-4',
        count === 2 && 'lg:grid-cols-2',
      )}
      aria-hidden
    >
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="py-0">
          <CardContent className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="size-12 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-32 max-w-full" />
              <Skeleton className="h-8 w-24 max-w-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export type CrmSkeletonColumn = {
  label: string;
  className?: string;
  cellClassName?: string;
  /** Primera columna con selector en la tabla real. */
  skeletonCell?: 'checkbox' | 'text';
};

export function CrmDataTableSkeleton({
  columns,
  rows = 8,
  'aria-label': ariaLabel,
  roundedClass = 'rounded-md',
  className,
}: {
  columns: CrmSkeletonColumn[];
  rows?: number;
  'aria-label': string;
  roundedClass?: string;
  /** p. ej. `bg-card` para alinear con tarjetas KPI en modo oscuro */
  className?: string;
}) {
  return (
    <div
      className={cn('overflow-x-auto border', roundedClass, className)}
      aria-busy="true"
      aria-live="polite"
      aria-label={ariaLabel}
    >
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c, ci) => (
              <TableHead key={`sk-head-${ci}`} className={c.className}>
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, ri) => {
            const hasCheckboxCol = columns.some((x) => x.skeletonCell === 'checkbox');
            const primaryTextCol = hasCheckboxCol ? 1 : 0;
            return (
              <TableRow key={ri}>
                {columns.map((c, ci) => (
                  <TableCell key={ci} className={c.cellClassName}>
                    {c.skeletonCell === 'checkbox' ? (
                      <Skeleton className="size-4 rounded-sm" />
                    ) : (
                      <Skeleton
                        className={cn(
                          'max-w-full',
                          ci === primaryTextCol ? 'h-9 w-48' : 'h-4 w-20',
                          ci === columns.length - 1 && 'mx-auto h-8 w-8',
                        )}
                      />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function CrmEntityCardGridSkeleton({
  count = 8,
  'aria-label': ariaLabel,
}: {
  count?: number;
  'aria-label': string;
}) {
  return (
    <div
      className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      aria-busy="true"
      aria-live="polite"
      aria-label={ariaLabel}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="gap-0 py-0">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-start gap-3">
              <Skeleton className="size-10 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-5 w-[12rem] max-w-full" />
                <Skeleton className="h-3 w-[6rem] max-w-full" />
              </div>
              <Skeleton className="size-8 shrink-0 rounded-md" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-36" />
            <div className="flex items-center justify-between border-t pt-3">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-3 w-20" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Filtros genéricos (búsqueda + selects) mientras carga una lista CRM. */
export function CrmFilterBarSkeleton() {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center" aria-hidden>
      <Skeleton className="h-10 w-full flex-1 rounded-md" />
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-[140px] rounded-md" />
        <Skeleton className="h-9 w-[180px] rounded-md" />
        <Skeleton className="h-9 w-[150px] rounded-md" />
        <Skeleton className="h-9 w-[4.5rem] rounded-md border" />
      </div>
    </div>
  );
}

export function CrmTabsBarSkeleton({ tabCount = 4 }: { tabCount?: number }) {
  return (
    <div className="flex w-full gap-1 border-b border-border pb-2" aria-hidden>
      {Array.from({ length: tabCount }).map((_, i) => (
        <Skeleton key={i} className="h-9 min-w-0 flex-1 rounded-md" />
      ))}
    </div>
  );
}
