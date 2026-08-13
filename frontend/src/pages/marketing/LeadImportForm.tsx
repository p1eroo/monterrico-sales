import { Building2, Target, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FormDialogField,
  FormDialogGrid,
  formDialogInputClass,
  formDialogNestedContentClass,
  formDialogSelectTriggerClass,
  formDialogTextareaClass,
} from '@/components/ui/form-dialog';
import { cn } from '@/lib/utils';
import { CIUDAD_OPTIONS, MODALIDAD_OPTIONS } from '@/lib/flotaProspectosApi';
import { etapaLabels } from '@/data/mock';
import { useCrmConfigStore } from '@/store/crmConfigStore';

export type LeadImportTarget = 'flota' | 'comercial';
export type ComercialEntityType = 'contacto' | 'empresa' | 'oportunidad';

export const EMPTY_FLOTA_IMPORT = {
  nombreCompleto: '',
  celular: '',
  edad: '',
  placa: '',
  anioVehiculo: '',
  redSocial: '',
  operador: '',
  modalidad: '',
  ciudad: '',
  distrito: '',
  observaciones: '',
};

export const EMPTY_COMERCIAL_IMPORT = {
  name: '',
  telefono: '',
  correo: '',
  cargo: '',
  notes: '',
};

export const EMPTY_EMPRESA_IMPORT = {
  name: '',
  ruc: '',
  telefono: '',
  correo: '',
  dominio: '',
  distrito: '',
  notes: '',
};

export const EMPTY_OPORTUNIDAD_IMPORT = {
  title: '',
  amount: '',
  etapa: 'lead',
  expectedCloseDate: '',
  contactName: '',
  telefono: '',
  correo: '',
};

export type FlotaImportForm = typeof EMPTY_FLOTA_IMPORT;
export type ComercialImportForm = typeof EMPTY_COMERCIAL_IMPORT;
export type EmpresaImportForm = typeof EMPTY_EMPRESA_IMPORT;
export type OportunidadImportForm = typeof EMPTY_OPORTUNIDAD_IMPORT;

export function applyLeadImportPreview<T extends Record<string, string>>(empty: T, preview: Record<string, string>): T {
  const next = { ...empty };
  for (const key of Object.keys(empty) as (keyof T)[]) {
    const v = preview[key as string];
    if (typeof v === 'string') next[key] = v;
  }
  return next;
}

const COMERCIAL_ENTITY_OPTIONS: {
  id: ComercialEntityType;
  title: string;
  description: string;
  icon: typeof User;
}[] = [
  { id: 'contacto', title: 'Contacto', description: 'Persona en el CRM comercial', icon: User },
  { id: 'empresa', title: 'Empresa', description: 'Cuenta o negocio', icon: Building2 },
  { id: 'oportunidad', title: 'Oportunidad', description: 'Negocio en pipeline, con su contacto', icon: Target },
];

export function ComercialEntityPicker({
  onSelect,
}: {
  onSelect: (entity: ComercialEntityType) => void;
}) {
  return (
    <div className="grid gap-2">
      {COMERCIAL_ENTITY_OPTIONS.map((opt) => {
        const Icon = opt.icon;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onSelect(opt.id)}
            className="flex items-start gap-3 rounded-xl border border-border/70 bg-background px-3.5 py-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
          >
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
              <Icon className="size-4" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-foreground">{opt.title}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{opt.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function LeadImportForm({
  target,
  comercialEntity = 'contacto',
  flota,
  comercial,
  empresa,
  oportunidad,
  onFlotaChange,
  onComercialChange,
  onEmpresaChange,
  onOportunidadChange,
}: {
  target: LeadImportTarget;
  comercialEntity?: ComercialEntityType;
  flota: FlotaImportForm;
  comercial: ComercialImportForm;
  empresa: EmpresaImportForm;
  oportunidad: OportunidadImportForm;
  onFlotaChange: (next: FlotaImportForm) => void;
  onComercialChange: (next: ComercialImportForm) => void;
  onEmpresaChange: (next: EmpresaImportForm) => void;
  onOportunidadChange: (next: OportunidadImportForm) => void;
}) {
  const bundle = useCrmConfigStore((s) => s.bundle);
  const etapas = bundle?.catalog.stages
    ?.filter((s) => s.enabled)
    ?.slice()
    ?.sort((a, b) => a.sortOrder - b.sortOrder)
    ?.map((s) => ({ value: s.slug, label: s.name }))
    ?? Object.entries(etapaLabels).map(([value, label]) => ({ value, label }));

  if (target === 'comercial' && comercialEntity === 'contacto') {
    return (
      <FormDialogGrid>
        <FormDialogField label="Nombre completo" required>
          <Input
            value={comercial.name}
            onChange={(e) => onComercialChange({ ...comercial, name: e.target.value })}
            className={formDialogInputClass}
          />
        </FormDialogField>
        <FormDialogField label="Teléfono">
          <Input
            value={comercial.telefono}
            onChange={(e) => onComercialChange({ ...comercial, telefono: e.target.value })}
            className={cn(formDialogInputClass, 'font-mono')}
          />
        </FormDialogField>
        <FormDialogField label="Email">
          <Input
            value={comercial.correo}
            onChange={(e) => onComercialChange({ ...comercial, correo: e.target.value })}
            className={formDialogInputClass}
          />
        </FormDialogField>
        <FormDialogField label="Cargo">
          <Input
            value={comercial.cargo}
            onChange={(e) => onComercialChange({ ...comercial, cargo: e.target.value })}
            className={formDialogInputClass}
          />
        </FormDialogField>
        <FormDialogField label="Fuente">
          <Input readOnly value="Facebook" className={formDialogInputClass} />
        </FormDialogField>
        <FormDialogField label="Notas" compactControl={false}>
          <Textarea
            value={comercial.notes}
            onChange={(e) => onComercialChange({ ...comercial, notes: e.target.value })}
            className={formDialogTextareaClass}
            rows={4}
          />
        </FormDialogField>
      </FormDialogGrid>
    );
  }

  if (target === 'comercial' && comercialEntity === 'empresa') {
    return (
      <FormDialogGrid>
        <FormDialogField label="Nombre de la empresa" required>
          <Input
            value={empresa.name}
            onChange={(e) => onEmpresaChange({ ...empresa, name: e.target.value })}
            className={formDialogInputClass}
          />
        </FormDialogField>
        <FormDialogField label="RUC">
          <Input
            value={empresa.ruc}
            onChange={(e) => onEmpresaChange({ ...empresa, ruc: e.target.value })}
            className={cn(formDialogInputClass, 'font-mono')}
          />
        </FormDialogField>
        <FormDialogField label="Teléfono">
          <Input
            value={empresa.telefono}
            onChange={(e) => onEmpresaChange({ ...empresa, telefono: e.target.value })}
            className={cn(formDialogInputClass, 'font-mono')}
          />
        </FormDialogField>
        <FormDialogField label="Email">
          <Input
            value={empresa.correo}
            onChange={(e) => onEmpresaChange({ ...empresa, correo: e.target.value })}
            className={formDialogInputClass}
          />
        </FormDialogField>
        <FormDialogField label="Dominio">
          <Input
            value={empresa.dominio}
            onChange={(e) => onEmpresaChange({ ...empresa, dominio: e.target.value })}
            className={formDialogInputClass}
            placeholder="empresa.com"
          />
        </FormDialogField>
        <FormDialogField label="Distrito">
          <Input
            value={empresa.distrito}
            onChange={(e) => onEmpresaChange({ ...empresa, distrito: e.target.value })}
            className={formDialogInputClass}
          />
        </FormDialogField>
        <FormDialogField label="Fuente">
          <Input readOnly value="Facebook" className={formDialogInputClass} />
        </FormDialogField>
        <FormDialogField label="Notas" compactControl={false}>
          <Textarea
            value={empresa.notes}
            onChange={(e) => onEmpresaChange({ ...empresa, notes: e.target.value })}
            className={formDialogTextareaClass}
            rows={4}
          />
        </FormDialogField>
      </FormDialogGrid>
    );
  }

  if (target === 'comercial' && comercialEntity === 'oportunidad') {
    return (
      <FormDialogGrid>
        <FormDialogField label="Título" required>
          <Input
            value={oportunidad.title}
            onChange={(e) => onOportunidadChange({ ...oportunidad, title: e.target.value })}
            className={formDialogInputClass}
          />
        </FormDialogField>
        <FormDialogField label="Monto estimado" required>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={oportunidad.amount}
            onChange={(e) => onOportunidadChange({ ...oportunidad, amount: e.target.value })}
            className={cn(formDialogInputClass, 'font-mono')}
          />
        </FormDialogField>
        <FormDialogField label="Etapa">
          <Select
            value={oportunidad.etapa || 'lead'}
            onValueChange={(v) => onOportunidadChange({ ...oportunidad, etapa: v })}
          >
            <SelectTrigger className={formDialogSelectTriggerClass}>
              <SelectValue placeholder="Etapa" />
            </SelectTrigger>
            <SelectContent className={formDialogNestedContentClass}>
              {etapas.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormDialogField>
        <FormDialogField label="Fecha de cierre" required>
          <Input
            type="date"
            value={oportunidad.expectedCloseDate}
            onChange={(e) => onOportunidadChange({ ...oportunidad, expectedCloseDate: e.target.value })}
            className={formDialogInputClass}
          />
        </FormDialogField>
        <FormDialogField label="Contacto" required>
          <Input
            value={oportunidad.contactName}
            onChange={(e) => onOportunidadChange({ ...oportunidad, contactName: e.target.value })}
            className={formDialogInputClass}
          />
        </FormDialogField>
        <FormDialogField label="Teléfono">
          <Input
            value={oportunidad.telefono}
            onChange={(e) => onOportunidadChange({ ...oportunidad, telefono: e.target.value })}
            className={cn(formDialogInputClass, 'font-mono')}
          />
        </FormDialogField>
        <FormDialogField label="Email">
          <Input
            value={oportunidad.correo}
            onChange={(e) => onOportunidadChange({ ...oportunidad, correo: e.target.value })}
            className={formDialogInputClass}
          />
        </FormDialogField>
        <FormDialogField label="Fuente">
          <Input readOnly value="Facebook" className={formDialogInputClass} />
        </FormDialogField>
      </FormDialogGrid>
    );
  }

  return (
    <FormDialogGrid className="sm:grid-cols-2 sm:gap-x-4">
      <FormDialogField label="Nombre completo" required className="sm:col-span-2">
        <Input
          value={flota.nombreCompleto}
          onChange={(e) => onFlotaChange({ ...flota, nombreCompleto: e.target.value })}
          className={formDialogInputClass}
        />
      </FormDialogField>
      <FormDialogField label="Celular" required>
        <Input
          value={flota.celular}
          onChange={(e) => onFlotaChange({ ...flota, celular: e.target.value.replace(/\D/g, '').slice(0, 9) })}
          className={cn(formDialogInputClass, 'font-mono')}
          placeholder="999999999"
        />
      </FormDialogField>
      <FormDialogField label="Edad">
        <Input
          type="number"
          value={flota.edad}
          onChange={(e) => onFlotaChange({ ...flota, edad: e.target.value })}
          className={formDialogInputClass}
        />
      </FormDialogField>
      <FormDialogField label="Placa">
        <Input
          value={flota.placa}
          onChange={(e) => onFlotaChange({ ...flota, placa: e.target.value.toUpperCase() })}
          className={formDialogInputClass}
        />
      </FormDialogField>
      <FormDialogField label="Año vehículo">
        <Input
          type="number"
          value={flota.anioVehiculo}
          onChange={(e) => onFlotaChange({ ...flota, anioVehiculo: e.target.value })}
          className={formDialogInputClass}
        />
      </FormDialogField>
      <FormDialogField label="Red social">
        <Input
          value={flota.redSocial}
          onChange={(e) => onFlotaChange({ ...flota, redSocial: e.target.value })}
          className={formDialogInputClass}
        />
      </FormDialogField>
      <FormDialogField label="Operador">
        <Input
          value={flota.operador}
          onChange={(e) => onFlotaChange({ ...flota, operador: e.target.value })}
          className={formDialogInputClass}
        />
      </FormDialogField>
      <FormDialogField label="Modalidad">
        <Select
          value={flota.modalidad || '__none__'}
          onValueChange={(v) => onFlotaChange({ ...flota, modalidad: v === '__none__' ? '' : v })}
        >
          <SelectTrigger className={formDialogSelectTriggerClass}>
            <SelectValue placeholder="Sin modalidad" />
          </SelectTrigger>
          <SelectContent className={formDialogNestedContentClass}>
            <SelectItem value="__none__">Sin modalidad</SelectItem>
            {MODALIDAD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormDialogField>
      <FormDialogField label="Ciudad">
        <Select
          value={flota.ciudad || '__none__'}
          onValueChange={(v) => onFlotaChange({ ...flota, ciudad: v === '__none__' ? '' : v })}
        >
          <SelectTrigger className={formDialogSelectTriggerClass}>
            <SelectValue placeholder="Sin ciudad" />
          </SelectTrigger>
          <SelectContent className={formDialogNestedContentClass}>
            <SelectItem value="__none__">Sin ciudad</SelectItem>
            {CIUDAD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormDialogField>
      <FormDialogField label="Distrito">
        <Input
          value={flota.distrito}
          onChange={(e) => onFlotaChange({ ...flota, distrito: e.target.value })}
          className={formDialogInputClass}
        />
      </FormDialogField>
      <FormDialogField label="Observaciones" compactControl={false} className="sm:col-span-2">
        <Textarea
          value={flota.observaciones}
          onChange={(e) => onFlotaChange({ ...flota, observaciones: e.target.value })}
          className={formDialogTextareaClass}
          rows={4}
        />
      </FormDialogField>
    </FormDialogGrid>
  );
}
