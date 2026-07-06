import { Skeleton } from '@/components/ui/skeleton';

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
          <tr className="h-11 bg-[#eef1f5] dark:bg-gray-800 text-left text-xs font-bold text-[#647789] dark:text-gray-400">
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
            <tr key={rowIdx} className="h-14 border-b border-dashed border-[#e8ecf0] dark:border-gray-700 bg-card/30 last:border-b-0">
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
