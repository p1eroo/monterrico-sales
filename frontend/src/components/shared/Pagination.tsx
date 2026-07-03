import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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

  return (
    <div className="flex w-full items-center justify-end gap-4">
      {onPageSizeChange && pageSize != null && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-black whitespace-nowrap">Filas:</span>
          <Select
            value={String(pageSize)}
            onValueChange={(val) => onPageSizeChange(Number(val))}
          >
            <SelectTrigger size="sm" className="h-8 w-auto min-w-0 border-0 bg-transparent shadow-none text-black gap-1.5 justify-start [&_svg]:!text-black [&_svg]:!opacity-100">
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

      <p className="text-sm text-black whitespace-nowrap">
        {start != null && end != null && totalItems != null
          ? `${start}–${end} de ${totalItems}`
          : `Página ${page} de ${totalPages}`}
      </p>

      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="h-8 w-7 p-0 text-black disabled:text-gray-300"
        >
          <ChevronLeft className="size-5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="h-8 w-7 p-0 text-black disabled:text-gray-300"
        >
          <ChevronRight className="size-5" />
        </Button>
      </div>
    </div>
  );
}
