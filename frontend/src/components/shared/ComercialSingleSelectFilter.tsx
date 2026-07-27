import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  comercialFilterButtonClass,
  comercialFilterCheckboxClass,
  comercialProCommandClass,
  comercialProPopoverClass,
} from '@/lib/comercialFilterSurface';
import { cn } from '@/lib/utils';

export type ComercialSelectOption = {
  value: string;
  label: string;
};

type ComercialSingleSelectFilterProps = {
  value: string;
  onChange: (value: string) => void;
  options: ComercialSelectOption[];
  placeholder: string;
  /** Valor que representa “sin filtro” (p. ej. todos / todas). */
  defaultValue: string;
  /** Etiqueta de la opción “sin filtro” dentro del popover. */
  allLabel?: string;
  icon?: ReactNode;
  disabled?: boolean;
  className?: string;
  popoverClassName?: string;
};

export function ComercialSingleSelectFilter({
  value,
  onChange,
  options,
  placeholder,
  defaultValue,
  allLabel = 'Todos',
  icon,
  disabled = false,
  className,
  popoverClassName,
}: ComercialSingleSelectFilterProps) {
  const isActive = value !== defaultValue;
  const selectedLabel =
    value === defaultValue
      ? placeholder
      : options.find((o) => o.value === value)?.label ?? value;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={comercialFilterButtonClass(isActive, cn('disabled:cursor-not-allowed disabled:opacity-50', className))}
        >
          {icon}
          <span className="truncate flex-1">{selectedLabel}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className={cn(comercialProPopoverClass, 'w-[220px] p-1.5', popoverClassName)}
      >
        <Command className={comercialProCommandClass}>
          <CommandList className="max-h-[260px] overflow-y-auto">
            <CommandGroup>
              <CommandItem onSelect={() => onChange(defaultValue)}>
                <span className="[&_svg]:!text-primary-foreground">
                  <Checkbox
                    checked={value === defaultValue}
                    className={comercialFilterCheckboxClass}
                  />
                </span>
                <span>{allLabel}</span>
              </CommandItem>
              {options.map((option) => (
                <CommandItem key={option.value} onSelect={() => onChange(option.value)}>
                  <span className="[&_svg]:!text-primary-foreground">
                    <Checkbox
                      checked={value === option.value}
                      className={comercialFilterCheckboxClass}
                    />
                  </span>
                  <span>{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
