import { useUsers } from '@/hooks/useUsers';
import { SelectDialog } from './SelectDialog';

interface AssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityName: string;
  currentAssigneeId: string;
  onAssignChange: (newAssigneeId: string) => void;
}

export function AssignDialog({
  open,
  onOpenChange,
  entityName,
  currentAssigneeId,
  onAssignChange,
}: AssignDialogProps) {
  const { activeUsers } = useUsers();
  const options = activeUsers.map((u) => ({ value: u.id, label: u.name }));

  return (
    <SelectDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Asignar Asesor"
      description={`Selecciona el asesor para ${entityName}.`}
      label="Asesor"
      value={currentAssigneeId}
      onValueChange={onAssignChange}
      options={options}
    />
  );
}
