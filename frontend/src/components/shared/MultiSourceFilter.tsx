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
import { PaletteIcon } from '@/components/icons/PaletteIcon';
import { MultiCheckboxFilterActions } from '@/components/shared/MultiCheckboxFilterActions';
import {
  comercialProCommandClass,
  comercialProPopoverClass,
  INCLUSIVE_MULTI_NONE,
  isInclusiveMultiFilterAll,
  isInclusiveMultiFilterNone,
  isInclusiveMultiFilterSelected,
  toggleInclusiveMultiFilter,
  formatInclusiveMultiSourceFilterLabel,
} from '@/lib/comercialFilterSurface';
import { cn } from '@/lib/utils';

type SourceOption = { value: string; label: string };

type MultiSourceFilterProps = {
  value: string[];
  onChange: (next: string[]) => void;
  options: SourceOption[];
  className?: string;
  onInteraction?: () => void;
};

export function MultiSourceFilter({
  value,
  onChange,
  options,
  className,
  onInteraction,
}: MultiSourceFilterProps) {
  const isActive = value.length > 0;
  const label = formatInclusiveMultiSourceFilterLabel(
    value,
    'Fuente',
    (key) => options.find((o) => o.value === key)?.label ?? key,
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            '!h-12 rounded-lg border border-[#e1e7ee] dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 px-3 text-sm hover:border-primary transition-colors shadow-none cursor-pointer flex items-center gap-1.5 text-left truncate',
            isActive
              ? 'text-black dark:text-gray-100'
              : 'text-[#8a9aab] dark:text-gray-400',
            className,
          )}
        >
          <PaletteIcon className="size-5 shrink-0 text-[#8a9aab] dark:text-gray-400" />
          <span className="truncate flex-1">{label}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className={cn(comercialProPopoverClass, 'w-[200px] p-1.5')}
      >
        <Command className={comercialProCommandClass}>
          <CommandList className="max-h-[260px] overflow-y-auto">
            <CommandGroup className="p-0">
              {options.map(({ value: key, label: optionLabel }) => {
                const selected = isInclusiveMultiFilterSelected(value, key);
                return (
                  <CommandItem
                    key={key}
                    onSelect={() => {
                      onChange(
                        toggleInclusiveMultiFilter(
                          value,
                          key,
                          options.map((o) => o.value),
                        ),
                      );
                      onInteraction?.();
                    }}
                    className="rounded-xl px-2.5 py-2"
                  >
                    <span className="[&_svg]:!text-primary-foreground">
                      <Checkbox
                        checked={selected}
                        className="mr-2 h-4 w-4 border border-gray-400 data-[state=checked]:bg-primary data-[state=checked]:border-primary rounded"
                      />
                    </span>
                    <span>{optionLabel}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          <MultiCheckboxFilterActions
            allSelected={isInclusiveMultiFilterAll(value)}
            noneSelected={isInclusiveMultiFilterNone(value)}
            onSelectAll={() => {
              onChange([]);
              onInteraction?.();
            }}
            onClear={() => {
              onChange([INCLUSIVE_MULTI_NONE]);
              onInteraction?.();
            }}
          />
        </Command>
      </PopoverContent>
    </Popover>
  );
}
