import { useMemo } from 'react';
import { useUsers } from '@/hooks/useUsers';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  /** Nombre mostrado si el usuario asignado no está en la lista de asesores activos. */
  fallbackName?: string | null;
  label?: string;
};

export function AssignedAdvisorFormField({
  htmlId,
  value,
  onChange,
  disabled,
  fallbackName,
  label = 'Asesor asignado',
}: Props) {
  const { activeAdvisors } = useUsers();

  const selectOptions: AdvisorOption[] = useMemo(() => {
    const base = activeAdvisors.map((u) => ({ id: u.id, name: u.name }));
    if (value && !base.some((o) => o.id === value)) {
      base.unshift({
        id: value,
        name: fallbackName?.trim() || 'Asesor asignado',
      });
    }
    return base;
  }, [activeAdvisors, value, fallbackName]);

  const readOnlyLabel =
    fallbackName?.trim() ||
    activeAdvisors.find((u) => u.id === value)?.name ||
    (value ? 'Usuario no disponible en lista' : 'Sin asignar');

  if (disabled) {
    return (
      <div className="space-y-2">
        <Label htmlFor={htmlId}>{label}</Label>
        <Input id={htmlId} readOnly disabled value={readOnlyLabel} className="bg-muted/60" />
      </div>
    );
  }

  if (selectOptions.length === 0) {
    return (
      <div className="space-y-2">
        <Label htmlFor={htmlId}>{label}</Label>
        <Input id={htmlId} readOnly disabled value="No hay asesores activos" className="bg-muted/60" />
      </div>
    );
  }

  const selectValue =
    value && selectOptions.some((o) => o.id === value) ? value : (selectOptions[0]?.id ?? '');

  return (
    <div className="space-y-2">
      <Label htmlFor={htmlId}>{label}</Label>
      <Select value={selectValue} onValueChange={onChange}>
        <SelectTrigger id={htmlId} className="w-full">
          <SelectValue placeholder="Seleccionar asesor" />
        </SelectTrigger>
        <SelectContent>
          {selectOptions.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
