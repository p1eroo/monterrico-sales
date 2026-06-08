import * as React from 'react';
import type { DateRange } from 'react-day-picker';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

function formatRangeLabel(range: DateRange | undefined): string {
  if (!range?.from) return 'Seleccionar fechas';
  const fromStr = format(range.from, "d MMM yyyy", { locale: es });
  if (!range.to || range.from.getTime() === range.to.getTime()) {
    return fromStr;
  }
  const toStr = format(range.to, "d MMM yyyy", { locale: es });
  return `${fromStr} - ${toStr}`;
}

export interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = 'Seleccionar fechas',
  className,
  disabled,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = React.useCallback(
    (range: DateRange | undefined) => {
      onChange?.(range);
      if (range?.from && range?.to) {
        setOpen(false);
      }
    },
    [onChange]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal md:w-[240px]',
            !value?.from && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 size-4" />
          {value?.from ? formatRangeLabel(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          defaultMonth={value?.from ?? new Date()}
          selected={value}
          onSelect={handleSelect}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  );
}
