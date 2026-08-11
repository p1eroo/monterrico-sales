import { useEffect, useRef, useState } from 'react';
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
import { companyTipoLabels } from '@/data/mock';
import type { CompanyRubro, CompanyTipo, ContactSource } from '@/types';
import { api } from '@/lib/api';
import type { ApiCompanyRecord } from '@/lib/companyApi';
import { isLikelyCompanyCuid } from '@/lib/companyApi';
import { useCompaniesStore } from '@/store/companiesStore';
import { useAppStore } from '@/store';
import { canAssignCommercialModule } from '@/data/rbac';
import { resolveAdvisorAssigneeId } from '@/lib/advisorAssigneeDefaults';
import { usePermissions } from '@/hooks/usePermissions';
import { useUsers } from '@/hooks/useUsers';
import { AssignedAdvisorFormField } from '@/components/shared/AssignedAdvisorFormField';
import { useLeadSourceOptions, useRubroOptions } from '@/store/crmConfigStore';

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
  /** Empresa ya cargada (p. ej. ficha detalle): evita re-fetch y bucles de loading. */
  initialRecord?: ApiCompanyRecord | null;
};

function editFormFromApiRecord(
  rec: ApiCompanyRecord,
  currentUser: { id: string },
  activeAdvisors: { id: string }[],
  canAssignOthers: boolean,
) {
  return {
    name: rec.name,
    domain: rec.domain ?? '',
    telefono: rec.telefono ?? '',
    rubro: (rec.rubro?.trim() ?? '') as CompanyRubro | '',
    tipo: (rec.tipo && (rec.tipo === 'A' || rec.tipo === 'B' || rec.tipo === 'C') ? rec.tipo : '') as CompanyTipo | '',
    ruc: rec.ruc ?? '',
    razonSocial: rec.razonSocial ?? '',
    assignedTo: resolveAdvisorAssigneeId(
      rec.assignedTo ?? activeAdvisors[0]?.id,
      currentUser,
      canAssignOthers,
    ),
    fuente: (rec.fuente as ContactSource) || 'base',
  };
}

function editFormFromSummaryRow(row: CompanyEditSummaryRow) {
  return {
    name: row.name,
    domain: '',
    telefono: '',
    rubro: (row.rubro?.trim() ?? '') as CompanyRubro | '',
    tipo: (row.tipo && (row.tipo === 'A' || row.tipo === 'B' || row.tipo === 'C') ? row.tipo : '') as CompanyTipo | '',
    ruc: '',
    razonSocial: '',
    assignedTo: '',
    fuente: (row.fuente as ContactSource) || 'base',
  };
}

export function CompanyEditDialog({
  row,
  open,
  onOpenChange,
  onSave,
  initialRecord,
}: CompanyEditDialogProps) {
  const rowId = row?.id;
  const rowIsLocalOnly = row?.isLocalOnly === true;
  const standalone = useCompaniesStore((s) =>
    rowIsLocalOnly && rowId ? s.companies.find((c) => c.id === rowId) : undefined,
  );
  const { users, activeAdvisors } = useUsers();
  const currentUser = useAppStore((s) => s.currentUser);
  const { hasPermission } = usePermissions();
  const canEditAssignee = canAssignCommercialModule(hasPermission, 'empresas');
  const leadSourceOptions = useLeadSourceOptions();
  const rubroOptions = useRubroOptions();

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
  const loadedSessionKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open || !row || !rowId) {
      loadedSessionKeyRef.current = null;
      setLoadingApi(false);
      return;
    }

    const sessionKey = `${rowId}:${rowIsLocalOnly ? 'local' : 'api'}:${initialRecord?.id ?? 'fetch'}`;
    if (loadedSessionKeyRef.current === sessionKey) return;
    loadedSessionKeyRef.current = sessionKey;

    if (rowIsLocalOnly && standalone) {
      setLoadingApi(false);
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

    if (rowIsLocalOnly) {
      setLoadingApi(false);
      setEditForm(editFormFromSummaryRow(row));
      return;
    }

    if (!isLikelyCompanyCuid(rowId)) {
      setLoadingApi(false);
      setEditForm(editFormFromSummaryRow(row));
      return;
    }

    if (initialRecord && initialRecord.id === rowId) {
      setLoadingApi(false);
      setEditForm(editFormFromApiRecord(initialRecord, currentUser, activeAdvisors, canEditAssignee));
      return;
    }

    let cancelled = false;
    setLoadingApi(true);
    void api<ApiCompanyRecord>(`/companies/${rowId}`)
      .then((rec) => {
        if (cancelled) return;
        setEditForm(editFormFromApiRecord(rec, currentUser, activeAdvisors, canEditAssignee));
      })
      .catch(() => {
        if (!cancelled) {
          setEditForm(editFormFromSummaryRow(row));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingApi(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    open,
    rowId,
    rowIsLocalOnly,
    initialRecord?.id,
    standalone?.id,
    activeAdvisors,
    currentUser,
    canEditAssignee,
  ]);

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
                  {rubroOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
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
              assignModule="empresas"
              disabled={loadingApi}
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
