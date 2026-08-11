import { useEffect, useState } from 'react';
import type { Contact, ContactSource } from '@/types';
import { useLeadSourceOptions } from '@/store/crmConfigStore';
import { useUsers } from '@/hooks/useUsers';
import { useAppStore } from '@/store';
import { resolveAdvisorAssigneeId } from '@/lib/advisorAssigneeDefaults';
import { AssignedAdvisorFormField } from '@/components/shared/AssignedAdvisorFormField';
import { Input } from '@/components/ui/input';
import {
  FormDialogActions,
  FormDialogField,
  FormDialogGrid,
  FormDialogShell,
  formDialogInputClass,
  formDialogSelectTriggerClass,
} from '@/components/ui/form-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

export type ContactEditSavePayload = {
  name: string;
  cargo: string;
  telefono: string;
  correo: string;
  fuente: ContactSource;
  assignedTo?: string;
};

type ContactEditDialogProps = {
  contact: Contact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: ContactEditSavePayload) => void | Promise<void>;
  canEditAssignee: boolean;
};

export function ContactEditDialog({
  contact,
  open,
  onOpenChange,
  onSave,
  canEditAssignee,
}: ContactEditDialogProps) {
  const { activeAdvisors } = useUsers();
  const currentUser = useAppStore((s) => s.currentUser);
  const leadSourceOptions = useLeadSourceOptions();
  const [editForm, setEditForm] = useState({
    name: '',
    cargo: '',
    telefono: '',
    correo: '',
    fuente: 'base' as ContactSource,
    assignedTo: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && contact) {
      setEditForm({
        name: contact.name,
        cargo: contact.cargo ?? '',
        telefono: contact.telefono,
        correo: contact.correo,
        fuente: contact.fuente,
        assignedTo: resolveAdvisorAssigneeId(contact.assignedTo, currentUser, canEditAssignee) || activeAdvisors[0]?.id || '',
      });
    }
  }, [open, contact, activeAdvisors, currentUser, canEditAssignee]);

  function handleSave() {
    if (!contact || !editForm.name.trim()) return;
    setSaving(true);
    onOpenChange(false);
    void Promise.resolve(onSave({
      name: editForm.name.trim(),
      cargo: editForm.cargo.trim(),
      telefono: editForm.telefono.trim(),
      correo: editForm.correo.trim(),
      fuente: editForm.fuente,
      ...(canEditAssignee ? { assignedTo: editForm.assignedTo } : {}),
    })).finally(() => setSaving(false));
  }

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      maxWidthClassName="sm:max-w-lg"
      title="Editar Contacto"
      description="Modifica los datos del contacto."
      footer={saving ? null : (
        <FormDialogActions
          submitLabel="Guardar cambios"
          submitDisabled={!editForm.name.trim()}
          onCancel={() => onOpenChange(false)}
          onSubmit={handleSave}
        />
      )}
    >
      {saving ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Guardando…</p>
      ) : (
        <div className="space-y-6">
          <FormDialogGrid>
            <FormDialogField label="Nombre">
              <Input
                id="contact-edit-name"
                className={formDialogInputClass}
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
            </FormDialogField>
            <FormDialogField label="Cargo">
              <Input
                id="contact-edit-cargo"
                className={formDialogInputClass}
                value={editForm.cargo}
                onChange={(e) => setEditForm((f) => ({ ...f, cargo: e.target.value }))}
              />
            </FormDialogField>
            <FormDialogField label="Teléfono">
              <Input
                id="contact-edit-phone"
                className={formDialogInputClass}
                value={editForm.telefono}
                onChange={(e) => setEditForm((f) => ({ ...f, telefono: e.target.value }))}
              />
            </FormDialogField>
            <FormDialogField label="Correo">
              <Input
                id="contact-edit-email"
                type="email"
                className={formDialogInputClass}
                value={editForm.correo}
                onChange={(e) => setEditForm((f) => ({ ...f, correo: e.target.value }))}
              />
            </FormDialogField>
          </FormDialogGrid>
          <FormDialogField label="Fuente">
            <Select
              value={editForm.fuente}
              onValueChange={(v) => setEditForm((f) => ({ ...f, fuente: v as ContactSource }))}
            >
              <SelectTrigger className={formDialogSelectTriggerClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {leadSourceOptions.map(({ value: key, label }) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormDialogField>
          <AssignedAdvisorFormField
            htmlId="contact-edit-assigned-to"
            value={editForm.assignedTo}
            onChange={(assignedTo) => setEditForm((f) => ({ ...f, assignedTo }))}
            assignModule="contactos"
            disabled={false}
            fallbackName={contact?.assignedToName || currentUser.name}
            formStyle
          />
        </div>
      )}
    </FormDialogShell>
  );
}
