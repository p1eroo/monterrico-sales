import { useEffect, useMemo, useState } from 'react';
import { AssignedAdvisorFormField } from '@/components/shared/AssignedAdvisorFormField';
import {
  FormDialogActions,
  FormDialogShell,
} from '@/components/ui/form-dialog';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  entityLabel: string;
  onConfirm: (advisorId: string) => void | Promise<void>;
  confirming?: boolean;
};

export function BatchReassignAdvisorDialog({
  open,
  onOpenChange,
  count,
  entityLabel,
  onConfirm,
  confirming = false,
}: Props) {
  const [advisorId, setAdvisorId] = useState('');

  useEffect(() => {
    if (!open) setAdvisorId('');
  }, [open]);

  const description = useMemo(() => {
    const base = `Selecciona el asesor al que deseas reasignar ${count} ${entityLabel}.`;
    if (entityLabel.startsWith('empresa')) {
      return `${base} También se reasignarán sus contactos y oportunidades vinculados.`;
    }
    return base;
  }, [count, entityLabel]);

  async function handleConfirm() {
    if (!advisorId.trim()) return;
    await onConfirm(advisorId.trim());
  }

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      maxWidthClassName="sm:max-w-lg"
      title="Reasignar asesor"
      description={description}
      footer={
        <FormDialogActions
          submitting={confirming}
          submitLabel={`Reasignar ${count}`}
          submitDisabled={!advisorId.trim()}
          onCancel={() => onOpenChange(false)}
          onSubmit={() => void handleConfirm()}
        />
      }
    >
      <AssignedAdvisorFormField
        htmlId="batch-reassign-advisor"
        value={advisorId}
        onChange={setAdvisorId}
        disabled={confirming}
        label="Nuevo asesor"
        formStyle
      />
    </FormDialogShell>
  );
}
