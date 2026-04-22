import { useEffect, useState } from 'react';
import type { Contact, ContactSource } from '@/types';
import { contactSourceLabels } from '@/data/mock';
import { useUsers } from '@/hooks/useUsers';
import { AssignedAdvisorFormField } from '@/components/shared/AssignedAdvisorFormField';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type ContactEditSavePayload = {
  name: string;
  cargo: string;
  telefono: string;
  correo: string;
  fuente: ContactSource;
  estimatedValue: number;
  /** Solo enviado cuando el usuario puede reasignar asesor. */
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
  const [editForm, setEditForm] = useState({
    name: '',
    cargo: '',
    telefono: '',
    correo: '',
    fuente: 'base' as ContactSource,
    estimatedValue: 0,
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
        estimatedValue: contact.estimatedValue,
        assignedTo: contact.assignedTo || activeAdvisors[0]?.id || '',
      });
    }
  }, [open, contact, activeAdvisors]);

  async function handleSave() {
    if (!contact || !editForm.name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: editForm.name.trim(),
        cargo: editForm.cargo.trim(),
        telefono: editForm.telefono.trim(),
        correo: editForm.correo.trim(),
        fuente: editForm.fuente,
        estimatedValue: editForm.estimatedValue,
        ...(canEditAssignee ? { assignedTo: editForm.assignedTo } : {}),
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Contacto</DialogTitle>
          <DialogDescription>Modifica los datos del contacto.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact-edit-name">Nombre</Label>
              <Input
                id="contact-edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-edit-cargo">Cargo</Label>
              <Input
                id="contact-edit-cargo"
                value={editForm.cargo}
                onChange={(e) => setEditForm((f) => ({ ...f, cargo: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact-edit-phone">Teléfono</Label>
              <Input
                id="contact-edit-phone"
                value={editForm.telefono}
                onChange={(e) => setEditForm((f) => ({ ...f, telefono: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-edit-email">Correo</Label>
              <Input
                id="contact-edit-email"
                type="email"
                value={editForm.correo}
                onChange={(e) => setEditForm((f) => ({ ...f, correo: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Fuente</Label>
            <Select
              value={editForm.fuente}
              onValueChange={(v) => setEditForm((f) => ({ ...f, fuente: v as ContactSource }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(contactSourceLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-edit-value">Valor estimado (S/)</Label>
            <Input
              id="contact-edit-value"
              type="number"
              min={0}
              value={editForm.estimatedValue}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, estimatedValue: Number(e.target.value) }))
              }
            />
          </div>
          <AssignedAdvisorFormField
            htmlId="contact-edit-assigned-to"
            value={editForm.assignedTo}
            onChange={(assignedTo) => setEditForm((f) => ({ ...f, assignedTo }))}
            disabled={!canEditAssignee}
            fallbackName={contact?.assignedToName}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSave()} disabled={!editForm.name.trim() || saving}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
