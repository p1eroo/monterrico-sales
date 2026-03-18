import { users } from '@/data/mock';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asignar Asesor</DialogTitle>
          <DialogDescription>Selecciona el asesor para {entityName}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Asesor</Label>
          <Select value={currentAssigneeId} onValueChange={onAssignChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {users.filter((u) => u.status === 'activo').map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
