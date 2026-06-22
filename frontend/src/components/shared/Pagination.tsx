import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
}: PaginationProps) {
  const start = totalItems != null && pageSize != null ? (page - 1) * pageSize + 1 : null;
  const end = totalItems != null && pageSize != null ? Math.min(page * pageSize, totalItems) : null;

  if (totalPages <= 0 || (totalPages <= 1 && !totalItems)) return null;

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show page 1
      pages.push(1);

      // Calculate start and end indices around the current page
      let startPage = Math.max(2, page - 1);
      let endPage = Math.min(totalPages - 1, page + 1);

      if (page <= 2) {
        endPage = 3;
      } else if (page >= totalPages - 1) {
        startPage = totalPages - 2;
      }

      if (startPage > 2) {
        pages.push('...');
      }

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }

      if (endPage < totalPages - 1) {
        pages.push('...');
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex w-full items-center justify-between py-4">
      {/* Left side: Results count range */}
      <div>
        <p className="text-sm text-muted-foreground font-normal">
          {start != null && end != null && totalItems != null
            ? `Mostrando ${start}–${end} de ${totalItems} resultados`
            : `Página ${page} de ${totalPages}`}
        </p>
      </div>

      {/* Right side: Page size selector and page navigation buttons */}
      <div className="flex items-center gap-6">
        {/* Page size select dropdown */}
        {onPageSizeChange && pageSize != null && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Filas</span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => onPageSizeChange(Number(val))}
            >
              <SelectTrigger size="sm" className="h-8 w-[75px] bg-white border-[#e3e9ef] shadow-[0_2px_6px_rgba(15,23,42,0.06)]">
                <SelectValue placeholder={String(pageSize)} />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((opt) => (
                  <SelectItem key={opt} value={String(opt)}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Page number buttons */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="h-8 px-3 text-xs font-normal border-[#e3e9ef] text-[#111827] hover:bg-muted/40 bg-white shadow-[0_2px_6px_rgba(15,23,42,0.06)]"
          >
            Anterior
          </Button>

          {pageNumbers.map((num, index) => {
            if (num === '...') {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="px-2 text-sm text-muted-foreground select-none"
                >
                  ...
                </span>
              );
            }

            const isPageActive = num === page;

            return (
              <Button
                key={`page-${num}`}
                variant={isPageActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => !isPageActive && onPageChange(Number(num))}
                className={`h-8 w-8 p-0 text-xs rounded-lg ${
                  isPageActive
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90 font-medium shadow-[0_2px_6px_rgba(15,23,42,0.06)]'
                    : 'font-normal border-[#e3e9ef] text-[#111827] hover:bg-muted/40 bg-white shadow-[0_2px_6px_rgba(15,23,42,0.06)]'
                }`}
              >
                {num}
              </Button>
            );
          })}

          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="h-8 px-3 text-xs font-normal border-[#e3e9ef] text-[#111827] hover:bg-muted/40 bg-white shadow-[0_2px_6px_rgba(15,23,42,0.06)]"
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}

