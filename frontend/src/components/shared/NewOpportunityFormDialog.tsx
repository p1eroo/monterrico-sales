import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  User, Building2, ChevronsUpDown, X,
} from 'lucide-react';
import type { ContactPriority, ContactSource } from '@/types';
import { etapaLabels, contactSourceLabels } from '@/data/mock';
import { useUsers } from '@/hooks/useUsers';
import { useAppStore } from '@/store';
import { canUserReassignCommercialAdvisor, resolveAdvisorAssigneeId } from '@/lib/advisorAssigneeDefaults';
import { usePermissions } from '@/hooks/usePermissions';
import { AssignedAdvisorFormField } from '@/components/shared/AssignedAdvisorFormField';
import { useCRMStore } from '@/store/crmStore';
import { useCrmConfigStore, getSourceLabelFromCatalog } from '@/store/crmConfigStore';
import { getPrimaryCompany, cn } from '@/lib/utils';
import { LinkExistingDialog, type LinkExistingItem } from '@/components/shared/LinkExistingDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FormDialogActions,
  FormDialogField,
  FormDialogFieldError,
  FormDialogGrid,
  FormDialogShell,
  formDialogInputClass,
  formDialogLinkPickerClass,
  formDialogSelectTriggerClass,
  formDialogNestedOverlayClass,
  formDialogNestedContentClass,
} from '@/components/ui/form-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  type ApiContactListRow,
  isLikelyContactCuid,
  mapApiContactRowToContact,
} from '@/lib/contactApi';
import { type ApiCompanyRecord, isLikelyCompanyCuid } from '@/lib/companyApi';
import { usePaginatedContactPicker, type PaginatedContactPickerOptions } from '@/hooks/usePaginatedContactPicker';
import { usePaginatedCompanyPicker, type PaginatedCompanyPickerOptions } from '@/hooks/usePaginatedCompanyPicker';

const FALLBACK_ETAPA_SLUGS = [
  'lead', 'contacto', 'reunion_agendada', 'reunion_efectiva', 'propuesta_economica',
  'negociacion', 'licitacion', 'licitacion_etapa_final', 'cierre_ganado', 'firma_contrato',
  'activo', 'cierre_perdido', 'inactivo',
] as const;

export const newOpportunityFormSchema = z.object({
  title: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  amount: z.coerce.number().min(0, 'El monto debe ser positivo'),
  etapa: z.string().min(1, 'Selecciona una etapa'),
  expectedCloseDate: z.string().min(1, 'Selecciona una fecha'),
  assignedTo: z.string().optional(),
  priority: z.enum(['baja', 'media', 'alta']),
});

export type NewOpportunityFormValues = z.infer<typeof newOpportunityFormSchema>;

export const newOpportunityFormDefaults: NewOpportunityFormValues = {
  title: '',
  contactId: '',
  companyId: '',
  amount: 0,
  etapa: 'lead',
  expectedCloseDate: '',
  assignedTo: undefined,
  priority: 'media',
};

export interface NewOpportunityFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: NewOpportunityFormValues) => void | Promise<void>;
  title?: string;
  description?: string;
  defaultContactId?: string;
  defaultCompanyId?: string;
  /** Si true, no se puede cambiar el contacto elegido */
  lockContactSelection?: boolean;
  /** Si true, no se puede cambiar la empresa elegida */
  lockCompanySelection?: boolean;
}

export function NewOpportunityFormDialog({
  open,
  onOpenChange,
  onCreate,
  title = 'Nueva Oportunidad',
  description = 'Registra una nueva oportunidad de venta en el pipeline.',
  defaultContactId = '',
  defaultCompanyId = '',
  lockContactSelection = false,
  lockCompanySelection = false,
}: NewOpportunityFormDialogProps) {
  const { contacts } = useCRMStore();
  const { activeAdvisors } = useUsers();
  const currentUser = useAppStore((s) => s.currentUser);
  const { hasPermission } = usePermissions();
  const canReassign = canUserReassignCommercialAdvisor(hasPermission, 'oportunidades');
  const bundle = useCrmConfigStore((s) => s.bundle);
  const stageOptions = useMemo(() => {
    const st = bundle?.catalog.stages
      ?.filter((x) => x.enabled)
      ?.sort((a, b) => a.sortOrder - b.sortOrder);
    if (st?.length) {
      return st.map((s) => ({ value: s.slug, label: s.name }));
    }
    return FALLBACK_ETAPA_SLUGS.map((slug) => ({
      value: slug,
      label: etapaLabels[slug] ?? slug,
    }));
  }, [bundle]);

  const newOppContactPickerOpts = useMemo(
    (): PaginatedContactPickerOptions => ({ fetchAll: true, pageSize: 25 }),
    [],
  );
  const newOppCompanyPickerOpts = useMemo(
    (): PaginatedCompanyPickerOptions => ({ fetchAll: true, pageSize: 25 }),
    [],
  );

  const [linkContactOpen, setLinkContactOpen] = useState(false);
  const [linkCompanyOpen, setLinkCompanyOpen] = useState(false);
  const [linkContactSearch, setLinkContactSearch] = useState('');
  const [linkCompanySearch, setLinkCompanySearch] = useState('');
  const [linkContactSelectedIds, setLinkContactSelectedIds] = useState<string[]>([]);
  const [linkCompanySelectedIds, setLinkCompanySelectedIds] = useState<string[]>([]);
  const [pickedContactRow, setPickedContactRow] = useState<ApiContactListRow | null>(null);
  const [pickedCompanyRow, setPickedCompanyRow] = useState<ApiCompanyRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    items: contactPickerRows,
    loading: contactPickerLoading,
    loadingMore: contactPickerLoadingMore,
    hasMore: contactPickerHasMore,
    loadMore: contactPickerLoadMore,
  } = usePaginatedContactPicker(linkContactOpen, linkContactSearch, newOppContactPickerOpts);

  const {
    items: companyPickerRows,
    loading: companyPickerLoading,
    loadingMore: companyPickerLoadingMore,
    hasMore: companyPickerHasMore,
    loadMore: companyPickerLoadMore,
  } = usePaginatedCompanyPicker(linkCompanyOpen, linkCompanySearch, newOppCompanyPickerOpts);

  const mergedContactsForForm = useMemo(() => contacts, [contacts]);

  const linkContactItems: LinkExistingItem[] = useMemo(
    () =>
      contactPickerRows.map((row) => {
        const c = mapApiContactRowToContact(row);
        return {
          id: c.id,
          title: c.name,
          subtitle: getPrimaryCompany(c)?.name,
        };
      }),
    [contactPickerRows],
  );

  const linkCompanyItems: LinkExistingItem[] = useMemo(
    () =>
      companyPickerRows.map((c) => ({
        id: c.id,
        title: c.name,
        subtitle: c.ruc ?? undefined,
      })),
    [companyPickerRows],
  );

  const form = useForm<NewOpportunityFormValues>({
    resolver: zodResolver(newOpportunityFormSchema) as import('react-hook-form').Resolver<NewOpportunityFormValues>,
    defaultValues: { ...newOpportunityFormDefaults },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      ...newOpportunityFormDefaults,
      contactId: defaultContactId || '',
      companyId: defaultCompanyId || '',
      assignedTo: canReassign ? undefined : resolveAdvisorAssigneeId(undefined, currentUser, false) || undefined,
    });
    setLinkContactSearch('');
    setLinkCompanySearch('');
    setLinkContactSelectedIds([]);
    setLinkCompanySelectedIds([]);
    setPickedContactRow(null);
    setPickedCompanyRow(null);
  }, [open, defaultContactId, defaultCompanyId, form, canReassign, currentUser.id, currentUser.role]);

  const watchContactId = form.watch('contactId');
  const watchCompanyId = form.watch('companyId');

  const contactLinkedLabel = useMemo(() => {
    if (!watchContactId?.trim()) return null;
    if (pickedContactRow?.id === watchContactId) {
      const c = mapApiContactRowToContact(pickedContactRow);
      return `${c.name} — ${getPrimaryCompany(c)?.name ?? '—'}`;
    }
    const c = mergedContactsForForm.find((x) => x.id === watchContactId);
    return c
      ? `${c.name} — ${getPrimaryCompany(c)?.name ?? '—'}`
      : `Contacto (${watchContactId.slice(0, 8)}…)`;
  }, [watchContactId, mergedContactsForForm, pickedContactRow]);

  const companyLinkedLabel = useMemo(() => {
    if (!watchCompanyId?.trim()) return null;
    if (pickedCompanyRow?.id === watchCompanyId) {
      return pickedCompanyRow.name;
    }
    return `Empresa (${watchCompanyId.slice(0, 8)}…)`;
  }, [watchCompanyId, pickedCompanyRow]);

  const fuentePreviewLabel = useMemo(() => {
    const contactId = watchContactId?.trim();
    let oppFuenteLabel = getSourceLabelFromCatalog('base', bundle, contactSourceLabels);
    if (contactId && pickedContactRow?.id === contactId && pickedContactRow.fuente) {
      oppFuenteLabel = getSourceLabelFromCatalog(pickedContactRow.fuente, bundle, contactSourceLabels);
    } else {
      const c = contactId ? mergedContactsForForm.find((x) => x.id === contactId) : undefined;
      if (c?.fuente) {
        oppFuenteLabel = getSourceLabelFromCatalog(c.fuente, bundle, contactSourceLabels);
      }
    }
    const hasCompany = !!watchCompanyId?.trim();
    if (hasCompany) {
      return `Oportunidad: ${oppFuenteLabel}. La empresa mostrará la fuente de la oportunidad principal (mayor probabilidad) cuando el CRM sincronice.`;
    }
    return `Oportunidad: ${oppFuenteLabel}.`;
  }, [
    watchCompanyId,
    watchContactId,
    pickedContactRow,
    mergedContactsForForm,
    bundle,
  ]);

  function resetLinkState() {
    setLinkContactSearch('');
    setLinkCompanySearch('');
    setLinkContactSelectedIds([]);
    setLinkCompanySelectedIds([]);
    setPickedContactRow(null);
    setPickedCompanyRow(null);
  }

  function handleDialogOpenChange(next: boolean) {
    if (!next) {
      form.reset({ ...newOpportunityFormDefaults });
      resetLinkState();
    }
    onOpenChange(next);
  }

  async function handleSubmit(data: NewOpportunityFormValues) {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onCreate(data);
      handleDialogOpenChange(false);
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <>
      <LinkExistingDialog
        open={linkContactOpen}
        onOpenChange={setLinkContactOpen}
        title="Contacto existente"
        searchPlaceholder="Buscar por nombre o empresa…"
        items={linkContactItems}
        selectedIds={linkContactSelectedIds}
        onSelectionChange={setLinkContactSelectedIds}
        searchValue={linkContactSearch}
        onSearchChange={setLinkContactSearch}
        selectionMode="single"
        confirmLabel="Usar contacto"
        overlayClassName={formDialogNestedOverlayClass}
        contentClassName={formDialogNestedContentClass}
        serverFilteredList
        listLoading={contactPickerLoading}
        listLoadingMore={contactPickerLoadingMore}
        hasMore={contactPickerHasMore}
        onLoadMore={contactPickerLoadMore}
        onConfirm={() => {
          const id = linkContactSelectedIds[0];
          if (!id) return;
          const row = contactPickerRows.find((r) => r.id === id);
          if (row) setPickedContactRow(row);
          form.setValue('contactId', id);
          form.clearErrors('contactId');
          setLinkContactOpen(false);
          setLinkContactSearch('');
          setLinkContactSelectedIds([]);
        }}
      />
      <LinkExistingDialog
        open={linkCompanyOpen}
        onOpenChange={setLinkCompanyOpen}
        title="Empresa existente"
        searchPlaceholder="Buscar empresa…"
        items={linkCompanyItems}
        selectedIds={linkCompanySelectedIds}
        onSelectionChange={setLinkCompanySelectedIds}
        searchValue={linkCompanySearch}
        onSearchChange={setLinkCompanySearch}
        selectionMode="single"
        confirmLabel="Usar empresa"
        overlayClassName={formDialogNestedOverlayClass}
        contentClassName={formDialogNestedContentClass}
        serverFilteredList
        listLoading={companyPickerLoading}
        listLoadingMore={companyPickerLoadingMore}
        hasMore={companyPickerHasMore}
        onLoadMore={companyPickerLoadMore}
        onConfirm={() => {
          const id = linkCompanySelectedIds[0];
          if (!id) return;
          const row = companyPickerRows.find((r) => r.id === id);
          if (row) setPickedCompanyRow(row);
          form.setValue('companyId', id);
          form.clearErrors('companyId');
          setLinkCompanyOpen(false);
          setLinkCompanySearch('');
          setLinkCompanySelectedIds([]);
        }}
      />

      <FormDialogShell
        open={open}
        onOpenChange={handleDialogOpenChange}
        title={title}
        description={description}
        footer={(
          <FormDialogActions
            submitLabel={submitting ? 'Guardando…' : 'Crear Oportunidad'}
            submitting={submitting}
            onCancel={() => handleDialogOpenChange(false)}
            onSubmit={() => void form.handleSubmit((d) => void handleSubmit(d))()}
          />
        )}
      >
        <form
          onSubmit={form.handleSubmit((d) => void handleSubmit(d))}
          className="space-y-6"
        >
          <FormDialogGrid>
            <FormDialogField label="Nombre" required>
              <Input id="opp-form-title" className={formDialogInputClass} {...form.register('title')} placeholder="Ej: Servicio Corporativo Empresa X" />
              <FormDialogFieldError>{form.formState.errors.title?.message}</FormDialogFieldError>
            </FormDialogField>

            <FormDialogField label="Monto (S/)" required>
              <Input id="opp-form-amount" className={formDialogInputClass} type="number" {...form.register('amount', { valueAsNumber: true })} placeholder="0" />
              <FormDialogFieldError>{form.formState.errors.amount?.message}</FormDialogFieldError>
            </FormDialogField>

            <FormDialogField label="Contacto" compactControl={false}>
              <div className="relative">
                <Button
                  type="button"
                  variant="outline"
                  disabled={lockContactSelection}
                  className={cn(formDialogLinkPickerClass, !contactLinkedLabel && 'text-muted-foreground', lockContactSelection && 'pr-3')}
                  onClick={() => {
                    if (lockContactSelection) return;
                    setLinkContactSearch('');
                    setLinkContactSelectedIds(watchContactId ? [watchContactId] : []);
                    setLinkContactOpen(true);
                  }}
                >
                  <User className="size-4 shrink-0 opacity-60" />
                  <span className="min-w-0 flex-1 truncate text-left">
                    {contactLinkedLabel ?? 'Seleccionar contacto…'}
                  </span>
                  <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                </Button>
                {watchContactId && !lockContactSelection ? (
                  <button
                    type="button"
                    className="absolute top-1/2 right-9 z-[1] -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      form.setValue('contactId', '');
                      setPickedContactRow(null);
                    }}
                    aria-label="Quitar contacto"
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>
            </FormDialogField>

            <FormDialogField label="Empresa" compactControl={false}>
              <div className="relative">
                <Button
                  type="button"
                  variant="outline"
                  disabled={lockCompanySelection}
                  className={cn(formDialogLinkPickerClass, !companyLinkedLabel && 'text-muted-foreground', lockCompanySelection && 'pr-3')}
                  onClick={() => {
                    if (lockCompanySelection) return;
                    setLinkCompanySearch('');
                    setLinkCompanySelectedIds(watchCompanyId ? [watchCompanyId] : []);
                    setLinkCompanyOpen(true);
                  }}
                >
                  <Building2 className="size-4 shrink-0 opacity-60" />
                  <span className="min-w-0 flex-1 truncate text-left">
                    {companyLinkedLabel ?? 'Seleccionar empresa…'}
                  </span>
                  <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                </Button>
                {watchCompanyId && !lockCompanySelection ? (
                  <button
                    type="button"
                    className="absolute top-1/2 right-9 z-[1] -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      form.setValue('companyId', '');
                      setPickedCompanyRow(null);
                    }}
                    aria-label="Quitar empresa"
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>
            </FormDialogField>

            <FormDialogField label="Fuente" className="sm:col-span-2" compactControl={false}>
              <p className="rounded-lg border border-dashed border-slate-300/80 bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
                {fuentePreviewLabel}
              </p>
            </FormDialogField>

            <FormDialogField label="Prioridad" required>
              <Select value={form.watch('priority')} onValueChange={(v) => form.setValue('priority', v as ContactPriority)}>
                <SelectTrigger className={formDialogSelectTriggerClass}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baja">Baja</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </FormDialogField>

            <FormDialogField label="Fecha estimada de cierre" required>
              <Input id="opp-form-close" className={formDialogInputClass} type="date" {...form.register('expectedCloseDate')} />
              <FormDialogFieldError>{form.formState.errors.expectedCloseDate?.message}</FormDialogFieldError>
            </FormDialogField>

            <FormDialogField label="Etapa" required hint="Define probabilidad">
              <Select value={form.watch('etapa')} onValueChange={(v) => form.setValue('etapa', v)}>
                <SelectTrigger className={formDialogSelectTriggerClass}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {stageOptions.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormDialogField>

            <AssignedAdvisorFormField
              htmlId="opp-form-assigned-to"
              value={form.watch('assignedTo') ?? ''}
              onChange={(v) => form.setValue('assignedTo', v || undefined)}
              assignModule="oportunidades"
              disabled={false}
              fallbackName={currentUser.name}
              label="Asesor (servidor)"
              formStyle
            />
          </FormDialogGrid>
        </form>
      </FormDialogShell>
    </>
  );
}

/** Cuerpo JSON estándar para POST /opportunities (ids validados como cuid) */
export function buildOpportunityCreateBody(data: NewOpportunityFormValues): Record<string, unknown> {
  const resolvedContactId = data.contactId?.trim() || undefined;
  const resolvedCompanyId = data.companyId?.trim() || undefined;
  const body: Record<string, unknown> = {
    title: data.title.trim(),
    amount: data.amount,
    etapa: data.etapa,
    status: 'abierta',
    expectedCloseDate: data.expectedCloseDate,
    priority: data.priority,
  };
  if (data.assignedTo && isLikelyContactCuid(data.assignedTo)) {
    body.assignedTo = data.assignedTo;
  }
  if (resolvedContactId && isLikelyContactCuid(resolvedContactId)) {
    body.contactId = resolvedContactId;
  }
  if (resolvedCompanyId && isLikelyCompanyCuid(resolvedCompanyId)) {
    body.companyId = resolvedCompanyId;
  }
  return body;
}
