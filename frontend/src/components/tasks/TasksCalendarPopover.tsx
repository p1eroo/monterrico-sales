import { useState, type ComponentProps } from 'react';
import { X } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarSvgIcon } from '@/components/icons/CalendarSvgIcon';
import { cn } from '@/lib/utils';
import { comercialProPopoverClass } from '@/lib/comercialFilterSurface';

type TasksCalendarTaskProps = Pick<
  ComponentProps<typeof Calendar>,
  'modifiers' | 'components'
>;

type TasksCalendarPopoverProps = {
  calendarDate: Date | undefined;
  onCalendarDateChange: (date: Date | undefined) => void;
  calendarTaskProps: TasksCalendarTaskProps;
  showHint: boolean;
  onDismissHint: () => void;
  triggerClassName: string;
  iconClassName?: string;
  label?: string;
};

export function TasksCalendarPopover({
  calendarDate,
  onCalendarDateChange,
  calendarTaskProps,
  showHint,
  onDismissHint,
  triggerClassName,
  iconClassName = 'size-4',
  label = 'Calendario',
}: TasksCalendarPopoverProps) {
  const [open, setOpen] = useState(false);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && showHint) onDismissHint();
  };

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              triggerClassName,
              showHint &&
                'ring-2 ring-[#13944C]/35 ring-offset-1 ring-offset-white dark:ring-offset-gray-900',
            )}
          >
            <CalendarSvgIcon className={iconClassName} />
            {label}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className={cn(comercialProPopoverClass, 'w-auto p-4')}
          align="end"
          sideOffset={8}
        >
          <Calendar
            mode="single"
            selected={calendarDate}
            onSelect={onCalendarDateChange}
            className="mx-auto"
            {...calendarTaskProps}
          />
        </PopoverContent>
      </Popover>

      {showHint && (
        <div
          role="status"
          aria-live="polite"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(calc(100vw-2rem),17rem)] animate-in fade-in slide-in-from-top-1 duration-300"
        >
          <div className="relative rounded-xl border border-[#13944C]/25 bg-white px-3 py-2.5 text-left shadow-lg dark:border-green-800/40 dark:bg-gray-900">
            <div
              className="absolute -top-1.5 right-6 size-3 rotate-45 border-l border-t border-[#13944C]/25 bg-white dark:border-green-800/40 dark:bg-gray-900"
              aria-hidden
            />
            <button
              type="button"
              onClick={onDismissHint}
              className="absolute right-1.5 top-1.5 rounded-md p-0.5 text-[#8a9aab] transition-colors hover:text-[#1f2933] dark:text-gray-400 dark:hover:text-gray-100"
              aria-label="Cerrar aviso"
            >
              <X className="size-3.5" />
            </button>
            <p className="pr-5 text-[13px] leading-snug text-[#1f2933] dark:text-gray-100">
              <span className="font-medium text-[#13944C] dark:text-green-400">
                ¿Quieres revisar una fecha?
              </span>{' '}
              Presiona aquí para abrir el calendario y filtrar tus tareas.
            </p>
            <Button
              type="button"
              size="sm"
              className="mt-2 h-7 bg-[#13944C] px-2.5 text-xs text-white hover:bg-[#0f7a3d]"
              onClick={onDismissHint}
            >
              Entendido
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
