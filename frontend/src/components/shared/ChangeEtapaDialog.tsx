import { etapaLabels } from '@/data/mock';
import { SelectDialog } from './SelectDialog';

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
  const options = Object.entries(etapaLabels).map(([value, label]) => ({
    value,
    label,
  }));

  return (
    <SelectDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Cambiar Etapa"
      description={`Selecciona la nueva etapa para ${entityName}.`}
      label="Nueva etapa"
      value={currentEtapa}
      onValueChange={onEtapaChange}
      options={options}
    />
  );
}
