import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { toast } from '@/lib/notify';
import type { Opportunity } from '@/types';
import { isLikelyOpportunityCuid } from '@/lib/opportunityApi';
import { useUsers } from '@/hooks/useUsers';
import { useAppStore } from '@/store';
import { canReassignCommercialAdvisor } from '@/data/rbac';
import { AssignedAdvisorFormField } from '@/components/shared/AssignedAdvisorFormField';
import {
  FormDialogActions,
  FormDialogField,
  FormDialogGrid,
  FormDialogShell,
  formDialogInputClass,
} from '@/components/ui/form-dialog';

export type OpportunityEditSavePayload = {
  title: string;
  amount: number;
  expectedCloseDate: string | null;
  assignedTo?: string;
};

export type OpportunityEditDialogProps = {
  opportunity: Opportunity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: OpportunityEditSavePayload) => void | Promise<void>;
  /** Muestra el selector de asesor (ficha de oportunidad). */
  showAssignedAdvisor?: boolean;
  /** Permite guardar oportunidades locales sin cuid de API. */
  allowWithoutApiId?: boolean;
};

export function OpportunityEditDialog({
  opportunity,
  open,
  onOpenChange,
  onSave,
  showAssignedAdvisor = false,
  allowWithoutApiId = false,
}: OpportunityEditDialogProps) {
  const { users } = useUsers();
  const currentUserRole = useAppStore((s) => s.currentUser.role ?? '');
  const canEditAssignee = canReassignCommercialAdvisor(currentUserRole);

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState(0);
  const [expectedCloseDate, setExpectedCloseDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!opportunity || !open) return;
    setTitle(opportunity.title);
    setAmount(opportunity.amount);
    setExpectedCloseDate(
      opportunity.expectedCloseDate
        ? opportunity.expectedCloseDate.slice(0, 10)
        : '',
    );
    setAssignedTo(opportunity.assignedTo ?? '');
  }, [opportunity, open]);

  function handleSave() {
    if (!opportunity?.id || !title.trim()) return;
    if (!allowWithoutApiId && !isLikelyOpportunityCuid(opportunity.id)) {
      toast.error('Solo se pueden editar oportunidades guardadas');
      return;
    }
    setSaving(true);
    onOpenChange(false);
    void Promise.resolve(onSave({
      title: title.trim(),
      amount,
      expectedCloseDate: expectedCloseDate || null,
      ...(showAssignedAdvisor ? { assignedTo } : {}),
    })).catch((e) => {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    }).finally(() => setSaving(false));
  }

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      maxWidthClassName="sm:max-w-lg"
      title="Editar oportunidad"
      description="Modifica los datos de la oportunidad."
      footer={saving ? null : (
        <FormDialogActions
          submitLabel="Guardar cambios"
          submitDisabled={!title.trim()}
          onCancel={() => onOpenChange(false)}
          onSubmit={handleSave}
        />
      )}
    >
      {saving ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Guardando…</p>
      ) : (
        <div className="space-y-6">
          <FormDialogField label="Nombre" required>
            <Input className={formDialogInputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
          </FormDialogField>
          <FormDialogGrid>
            <FormDialogField label="Monto (S/)">
              <Input
                type="number"
                className={formDialogInputClass}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </FormDialogField>
            <FormDialogField label="Fecha estimada de cierre">
              <Input
                type="date"
                className={formDialogInputClass}
                value={expectedCloseDate}
                onChange={(e) => setExpectedCloseDate(e.target.value)}
              />
            </FormDialogField>
            {showAssignedAdvisor ? (
              <AssignedAdvisorFormField
                htmlId="opp-edit-assigned-to"
                value={assignedTo}
                onChange={setAssignedTo}
                disabled={!canEditAssignee}
                fallbackName={
                  users.find((u) => u.id === assignedTo)?.name ?? opportunity?.assignedToName
                }
                formStyle
              />
            ) : null}
          </FormDialogGrid>
        </div>
      )}
    </FormDialogShell>
  );
}
