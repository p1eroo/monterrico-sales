import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FormDialogActions,
  FormDialogField,
  FormDialogGrid,
  FormDialogShell,
  formDialogInputClass,
  formDialogSelectTriggerClass,
} from '@/components/ui/form-dialog';
import { companyRubroLabels, companyTipoLabels } from '@/data/mock';
import type { CompanyRubro, CompanyTipo, ContactSource } from '@/types';
import { api } from '@/lib/api';
import type { ApiCompanyRecord } from '@/lib/companyApi';
import { isLikelyCompanyCuid } from '@/lib/companyApi';
import { useCompaniesStore } from '@/store/companiesStore';
import { useAppStore } from '@/store';
import { canReassignCommercialAdvisor } from '@/data/rbac';
import { resolveAdvisorAssigneeId } from '@/lib/advisorAssigneeDefaults';
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
  const currentUser = useAppStore((s) => s.currentUser);
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
          assignedTo: resolveAdvisorAssigneeId(rec.assignedTo ?? activeAdvisors[0]?.id, currentUser),
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
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      maxWidthClassName="sm:max-w-2xl"
      title="Editar empresa"
      description="Modifica los datos de la empresa."
      footer={loadingApi || saving ? null : (
        <FormDialogActions
          submitLabel="Guardar cambios"
          submitDisabled={!editForm.name.trim()}
          onCancel={() => onOpenChange(false)}
          onSubmit={handleSave}
        />
      )}
    >
      {loadingApi ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Cargando datos…</p>
      ) : saving ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Guardando…</p>
      ) : (
        <div className="space-y-6">
          <FormDialogGrid>
            <FormDialogField label="RUC">
              <Input id="company-edit-ruc" className={formDialogInputClass} placeholder="20XXXXXXXX" value={editForm.ruc} onChange={(e) => setEditForm((f) => ({ ...f, ruc: e.target.value }))} />
            </FormDialogField>
            <FormDialogField label="Razón Social">
              <Input id="company-edit-razon-social" className={formDialogInputClass} placeholder="Razón social" value={editForm.razonSocial} onChange={(e) => setEditForm((f) => ({ ...f, razonSocial: e.target.value }))} />
            </FormDialogField>
            <FormDialogField label="Nombre de la empresa" required>
              <Input id="company-edit-name" className={formDialogInputClass} value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            </FormDialogField>
            <FormDialogField label="Dominio web">
              <Input id="company-edit-domain" className={formDialogInputClass} placeholder="empresa.com" value={editForm.domain} onChange={(e) => setEditForm((f) => ({ ...f, domain: e.target.value }))} />
            </FormDialogField>
            <FormDialogField label="Teléfono">
              <Input id="company-edit-phone" className={formDialogInputClass} placeholder="+51 999 999 999" value={editForm.telefono} onChange={(e) => setEditForm((f) => ({ ...f, telefono: e.target.value }))} />
            </FormDialogField>
            <FormDialogField label="Rubro">
              <Select value={editForm.rubro} onValueChange={(v) => setEditForm((f) => ({ ...f, rubro: v as CompanyRubro }))}>
                <SelectTrigger className={formDialogSelectTriggerClass}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(companyRubroLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormDialogField>
            <FormDialogField label="Tipo">
              <Select value={editForm.tipo} onValueChange={(v) => setEditForm((f) => ({ ...f, tipo: v as CompanyTipo }))}>
                <SelectTrigger className={formDialogSelectTriggerClass}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(companyTipoLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>Tipo {label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormDialogField>
            <AssignedAdvisorFormField
              htmlId="company-list-edit-assigned-to"
              value={editForm.assignedTo}
              onChange={(assignedTo) => setEditForm((f) => ({ ...f, assignedTo }))}
              disabled={!canEditAssignee}
              fallbackName={
                users.find((u) => u.id === editForm.assignedTo)?.name ||
                (!canEditAssignee ? currentUser.name : undefined)
              }
              formStyle
            />
          </FormDialogGrid>
          <FormDialogField label="Fuente">
            <Select value={editForm.fuente} onValueChange={(v) => setEditForm((f) => ({ ...f, fuente: v as ContactSource }))}>
              <SelectTrigger className={formDialogSelectTriggerClass}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                {leadSourceOptions.map(({ value: key, label }) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormDialogField>
        </div>
      )}
    </FormDialogShell>
  );
}
