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
  CommandSeparator,
} from '@/components/ui/command';
import { UsersGroupRoundedSvgIcon } from '@/components/icons/UsersGroupRoundedSvgIcon';
import { MultiCheckboxFilterActions } from '@/components/shared/MultiCheckboxFilterActions';
import {
  comercialFilterIconClass,
  comercialProCommandClass,
  comercialProPopoverClass,
} from '@/lib/comercialFilterSurface';
import { cn } from '@/lib/utils';
import {
  ADVISOR_OTHERS,
  ADVISOR_SPECIAL_OPTIONS,
  ADVISOR_UNASSIGNED,
} from '@/hooks/useMultiAdvisorFilter';

type AdvisorOption = { id: string; name: string };

type MultiAdvisorFilterProps = {
  value: string[];
  onChange: (next: string[]) => void;
  advisors: AdvisorOption[];
  /** Quien no puede ver todos los asesores: el control queda deshabilitado. */
  disabled?: boolean;
  /** Hay exclusión parcial o selección incompleta. */
  isActive?: boolean;
  /** Evita flash de checkboxes vacíos antes de auto-seleccionar todos. */
  isInitialized?: boolean;
  className?: string;
  onInteraction?: () => void;
};

function optionLabel(id: string, advisors: AdvisorOption[]): string {
  if (id === ADVISOR_UNASSIGNED) return 'Sin asignar';
  if (id === ADVISOR_OTHERS) return 'Otros';
  return advisors.find((u) => u.id === id)?.name || id;
}

export function MultiAdvisorFilter({
  value,
  onChange,
  advisors,
  disabled = false,
  isActive = false,
  isInitialized = true,
  className,
  onInteraction,
}: MultiAdvisorFilterProps) {
  const showsOwnPortfolio = disabled && value.length === 1;

  const label = showsOwnPortfolio
    ? optionLabel(value[0]!, advisors)
    : !isActive
      ? 'Asesor'
      : value.length === 0
        ? 'Ninguno'
        : value.map((id) => optionLabel(id, advisors)).join(', ');

  const toggle = (id: string) => {
    onChange(
      value.includes(id) ? value.filter((e) => e !== id) : [...value, id],
    );
    onInteraction?.();
  };

  const showSpecials = !disabled;

  const allSelectableIds = showSpecials
    ? [
        ...advisors.map((u) => u.id),
        ...ADVISOR_SPECIAL_OPTIONS.map((o) => o.id),
      ]
    : advisors.map((u) => u.id);

  const allSelected =
    isInitialized &&
    allSelectableIds.length > 0 &&
    allSelectableIds.every((id) => value.includes(id));

  const noneSelected = isInitialized && value.length === 0;

  const selectAll = () => {
    onChange(allSelectableIds);
    onInteraction?.();
  };

  const clearAll = () => {
    onChange([]);
    onInteraction?.();
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            '!h-10 rounded-lg border border-[#e1e7ee] dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 px-3 text-[13px] hover:border-primary transition-colors shadow-none cursor-pointer flex items-center gap-1.5 text-left truncate disabled:opacity-50 disabled:cursor-not-allowed',
            isActive || showsOwnPortfolio
              ? 'text-black dark:text-gray-100'
              : 'text-[#8a9aab] dark:text-gray-400',
            className,
          )}
        >
          <UsersGroupRoundedSvgIcon className={comercialFilterIconClass} />
          <span className="truncate flex-1">{label}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className={cn(comercialProPopoverClass, 'w-[220px] p-1.5')}
      >
        <Command className={comercialProCommandClass}>
          <CommandList className="max-h-[280px] overflow-y-auto">
            <CommandGroup className="p-0">
              {advisors.map((u) => {
                const selected =
                  (!disabled && !isInitialized) || value.includes(u.id);
                return (
                  <CommandItem
                    key={u.id}
                    onSelect={() => toggle(u.id)}
                    className="rounded-xl px-2.5 py-2"
                  >
                    <span className="[&_svg]:!text-primary-foreground">
                      <Checkbox
                        checked={selected}
                        className="mr-2 h-4 w-4 border border-gray-400 data-[state=checked]:bg-primary data-[state=checked]:border-primary rounded"
                      />
                    </span>
                    <span>{u.name}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {showSpecials && (
              <>
                <CommandSeparator className="my-1.5 mx-1 border-dashed" />
                <CommandGroup className="p-0">
                  {ADVISOR_SPECIAL_OPTIONS.map((opt) => {
                    const selected =
                      (!disabled && !isInitialized) || value.includes(opt.id);
                    return (
                      <CommandItem
                        key={opt.id}
                        onSelect={() => toggle(opt.id)}
                        className="rounded-xl px-2.5 py-2"
                      >
                        <span className="[&_svg]:!text-primary-foreground">
                          <Checkbox
                            checked={selected}
                            className="mr-2 h-4 w-4 border border-gray-400 data-[state=checked]:bg-primary data-[state=checked]:border-primary rounded"
                          />
                        </span>
                        <span>{opt.name}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
          {allSelectableIds.length > 0 && (
            <MultiCheckboxFilterActions
              allSelected={allSelected}
              noneSelected={noneSelected}
              onSelectAll={selectAll}
              onClear={clearAll}
            />
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
