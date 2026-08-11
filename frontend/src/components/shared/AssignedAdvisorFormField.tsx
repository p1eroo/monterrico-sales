import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { useUsers } from '@/hooks/useUsers';
import { useAppStore } from '@/store';
import { resolveAdvisorAssigneeId, canUserReassignCommercialAdvisor } from '@/lib/advisorAssigneeDefaults';
import type { CommercialAssignModule } from '@/data/rbac';
import { usePermissions } from '@/hooks/usePermissions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { UsersGroupRoundedSvgIcon } from '@/components/icons/UsersGroupRoundedSvgIcon';
import {
  FormDialogField,
  formDialogInputClass,
  formDialogSelectTriggerClass,
  formDialogPopoverContentClass,
  formDialogScrollListClass,
} from '@/components/ui/form-dialog';
import { cn } from '@/lib/utils';

type AdvisorOption = { id: string; name: string };

type Props = {
  htmlId: string;
  value: string;
  onChange: (userId: string) => void;
  disabled: boolean;
  assignModule: CommercialAssignModule;
  fallbackName?: string | null;
  label?: string;
  formStyle?: boolean;
};

const avatarColors = [
  'bg-emerald-100 text-emerald-700',
  'bg-blue-100 text-blue-700',
  'bg-amber-100 text-amber-700',
  'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
];

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash += name.charCodeAt(i);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function AdvisorAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'size-6 text-[10px]' : 'size-8 text-xs';
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold',
        sizeClass,
        getAvatarColor(name),
      )}
    >
      {getInitials(name)}
    </span>
  );
}

function AdvisorPickerPopover({
  htmlId,
  value,
  onChange,
  options,
  disabled,
  formStyle,
}: {
  htmlId: string;
  value: string;
  onChange: (userId: string) => void;
  options: AdvisorOption[];
  disabled: boolean;
  formStyle: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selected = options.find((option) => option.id === value);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) => option.name.toLowerCase().includes(query));
  }, [options, search]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setSearch('');
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal={false}>
      <PopoverTrigger asChild>
        <Button
          id={htmlId}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            formStyle
              ? cn(
                  formDialogSelectTriggerClass,
                  'justify-between font-normal shadow-none hover:bg-background',
                  selected?.name ? 'text-foreground' : 'text-muted-foreground',
                )
              : 'h-10 w-full justify-between font-normal shadow-none',
            !selected?.name && !formStyle && 'text-muted-foreground',
          )}
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            {selected ? (
              <>
                <AdvisorAvatar name={selected.name} size="sm" />
                <span className="truncate">{selected.name}</span>
              </>
            ) : (
              <>
                <UsersGroupRoundedSvgIcon className="size-4 shrink-0 text-muted-foreground" />
                <span>Seleccionar asesor</span>
              </>
            )}
          </span>
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-180',
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={8}
        collisionPadding={16}
        className={formDialogPopoverContentClass}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="p-3">
          <div className="relative mb-3">
            <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar asesor..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={`${formDialogInputClass} h-10 pl-9 text-sm`}
            />
          </div>
          <div className={cn(formDialogScrollListClass, 'max-h-56 space-y-0.5')}>
            {filtered.length === 0 ? (
              <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                Sin resultados
              </p>
            ) : (
              filtered.map((option) => {
                const isSelected = option.id === value;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted/80',
                      isSelected && 'bg-[#e8f5e9] text-foreground dark:bg-green-900/25',
                    )}
                    onClick={() => {
                      onChange(option.id);
                      setOpen(false);
                      setSearch('');
                    }}
                  >
                    <AdvisorAvatar name={option.name} />
                    <span className="min-w-0 flex-1 truncate font-medium">{option.name}</span>
                    {isSelected ? (
                      <Check className="size-4 shrink-0 text-[#13944C]" aria-hidden />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function AssignedAdvisorFormField({
  htmlId,
  value,
  onChange,
  disabled,
  assignModule,
  fallbackName,
  label = 'Asesor asignado',
  formStyle = false,
}: Props) {
  const { activeAdvisors } = useUsers();
  const currentUser = useAppStore((s) => s.currentUser);
  const { hasPermission } = usePermissions();
  const canAssignOthers = canUserReassignCommercialAdvisor(hasPermission, assignModule);
  const effectiveDisabled = disabled || !canAssignOthers;
  const effectiveValue = resolveAdvisorAssigneeId(value, currentUser, canAssignOthers);

  const selectOptions: AdvisorOption[] = useMemo(() => {
    const base = activeAdvisors.map((user) => ({ id: user.id, name: user.name }));
    if (effectiveValue && !base.some((option) => option.id === effectiveValue)) {
      base.unshift({
        id: effectiveValue,
        name:
          fallbackName?.trim() ||
          (effectiveValue === currentUser.id ? currentUser.name : undefined) ||
          'Asesor asignado',
      });
    }
    return base;
  }, [activeAdvisors, effectiveValue, fallbackName, currentUser.id, currentUser.name]);

  const readOnlyLabel =
    fallbackName?.trim() ||
    activeAdvisors.find((user) => user.id === effectiveValue)?.name ||
    (effectiveValue === currentUser.id ? currentUser.name : undefined) ||
    (effectiveValue ? 'Usuario no disponible en lista' : 'Sin asignar');

  const selectValue = useMemo(() => {
    if (effectiveDisabled || selectOptions.length === 0) return '';
    if (effectiveValue && selectOptions.some((option) => option.id === effectiveValue)) {
      return effectiveValue;
    }
    return selectOptions[0]?.id ?? '';
  }, [effectiveDisabled, selectOptions, effectiveValue]);

  useEffect(() => {
    if (effectiveDisabled || !selectValue || selectValue === value.trim()) return;
    onChange(selectValue);
  }, [effectiveDisabled, selectValue, value, onChange]);

  const mutedInputClass = `${formDialogInputClass} bg-muted/40`;

  function renderReadOnly(content: string) {
    const input = (
      <Input
        id={htmlId}
        readOnly
        disabled
        value={content}
        className={formStyle ? mutedInputClass : 'bg-muted/60'}
      />
    );
    if (formStyle) {
      return <FormDialogField label={label}>{input}</FormDialogField>;
    }
    return (
      <div className="space-y-2">
        <Label htmlFor={htmlId}>{label}</Label>
        {input}
      </div>
    );
  }

  if (effectiveDisabled) return renderReadOnly(readOnlyLabel);
  if (selectOptions.length === 0) return renderReadOnly('No hay asesores activos');

  const picker = (
    <AdvisorPickerPopover
      htmlId={htmlId}
      value={selectValue}
      onChange={onChange}
      options={selectOptions}
      disabled={effectiveDisabled}
      formStyle={formStyle}
    />
  );

  if (formStyle) {
    return <FormDialogField label={label}>{picker}</FormDialogField>;
  }

  return (
    <div className="space-y-2">
      <div className="flex min-h-7 items-end">
        <Label htmlFor={htmlId} className="text-sm font-semibold leading-none text-foreground/90">
          {label}
        </Label>
      </div>
      {picker}
    </div>
  );
}
