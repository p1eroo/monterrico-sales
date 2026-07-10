import { useEffect, useState } from 'react';
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
import { companyRubroLabels, companyTipoLabels } from '@/data/mock';
import type { CompanyRubro, CompanyTipo, ContactSource } from '@/types';
import { api } from '@/lib/api';
import type { ApiCompanyRecord } from '@/lib/companyApi';
import { isLikelyCompanyCuid } from '@/lib/companyApi';
import { useCompaniesStore } from '@/store/companiesStore';
import { useAppStore } from '@/store';
import { canReassignCommercialAdvisor } from '@/data/rbac';
import { useUsers } from '@/hooks/useUsers';
import { AssignedAdvisorFormField } from '@/components/shared/AssignedAdvisorFormField';
import { useLeadSourceOptions } from '@/store/crmConfigStore';

export type CompanyEditSavePayload = {
  name: string;
  domain: string;
  telefono: string;
  rubro: string;
  tipo: string;
  ruc: string;
  razonSocial: string;
  assignedTo: string;
  fuente: string;
};

export type CompanyEditSummaryRow = {
  id: string;
  name: string;
  isLocalOnly?: boolean;
  rubro?: string | null;
  tipo?: string | null;
  fuente?: string | null;
};

type CompanyEditDialogProps = {
  row: CompanyEditSummaryRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: CompanyEditSavePayload) => void | Promise<void>;
};

export function CompanyEditDialog({
  row,
  open,
  onOpenChange,
  onSave,
}: CompanyEditDialogProps) {
  const standalone = useCompaniesStore((s) =>
    row?.isLocalOnly ? s.companies.find((c) => c.id === row.id) : undefined,
  );
  const { users, activeAdvisors } = useUsers();
  const currentUserRole = useAppStore((s) => s.currentUser.role ?? '');
  const canEditAssignee = canReassignCommercialAdvisor(currentUserRole);
  const leadSourceOptions = useLeadSourceOptions();

  const [editForm, setEditForm] = useState({
    name: '',
    domain: '',
    telefono: '',
    rubro: '' as CompanyRubro | '',
    tipo: '' as CompanyTipo | '',
    ruc: '',
    razonSocial: '',
    assignedTo: '',
    fuente: 'base' as ContactSource,
  });
  const [saving, setSaving] = useState(false);
  const [loadingApi, setLoadingApi] = useState(false);

  useEffect(() => {
    if (!open || !row) return;

    if (row.isLocalOnly && standalone) {
      setEditForm({
        name: standalone.name,
        domain: standalone.domain ?? '',
        telefono: '',
        rubro: standalone.rubro ?? '',
        tipo: standalone.tipo ?? '',
        ruc: '',
        razonSocial: '',
        assignedTo: '',
        fuente: 'base',
      });
      return;
    }

    if (row.isLocalOnly) {
      setEditForm({
        name: row.name,
        domain: '',
        telefono: '',
        rubro: (row.rubro && row.rubro in companyRubroLabels ? row.rubro : '') as CompanyRubro | '',
        tipo: (row.tipo && (row.tipo === 'A' || row.tipo === 'B' || row.tipo === 'C') ? row.tipo : '') as CompanyTipo | '',
        ruc: '',
        razonSocial: '',
        assignedTo: '',
        fuente: 'base',
      });
      return;
    }

    if (!isLikelyCompanyCuid(row.id)) {
      setEditForm({
        name: row.name,
        domain: '',
        telefono: '',
        rubro: (row.rubro && row.rubro in companyRubroLabels ? row.rubro : '') as CompanyRubro | '',
        tipo: (row.tipo && (row.tipo === 'A' || row.tipo === 'B' || row.tipo === 'C') ? row.tipo : '') as CompanyTipo | '',
        ruc: '',
        razonSocial: '',
        assignedTo: '',
        fuente: (row.fuente as ContactSource) || 'base',
      });
      return;
    }

    let cancelled = false;
    setLoadingApi(true);
    void api<ApiCompanyRecord>(`/companies/${row.id}`)
      .then((rec) => {
        if (cancelled) return;
        setEditForm({
          name: rec.name,
          domain: rec.domain ?? '',
          telefono: rec.telefono ?? '',
          rubro: (rec.rubro && rec.rubro in companyRubroLabels ? rec.rubro : '') as CompanyRubro | '',
          tipo: (rec.tipo && (rec.tipo === 'A' || rec.tipo === 'B' || rec.tipo === 'C') ? rec.tipo : '') as CompanyTipo | '',
          ruc: rec.ruc ?? '',
          razonSocial: rec.razonSocial ?? '',
          assignedTo: rec.assignedTo ?? activeAdvisors[0]?.id ?? '',
          fuente: (rec.fuente as ContactSource) || 'base',
        });
      })
      .catch(() => {
        if (!cancelled) {
          setEditForm({
            name: row.name,
            domain: '',
            telefono: '',
            rubro: (row.rubro && row.rubro in companyRubroLabels ? row.rubro : '') as CompanyRubro | '',
            tipo: (row.tipo && (row.tipo === 'A' || row.tipo === 'B' || row.tipo === 'C') ? row.tipo : '') as CompanyTipo | '',
            ruc: '',
            razonSocial: '',
            assignedTo: '',
            fuente: (row.fuente as ContactSource) || 'base',
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingApi(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, row, standalone]);

  function handleSave() {
    if (!row || !editForm.name.trim()) return;
    const targetRow = row;
    onOpenChange(false);
    setSaving(true);
    void Promise.resolve(onSave({
      name: editForm.name.trim(),
      domain: editForm.domain.trim(),
      telefono: editForm.telefono.trim(),
      rubro: editForm.rubro,
      tipo: editForm.tipo,
      ruc: editForm.ruc.trim(),
      razonSocial: editForm.razonSocial.trim(),
      assignedTo: editForm.assignedTo,
      fuente: editForm.fuente,
    })).finally(() => setSaving(false));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar empresa</DialogTitle>
          <DialogDescription>Modifica los datos de la empresa.</DialogDescription>
        </DialogHeader>
        {loadingApi ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Cargando datos…</p>
        ) : saving ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Guardando…</p>
        ) : (
          <>
            <div className="grid gap-4 py-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="company-edit-ruc">RUC</Label>
                  <Input
                    id="company-edit-ruc"
                    placeholder="20XXXXXXXX"
                    value={editForm.ruc}
                    onChange={(e) => setEditForm((f) => ({ ...f, ruc: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-edit-razon-social">Razón Social</Label>
                  <Input
                    id="company-edit-razon-social"
                    placeholder="Razón social"
                    value={editForm.razonSocial}
                    onChange={(e) => setEditForm((f) => ({ ...f, razonSocial: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="company-edit-name">Nombre de la empresa *</Label>
                  <Input
                    id="company-edit-name"
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-edit-domain">Dominio web</Label>
                  <Input
                    id="company-edit-domain"
                    placeholder="empresa.com"
                    value={editForm.domain}
                    onChange={(e) => setEditForm((f) => ({ ...f, domain: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="company-edit-phone">Teléfono</Label>
                  <Input
                    id="company-edit-phone"
                    placeholder="+51 999 999 999"
                    value={editForm.telefono}
                    onChange={(e) => setEditForm((f) => ({ ...f, telefono: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rubro</Label>
                  <Select
                    value={editForm.rubro}
                    onValueChange={(v) => setEditForm((f) => ({ ...f, rubro: v as CompanyRubro }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(companyRubroLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={editForm.tipo}
                    onValueChange={(v) => setEditForm((f) => ({ ...f, tipo: v as CompanyTipo }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(companyTipoLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          Tipo {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <AssignedAdvisorFormField
                  htmlId="company-list-edit-assigned-to"
                  value={editForm.assignedTo}
                  onChange={(assignedTo) => setEditForm((f) => ({ ...f, assignedTo }))}
                  disabled={!canEditAssignee}
                  fallbackName={users.find((u) => u.id === editForm.assignedTo)?.name}
                />
              </div>
              <div className="space-y-2">
                <Label>Fuente</Label>
                <Select
                  value={editForm.fuente}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, fuente: v as ContactSource }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {leadSourceOptions.map(({ value: key, label }) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={() => void handleSave()} disabled={!editForm.name.trim() || saving}>
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
