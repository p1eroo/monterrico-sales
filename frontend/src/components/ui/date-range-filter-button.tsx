import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { ChevronDown } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarSvgIcon } from '@/components/icons/CalendarSvgIcon';
import {
  comercialProPopoverClass,
} from '@/lib/comercialFilterSurface';
import { cn } from '@/lib/utils';

function formatDisplayRange(range: DateRange | undefined): string {
  if (!range?.from && !range?.to) return '';
  const fmt = (d: Date) => format(d, 'dd/MM/yyyy', { locale: es });
  if (range?.from && range?.to) return `${fmt(range.from)} — ${fmt(range.to)}`;
  if (range?.from) return `${fmt(range.from)} —`;
  return '';
}

const WEEKDAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;

const rangeCalendarClassNames = {
  months: 'relative flex flex-col gap-5 space-y-0 sm:flex-row sm:gap-8 sm:space-x-0 sm:space-y-0',
  nav: 'absolute inset-x-0 top-0 z-10 flex h-9 w-full items-center',
  month_caption: 'flex h-9 w-full items-center justify-center px-10',
  caption_label: 'text-sm font-semibold capitalize text-foreground',
  weekday: 'size-9 text-[11px] font-medium text-muted-foreground',
  button_previous:
    'absolute left-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center border-0 bg-transparent p-0 shadow-none hover:bg-transparent [&>svg]:size-4',
  button_next:
    'absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center border-0 bg-transparent p-0 shadow-none hover:bg-transparent [&>svg]:size-4',
  day_selected:
    '!bg-info !text-info-foreground hover:!bg-info hover:!text-info-foreground focus:!bg-info focus:!text-info-foreground',
  day_range_start:
    '!rounded-full !bg-info !text-info-foreground hover:!bg-info hover:!text-info-foreground',
  day_range_end:
    '!rounded-full !bg-info !text-info-foreground hover:!bg-info hover:!text-info-foreground',
  day_range_middle:
    'aria-selected:!bg-info-soft aria-selected:!text-foreground !rounded-none',
};

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
  const [draftRange, setDraftRange] = useState<DateRange | undefined>();

  const displayText = formatDisplayRange(value);
  const hasValue = Boolean(value?.from || value?.to);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setDraftRange(value);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex !h-12 w-[210px] cursor-pointer items-center gap-1.5 truncate rounded-lg border border-[#e1e7ee] bg-white/60 px-3 text-left text-sm shadow-none transition-colors hover:border-primary dark:border-gray-700 dark:bg-gray-800/60',
            hasValue ? 'text-black dark:text-gray-100' : 'text-[#8a9aab] dark:text-gray-400',
            className,
          )}
        >
          <CalendarSvgIcon className="size-5 shrink-0 text-[#8a9aab] dark:text-gray-400" />
          <span className="min-w-0 flex-1 truncate">
            {displayText || placeholder}
          </span>
          <ChevronDown className="size-3.5 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className={cn(
          comercialProPopoverClass,
          'w-auto max-w-[calc(100vw-1.5rem)] text-foreground',
        )}
      >
        <div className="p-3 sm:p-4">
          <Calendar
            mode="range"
            locale={es}
            numberOfMonths={2}
            defaultMonth={draftRange?.from ?? value?.from ?? new Date()}
            selected={draftRange}
            onSelect={(range) => setDraftRange(range)}
            showOutsideDays
            className="bg-transparent p-0 [--cell-size:2.25rem]"
            formatters={{
              formatWeekdayName: (date) => {
                const idx = date.getDay() === 0 ? 6 : date.getDay() - 1;
                return WEEKDAY_LETTERS[idx]!;
              },
            }}
            classNames={rangeCalendarClassNames}
          />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-dashed border-border/70 bg-neutral-50/80 px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900/50 sm:px-4">
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg border-border/80 bg-white shadow-none dark:bg-neutral-900"
            onClick={() => setDraftRange(undefined)}
          >
            Limpiar
          </Button>
          <Button
            size="sm"
            className="rounded-lg shadow-none"
            onClick={() => {
              onChange?.(draftRange);
              setOpen(false);
            }}
          >
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
