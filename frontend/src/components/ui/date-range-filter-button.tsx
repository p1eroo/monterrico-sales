import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { ChevronDown } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarSvgIcon } from '@/components/icons/CalendarSvgIcon';
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
  months: 'flex flex-col gap-5 space-y-0 sm:flex-row sm:gap-6 sm:space-x-0 sm:space-y-0',
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
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3">
          <Calendar
            mode="range"
            locale={es}
            numberOfMonths={2}
            defaultMonth={draftRange?.from ?? value?.from ?? new Date()}
            selected={draftRange}
            onSelect={(range) => setDraftRange(range)}
            showOutsideDays
            formatters={{
              formatWeekdayName: (date) => {
                const idx = date.getDay() === 0 ? 6 : date.getDay() - 1;
                return WEEKDAY_LETTERS[idx]!;
              },
            }}
            classNames={rangeCalendarClassNames}
          />
          <div className="mt-3 flex items-center justify-end gap-2 border-t border-border/60 pt-3">
            <Button variant="outline" size="sm" onClick={() => setDraftRange(undefined)}>
              Limpiar
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onChange?.(draftRange);
                setOpen(false);
              }}
            >
              Aplicar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
