import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  crmTableBodyRowClass,
  crmTableHeaderRowClassTall,
} from '@/lib/crmTableSurface';

interface GhostColumn {
  label: string;
  width: number;
  className?: string;
}

export function GhostTableSkeleton({
  columns,
  rows = 8,
}: {
  columns: GhostColumn[];
  rows?: number;
}) {
  return (
    <div className="border-t border-border/40 overflow-auto scrollbar-thin">
      <table className="w-full table-fixed">
        <thead>
          <tr className={cn('h-11 text-left', crmTableHeaderRowClassTall)}>
            {columns.map((col, i) => (
              <th
                key={i}
                className={`px-3 align-middle overflow-hidden ${col.className ?? ''}`}
                style={{ width: col.width }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={rowIdx} className={cn('h-14 last:border-b-0', crmTableBodyRowClass)}>
              {columns.map((col, colIdx) => (
                <td
                  key={colIdx}
                  className={`px-3 align-middle overflow-hidden ${col.className ?? ''}`}
                  style={{ width: col.width }}
                >
                  {col.label === '' && col.width <= 60 ? null : (
                    <Skeleton className={`h-4 ${colIdx === 0 ? 'w-3/5' : 'w-4/5'}`} />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
