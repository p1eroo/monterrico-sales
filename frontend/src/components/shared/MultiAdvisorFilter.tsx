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
import { UserHandIcon } from '@/components/icons/UserHandIcon';
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
  const label = !isActive
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

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            '!h-12 rounded-lg border border-[#e1e7ee] dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 px-3 text-sm hover:border-primary transition-colors shadow-none cursor-pointer flex items-center gap-1.5 text-left truncate disabled:opacity-50 disabled:cursor-not-allowed',
            isActive
              ? 'text-black dark:text-gray-100'
              : 'text-[#8a9aab] dark:text-gray-400',
            className,
          )}
        >
          <UserHandIcon className="size-5 shrink-0 text-[#8a9aab] dark:text-gray-400" />
          <span className="truncate flex-1">{label}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandList className="max-h-[280px] overflow-y-auto">
            <CommandGroup>
              {advisors.map((u) => {
                const selected =
                  (!disabled && !isInitialized) || value.includes(u.id);
                return (
                  <CommandItem key={u.id} onSelect={() => toggle(u.id)}>
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
                <CommandSeparator />
                <CommandGroup>
                  {ADVISOR_SPECIAL_OPTIONS.map((opt) => {
                    const selected =
                      (!disabled && !isInitialized) || value.includes(opt.id);
                    return (
                      <CommandItem
                        key={opt.id}
                        onSelect={() => toggle(opt.id)}
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
        </Command>
      </PopoverContent>
    </Popover>
  );
}
