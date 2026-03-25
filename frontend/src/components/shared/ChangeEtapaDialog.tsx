import { useMemo } from 'react';
import { etapaLabels } from '@/data/mock';
import { SelectDialog } from './SelectDialog';
import { useCrmConfigStore } from '@/store/crmConfigStore';

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
  const bundle = useCrmConfigStore((s) => s.bundle);
  const options = useMemo(() => {
    const st = bundle?.catalog.stages
      ?.filter((x) => x.enabled)
      ?.sort((a, b) => a.sortOrder - b.sortOrder);
    if (st?.length) {
      return st.map((s) => ({ value: s.slug, label: s.name }));
    }
    return Object.entries(etapaLabels).map(([value, label]) => ({ value, label }));
  }, [bundle]);

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
