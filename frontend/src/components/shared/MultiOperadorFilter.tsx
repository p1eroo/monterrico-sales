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
import { MultiCheckboxFilterActions } from '@/components/shared/MultiCheckboxFilterActions';
import {
  comercialProCommandClass,
  comercialProPopoverClass,
} from '@/lib/comercialFilterSurface';
import { cn } from '@/lib/utils';

type MultiOperadorFilterProps = {
  value: string[];
  onChange: (next: string[]) => void;
  operadores: string[];
  isActive?: boolean;
  isInitialized?: boolean;
  className?: string;
};

export function MultiOperadorFilter({
  value,
  onChange,
  operadores,
  isActive = false,
  isInitialized = true,
  className,
}: MultiOperadorFilterProps) {
  const label = !isActive
    ? 'Operador'
    : value.length === 0
      ? 'Ninguno'
      : value.join(', ');

  const toggle = (name: string) => {
    onChange(
      value.includes(name) ? value.filter((n) => n !== name) : [...value, name],
    );
  };

  const allSelected =
    isInitialized &&
    operadores.length > 0 &&
    operadores.every((name) => value.includes(name));

  const noneSelected = isInitialized && value.length === 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            '!h-12 rounded-lg border border-[#e1e7ee] bg-white/60 px-3 text-sm shadow-none transition-colors hover:border-primary dark:border-gray-700 dark:bg-gray-800/60 flex cursor-pointer items-center gap-1.5 truncate text-left',
            isActive
              ? 'text-black dark:text-gray-100'
              : 'text-[#8a9aab] dark:text-gray-400',
            className,
          )}
        >
          <UserHandIcon className="size-5 shrink-0 text-[#8a9aab] dark:text-gray-400" />
          <span className="min-w-0 flex-1 truncate">{label}</span>
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
              {operadores.length === 0 ? (
                <p className="px-2.5 py-2 text-xs text-muted-foreground">
                  Sin operadores
                </p>
              ) : (
                operadores.map((name) => {
                  const selected =
                    (!isInitialized && operadores.length > 0) ||
                    value.includes(name);
                  return (
                    <CommandItem
                      key={name}
                      onSelect={() => toggle(name)}
                      className="rounded-xl px-2.5 py-2"
                    >
                      <span className="[&_svg]:!text-primary-foreground">
                        <Checkbox
                          checked={selected}
                          className="mr-2 h-4 w-4 rounded border border-gray-400 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                        />
                      </span>
                      <span>{name}</span>
                    </CommandItem>
                  );
                })
              )}
            </CommandGroup>
          </CommandList>
          {operadores.length > 0 && (
            <MultiCheckboxFilterActions
              allSelected={allSelected}
              noneSelected={noneSelected}
              onSelectAll={() => onChange([...operadores])}
              onClear={() => onChange([])}
            />
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
