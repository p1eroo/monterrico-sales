import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { Calendar as CalendarIcon, ChevronDown, X } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

function formatDisplayRange(range: DateRange | undefined): string {
  if (!range?.from && !range?.to) return '';
  const fmt = (d: Date) => format(d, 'dd/MM/yyyy', { locale: es });
  if (range?.from && range?.to) return `${fmt(range.from)} — ${fmt(range.to)}`;
  if (range?.from) return `${fmt(range.from)} —`;
  return '';
}

export interface DateRangeFilterButtonProps {
  value?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DateRangeFilterButton({
  value,
  onChange,
  placeholder = 'Última interacción',
  className,
  disabled,
}: DateRangeFilterButtonProps) {
  const [open, setOpen] = useState(false);

  const displayText = useMemo(() => formatDisplayRange(value), [value]);
  const hasValue = Boolean(value?.from || value?.to);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {hasValue ? (
        <div
          className={cn(
            'inline-flex max-w-full items-stretch overflow-hidden rounded-md border border-input bg-card text-sm shadow-none transition-colors',
            className,
            '!w-max shrink-0',
          )}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              aria-label={displayText ? `Fechas: ${displayText}` : placeholder}
              className={cn(
                'inline-flex h-9 w-max min-w-0 max-w-full shrink-0 items-center gap-2 border-0 bg-transparent py-0 pl-3 pr-1.5 text-left outline-none transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60',
              )}
            >
              <CalendarIcon className="size-4 shrink-0 text-foreground/80" strokeWidth={1.75} aria-hidden />
              <span className="min-w-0 max-w-[min(100vw-3rem,24rem)] shrink-0 truncate whitespace-nowrap text-sm tabular-nums text-foreground">
                {displayText}
              </span>
            </button>
          </PopoverTrigger>
          <button
            type="button"
            disabled={disabled}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onChange?.(undefined);
            }}
            className="flex h-9 shrink-0 items-center border-l border-input px-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Limpiar fechas"
            title="Limpiar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className={cn('min-w-0 w-auto shrink-0', className)}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className={cn(
                'flex h-9 w-auto min-w-[180px] max-w-[min(100vw-1.5rem,17rem)] items-center gap-2 rounded-md border border-input bg-card py-0 pl-3 pr-2 text-sm shadow-none transition-colors',
                'hover:bg-muted/40 focus-visible:outline-none',
                'disabled:cursor-not-allowed disabled:opacity-60',
              )}
            >
              <CalendarIcon className="size-4 shrink-0 text-foreground/80" strokeWidth={1.75} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-left text-sm text-foreground">
                {placeholder}
              </span>
              <ChevronDown className="ml-auto h-4 w-4 shrink-0 opacity-50" aria-hidden />
            </button>
          </PopoverTrigger>
        </div>
      )}

      <PopoverContent
        className="w-auto max-w-[calc(100vw-1.5rem)] border-border bg-popover p-0 shadow-lg"
        align="start"
        sideOffset={8}
      >
        <Calendar
          mode="range"
          locale={es}
          numberOfMonths={2}
          defaultMonth={value?.from ?? value?.to ?? new Date()}
          selected={value}
          onSelect={(range) => {
            onChange?.(range);
            if (range?.from && range?.to) setOpen(false);
          }}
          showOutsideDays
          formatters={{
            formatWeekdayName: (date) => {
              const d = date.getDay();
              const idx = d === 0 ? 6 : d - 1;
              const letters = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
              return letters[idx]!;
            },
          }}
          classNames={{
            months: 'flex flex-col gap-5 space-y-0 sm:flex-row sm:gap-6 sm:space-x-0 sm:space-y-0',
            day_selected:
              '!bg-info !text-info-foreground hover:!bg-info hover:!text-info-foreground focus:!bg-info focus:!text-info-foreground',
            day_range_start:
              '!rounded-full !bg-info !text-info-foreground hover:!bg-info hover:!text-info-foreground',
            day_range_end:
              '!rounded-full !bg-info !text-info-foreground hover:!bg-info hover:!text-info-foreground',
            day_range_middle:
              'aria-selected:!bg-info-soft aria-selected:!text-foreground !rounded-none',
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

