import { useEffect, useMemo } from 'react';
import { useUsers } from '@/hooks/useUsers';
import { useAppStore } from '@/store';
import { resolveAdvisorAssigneeId, canUserReassignCommercialAdvisor } from '@/lib/advisorAssigneeDefaults';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  FormDialogField,
  formDialogInputClass,
  formDialogSelectTriggerClass,
} from '@/components/ui/form-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type AdvisorOption = { id: string; name: string };

type Props = {
  htmlId: string;
  value: string;
  onChange: (userId: string) => void;
  disabled: boolean;
  fallbackName?: string | null;
  label?: string;
  formStyle?: boolean;
};

export function AssignedAdvisorFormField({
  htmlId,
  value,
  onChange,
  disabled,
  fallbackName,
  label = 'Asesor asignado',
  formStyle = false,
}: Props) {
  const { activeAdvisors } = useUsers();
  const currentUser = useAppStore((s) => s.currentUser);
  const canReassign = canUserReassignCommercialAdvisor(currentUser.role);
  const effectiveDisabled = disabled || !canReassign;
  const effectiveValue = resolveAdvisorAssigneeId(value, currentUser);

  const selectOptions: AdvisorOption[] = useMemo(() => {
    const base = activeAdvisors.map((u) => ({ id: u.id, name: u.name }));
    if (effectiveValue && !base.some((o) => o.id === effectiveValue)) {
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
    activeAdvisors.find((u) => u.id === effectiveValue)?.name ||
    (effectiveValue === currentUser.id ? currentUser.name : undefined) ||
    (effectiveValue ? 'Usuario no disponible en lista' : 'Sin asignar');

  const selectValue = useMemo(() => {
    if (effectiveDisabled || selectOptions.length === 0) return '';
    if (effectiveValue && selectOptions.some((o) => o.id === effectiveValue)) {
      return effectiveValue;
    }
    return selectOptions[0]?.id ?? '';
  }, [effectiveDisabled, selectOptions, effectiveValue]);

  // El Select puede mostrar un asesor por defecto sin que el padre tenga el id aún (p. ej. admin).
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

  const select = (
    <Select value={selectValue} onValueChange={onChange}>
      <SelectTrigger id={htmlId} className={formStyle ? formDialogSelectTriggerClass : 'w-full'}>
        <SelectValue placeholder="Seleccionar asesor" />
      </SelectTrigger>
      <SelectContent>
        {selectOptions.map((u) => (
          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (formStyle) {
    return <FormDialogField label={label}>{select}</FormDialogField>;
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={htmlId}>{label}</Label>
      {select}
    </div>
  );
}
