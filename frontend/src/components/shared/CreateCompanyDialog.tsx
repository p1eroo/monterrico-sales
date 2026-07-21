import { useState } from 'react';
import { toast } from '@/lib/notify';
import type { CompanyRubro, CompanyTipo } from '@/types';
import { companyTipoLabels } from '@/data/mock';
import { useRubroOptions } from '@/store/crmConfigStore';
import { useCompaniesStore } from '@/store/companiesStore';

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

export interface CreateCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateCompanyDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateCompanyDialogProps) {
  const addCompany = useCompaniesStore((s) => s.addCompany);
  const rubroOptions = useRubroOptions();
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [rubro, setRubro] = useState<CompanyRubro | ''>('');
  const [tipo, setTipo] = useState<CompanyTipo | ''>('');

  function handleOpenChange(value: boolean) {
    onOpenChange(value);
    if (!value) {
      setName('');
      setDomain('');
      setRubro('');
      setTipo('');
    }
  }

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('El nombre de la empresa es obligatorio');
      return;
    }
    addCompany({
      name: trimmed,
      domain: domain.trim() || undefined,
      rubro: rubro || undefined,
      tipo: tipo || undefined,
    });
    toast.success(`Empresa "${trimmed}" creada correctamente`);
    handleOpenChange(false);
    onSuccess?.();
  }

  return (
    <FormDialogShell
      open={open}
      onOpenChange={handleOpenChange}
      maxWidthClassName="sm:max-w-md"
      title="Nueva empresa"
      description="Crea una empresa de forma independiente. Podrás vincular contactos después."
      footer={(
        <FormDialogActions
          submitLabel="Crear empresa"
          onCancel={() => handleOpenChange(false)}
          onSubmit={handleSubmit}
        />
      )}
    >
      <div className="space-y-6">
        <FormDialogField label="Nombre de la empresa" required>
          <Input
            id="company-name"
            className={formDialogInputClass}
            placeholder="Ej: Minera Los Andes SAC"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </FormDialogField>
        <FormDialogField label="Dominio web">
          <Input
            id="company-domain"
            className={formDialogInputClass}
            placeholder="Ej: mineraandes.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
          />
        </FormDialogField>
        <FormDialogGrid>
          <FormDialogField label="Rubro">
            <Select value={rubro} onValueChange={(v) => setRubro(v as CompanyRubro | '')}>
              <SelectTrigger className={formDialogSelectTriggerClass}>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {rubroOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormDialogField>
          <FormDialogField label="Tipo">
            <Select value={tipo} onValueChange={(v) => setTipo(v as CompanyTipo | '')}>
              <SelectTrigger className={formDialogSelectTriggerClass}>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(companyTipoLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormDialogField>
        </FormDialogGrid>
      </div>
    </FormDialogShell>
  );
}
