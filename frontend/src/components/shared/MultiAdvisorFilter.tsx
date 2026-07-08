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
import { UserHandIcon } from '@/components/icons/UserHandIcon';
import { cn } from '@/lib/utils';

type AdvisorOption = { id: string; name: string };

type MultiAdvisorFilterProps = {
  value: string[];
  onChange: (next: string[]) => void;
  advisors: AdvisorOption[];
  /** Quien no puede ver todos los asesores: el control queda deshabilitado. */
  disabled?: boolean;
  /** Hay exclusión parcial o “solo otros/sin asignar”. */
  isActive?: boolean;
  /** Evita flash de checkboxes vacíos antes de auto-seleccionar todos. */
  isInitialized?: boolean;
  className?: string;
  onInteraction?: () => void;
};

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
      ? 'Otros / Sin asignar'
      : value
          .map((id) => advisors.find((u) => u.id === id)?.name || id)
          .join(', ');

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
      <PopoverContent className="w-[180px] p-0" align="start">
        <Command>
          <CommandList className="max-h-[260px] overflow-y-auto">
            <CommandGroup>
              {advisors.map((u) => {
                const selected =
                  (!disabled && !isInitialized) || value.includes(u.id);
                return (
                  <CommandItem
                    key={u.id}
                    onSelect={() => {
                      onChange(
                        value.includes(u.id)
                          ? value.filter((e) => e !== u.id)
                          : [...value, u.id],
                      );
                      onInteraction?.();
                    }}
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
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
