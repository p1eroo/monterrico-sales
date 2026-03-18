import { etapaLabels } from '@/data/mock';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface ChangeEtapaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityName: string;
  currentEtapa: string;
  onEtapaChange: (newEtapa: string) => void;
}

export function ChangeEtapaDialog({
  open,
  onOpenChange,
  entityName,
  currentEtapa,
  onEtapaChange,
}: ChangeEtapaDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambiar Etapa</DialogTitle>
          <DialogDescription>Selecciona la nueva etapa para {entityName}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Nueva etapa</Label>
          <Select value={currentEtapa} onValueChange={onEtapaChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(etapaLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
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
