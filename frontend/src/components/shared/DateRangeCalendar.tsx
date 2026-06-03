import { useState } from 'react';
import { Calendar } from 'primereact/calendar';
import { addLocale } from 'primereact/api';
import { X } from 'lucide-react';
import 'primereact/resources/themes/lara-light-blue/theme.css';
import 'primereact/resources/primereact.min.css';

addLocale('es-custom', {
  firstDayOfWeek: 1,
  dayNames: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
  dayNamesShort: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
  dayNamesMin: ['D', 'L', 'M', 'M', 'J', 'V', 'S'],
  monthNames: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  monthNamesShort: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  today: 'Hoy',
  clear: 'Limpiar',
});

export interface DateRangeValue {
  from?: Date;
  to?: Date;
}

interface Props {
  value?: DateRangeValue;
  onChange?: (value: DateRangeValue | undefined) => void;
  onClose?: () => void;
}

export function DateRangeCalendar({ value, onChange, onClose }: Props) {
  const [dates, setDates] = useState<(Date | null)[] | null>(() => {
    if (!value?.from) return null;
    if (value.to) return [value.from, value.to];
    return [value.from, value.from];
  });

  const handleDateChange = (e: any) => {
    const val = e.value as (Date | null)[] | null;
    setDates(val);
    if (Array.isArray(val) && val.length >= 2 && val[0]) {
      onChange?.({ from: val[0], to: val[1] || val[0] });
      if (val[1]) onClose?.();
    } else if (!val) {
      onChange?.(undefined);
    }
  };

  return (
    <div className="date-range-calendar">
      <Calendar
        value={dates}
        onChange={handleDateChange}
        selectionMode="range"
        readOnlyInput
        hideOnRangeSelection
        locale="es-custom"
        dateFormat="dd/mm/yy"
        className="w-full"
        touchUI={false}
        inline
      />
      {value && (
        <button
          type="button"
          onClick={() => { setDates(null); onChange?.(undefined); }}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors"
        >
          <X className="size-3" />
          Limpiar filtro
        </button>
      )}
      <style>{`
        .date-range-calendar .p-datepicker {
          border: none !important;
          box-shadow: none !important;
        }
        .date-range-calendar .p-datepicker-group-container {
          border: none !important;
        }
        .date-range-calendar .p-datepicker table {
          font-size: 0.75rem !important;
        }
        .date-range-calendar .p-datepicker table th {
          padding: 0.15rem 0 !important;
          font-size: 0.65rem !important;
        }
        .date-range-calendar .p-datepicker table td {
          padding: 0 !important;
        }
        .date-range-calendar .p-datepicker table td > span {
          width: 1.8rem !important;
          height: 1.8rem !important;
          line-height: 1.8rem !important;
          font-size: 0.8rem !important;
        }
        .date-range-calendar .p-datepicker table td > span.p-highlight {
          background: var(--primary) !important;
          color: var(--primary-foreground) !important;
        }
        .date-range-calendar .p-datepicker table td:not(.p-disabled) span:not(.p-disabled):hover {
          background: var(--primary);
          color: var(--primary-foreground);
        }
        .date-range-calendar .p-datepicker .p-datepicker-today > span {
          font-weight: 600;
        }
        .date-range-calendar .p-datepicker .p-datepicker-today.p-highlight > span {
          background: var(--primary) !important;
          color: var(--primary-foreground) !important;
        }
        .date-range-calendar .p-datepicker .p-datepicker-header {
          padding: 0.3rem 0 !important;
        }
        .date-range-calendar .p-datepicker .p-datepicker-title {
          font-size: 0.75rem !important;
        }
        .date-range-calendar .p-datepicker .p-datepicker-prev,
        .date-range-calendar .p-datepicker .p-datepicker-next {
          width: 1.5rem !important;
          height: 1.5rem !important;
        }
      `}</style>
    </div>
  );
}
