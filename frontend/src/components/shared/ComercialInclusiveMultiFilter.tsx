import type { ReactNode, WheelEvent } from 'react';
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
import { MultiCheckboxFilterActions } from '@/components/shared/MultiCheckboxFilterActions';
import {
  comercialFilterButtonClass,
  comercialFilterCheckboxClass,
  comercialProCommandClass,
  comercialProPopoverClass,
  formatInclusiveMultiFilterLabel,
  INCLUSIVE_MULTI_NONE,
  isInclusiveMultiFilterAll,
  isInclusiveMultiFilterNone,
  isInclusiveMultiFilterSelected,
  toggleInclusiveMultiFilter,
} from '@/lib/comercialFilterSurface';
import { cn } from '@/lib/utils';
import { DISMISS_BLOCKER_ATTR } from '@/components/ui/form-dialog';

export type ComercialMultiFilterOption = {
  value: string;
  label: string;
};

type ComercialInclusiveMultiFilterPanelProps = {
  value: string[];
  onChange: (next: string[]) => void;
  options: ComercialMultiFilterOption[];
  allKeys: readonly string[];
  /** Evita que el scroll del listado mueva el modal padre. */
  stopWheelPropagation?: boolean;
};

export function ComercialInclusiveMultiFilterPanel({
  value,
  onChange,
  options,
  allKeys,
  stopWheelPropagation = false,
}: ComercialInclusiveMultiFilterPanelProps) {
  const stopWheel = stopWheelPropagation
    ? (event: WheelEvent) => event.stopPropagation()
    : undefined;

  return (
    <Command shouldFilter={false} className={comercialProCommandClass}>
      <CommandList
        className="max-h-[260px] overflow-y-auto"
        onWheel={stopWheel}
      >
        <CommandGroup>
          {options.map((option) => {
            const selected = isInclusiveMultiFilterSelected(value, option.value);
            return (
              <CommandItem
                key={option.value}
                onSelect={() => {
                  onChange(toggleInclusiveMultiFilter(value, option.value, allKeys));
                }}
              >
                <span className="[&_svg]:!text-primary-foreground">
                  <Checkbox checked={selected} className={comercialFilterCheckboxClass} />
                </span>
                <span>{option.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
      <div onWheel={stopWheel}>
        <MultiCheckboxFilterActions
          allSelected={isInclusiveMultiFilterAll(value)}
          noneSelected={isInclusiveMultiFilterNone(value)}
          onSelectAll={() => onChange([])}
          onClear={() => onChange([INCLUSIVE_MULTI_NONE])}
        />
      </div>
    </Command>
  );
}

type ComercialInclusiveMultiFilterProps = {
  value: string[];
  onChange: (next: string[]) => void;
  options: ComercialMultiFilterOption[];
  placeholder: string;
  countLabel: string;
  icon?: ReactNode;
  className?: string;
  popoverClassName?: string;
  onInteraction?: () => void;
  /** Popover dentro de FormDialogShell: z-index, scroll y sin cerrar el modal. */
  embedInFormDialog?: boolean;
};

export function ComercialInclusiveMultiFilter({
  value,
  onChange,
  options,
  placeholder,
  countLabel,
  icon,
  className,
  popoverClassName,
  onInteraction,
  embedInFormDialog = false,
}: ComercialInclusiveMultiFilterProps) {
  const allKeys = options.map((o) => o.value);
  const isActive = value.length > 0;
  const label = formatInclusiveMultiFilterLabel(
    value,
    placeholder,
    (key) => options.find((o) => o.value === key)?.label ?? key,
    countLabel,
  );

  const handleChange = (next: string[]) => {
    onChange(next);
    onInteraction?.();
  };

  return (
    <Popover modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={comercialFilterButtonClass(isActive, className)}
        >
          {icon}
          <span className="truncate flex-1">{label}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        collisionPadding={embedInFormDialog ? 16 : undefined}
        onOpenAutoFocus={embedInFormDialog ? (event) => event.preventDefault() : undefined}
        className={cn(
          comercialProPopoverClass,
          'w-[220px] p-1.5',
          embedInFormDialog && 'z-[210]',
          popoverClassName,
        )}
        {...(embedInFormDialog ? { [DISMISS_BLOCKER_ATTR]: '' } : {})}
      >
        <ComercialInclusiveMultiFilterPanel
          value={value}
          onChange={handleChange}
          options={options}
          allKeys={allKeys}
          stopWheelPropagation={embedInFormDialog}
        />
      </PopoverContent>
    </Popover>
  );
}
