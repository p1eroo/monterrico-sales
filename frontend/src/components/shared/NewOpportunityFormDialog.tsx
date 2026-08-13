import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  User, Building2, Search,
} from 'lucide-react';
import type { ContactPriority } from '@/types';
import { etapaLabels, contactSourceLabels } from '@/data/mock';
import { useUsers } from '@/hooks/useUsers';
import { useAppStore } from '@/store';
import { canUserReassignCommercialAdvisor, resolveAdvisorAssigneeId } from '@/lib/advisorAssigneeDefaults';
import { usePermissions } from '@/hooks/usePermissions';
import { AssignedAdvisorFormField } from '@/components/shared/AssignedAdvisorFormField';
import {
  AssociationChip,
  AssociationPickerStatic,
  AssociationPickerTrigger,
} from '@/components/shared/AssociationPickerField';
import { useCRMStore } from '@/store/crmStore';
import { useCrmConfigStore, getSourceLabelFromCatalog } from '@/store/crmConfigStore';
import { getPrimaryCompany, cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  FormDialogActions,
  FormDialogField,
  FormDialogFieldError,
  FormDialogGrid,
  FormDialogShell,
  formDialogInputClass,
  formDialogPopoverContentClass,
  formDialogScrollListClass,
  formDialogSelectTriggerClass,
} from '@/components/ui/form-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
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
  /** Contacto principal (primero de `contactIds`); compat con create body. */
  contactId: z.string().optional(),
  /** Uno o más contactos a vincular a la oportunidad. */
  contactIds: z.array(z.string()).default([]),
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
  contactIds: [],
  companyId: '',
  amount: 0,
  etapa: 'lead',
  expectedCloseDate: '',
  assignedTo: undefined,
  priority: 'media',
};

/** Ids de contacto únicos del formulario (prioriza `contactIds`). */
export function opportunityContactIdsFromForm(data: NewOpportunityFormValues): string[] {
  const fromList = (data.contactIds ?? []).map((id) => id.trim()).filter(Boolean);
  if (fromList.length > 0) return [...new Set(fromList)];
  const one = data.contactId?.trim();
  return one ? [one] : [];
}

/**
 * Tras crear la oportunidad con el contacto principal, vincula el resto (N:N).
 * El create solo acepta un `contactId`.
 */
export async function linkOpportunityExtraContacts(
  opportunityId: string,
  contactIds: string[],
): Promise<void> {
  if (!opportunityId.trim() || contactIds.length <= 1) return;
  const primary = contactIds[0];
  const extras = contactIds.slice(1).filter((id) => id !== primary && isLikelyContactCuid(id));
  if (extras.length === 0) return;
  await Promise.all(
    extras.map((contactId) =>
      api(`/opportunities/${opportunityId}`, {
        method: 'PATCH',
        body: JSON.stringify({ contactId }),
      }),
    ),
  );
}

export interface NewOpportunityFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: NewOpportunityFormValues) => void | Promise<void>;
  title?: string;
  description?: string;
  defaultContactId?: string;
  defaultContactName?: string;
  defaultCompanyId?: string;
  /** Nombre para mostrar cuando la empresa viene bloqueada / preseleccionada. */
  defaultCompanyName?: string;
  /** Fuente de la empresa (slug) para el preview cuando no hay contacto. */
  defaultCompanyFuente?: string;
  /** Si true, el contacto precargado no se puede quitar (sí se pueden añadir más). */
  lockContactSelection?: boolean;
  /** Si true, no se puede cambiar la empresa elegida */
  lockCompanySelection?: boolean;
}

export function NewOpportunityFormDialog({
  open,
  onOpenChange,
  onCreate,
  title = 'Crear nueva oportunidad',
  description,
  defaultContactId = '',
  defaultContactName = '',
  defaultCompanyId = '',
  defaultCompanyName = '',
  defaultCompanyFuente = '',
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

  const [contactPanelOpen, setContactPanelOpen] = useState(false);
  const [companyPanelOpen, setCompanyPanelOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [companySearch, setCompanySearch] = useState('');
  const [pickedContactLabels, setPickedContactLabels] = useState<Record<string, string>>({});
  const [pickedContactRow, setPickedContactRow] = useState<ApiContactListRow | null>(null);
  const [pickedCompanyRow, setPickedCompanyRow] = useState<ApiCompanyRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    items: contactPickerRows,
    loading: contactPickerLoading,
    loadingMore: contactPickerLoadingMore,
    hasMore: contactPickerHasMore,
    loadMore: contactPickerLoadMore,
  } = usePaginatedContactPicker(contactPanelOpen, contactSearch, newOppContactPickerOpts);

  const {
    items: companyPickerRows,
    loading: companyPickerLoading,
    loadingMore: companyPickerLoadingMore,
    hasMore: companyPickerHasMore,
    loadMore: companyPickerLoadMore,
  } = usePaginatedCompanyPicker(companyPanelOpen, companySearch, newOppCompanyPickerOpts);

  const mergedContactsForForm = useMemo(() => contacts, [contacts]);

  const form = useForm<NewOpportunityFormValues>({
    resolver: zodResolver(newOpportunityFormSchema) as import('react-hook-form').Resolver<NewOpportunityFormValues>,
    defaultValues: { ...newOpportunityFormDefaults },
  });

  useEffect(() => {
    if (!open) return;
    const initialContactIds = defaultContactId ? [defaultContactId] : [];
    form.reset({
      ...newOpportunityFormDefaults,
      contactId: defaultContactId || '',
      contactIds: initialContactIds,
      companyId: defaultCompanyId || '',
      assignedTo: canReassign ? undefined : resolveAdvisorAssigneeId(undefined, currentUser, false) || undefined,
    });
    setContactPanelOpen(false);
    setCompanyPanelOpen(false);
    setContactSearch('');
    setCompanySearch('');
    if (defaultContactId && defaultContactName.trim()) {
      setPickedContactLabels({ [defaultContactId]: defaultContactName.trim() });
      setPickedContactRow({
        id: defaultContactId,
        name: defaultContactName.trim(),
      } as ApiContactListRow);
    } else {
      setPickedContactLabels({});
      setPickedContactRow(null);
    }
    if (defaultCompanyId && defaultCompanyName.trim()) {
      setPickedCompanyRow({
        id: defaultCompanyId,
        name: defaultCompanyName.trim(),
        urlSlug: defaultCompanyId,
        fuente: defaultCompanyFuente.trim() || null,
        createdAt: '',
        updatedAt: '',
      });
    } else {
      setPickedCompanyRow(null);
    }
  }, [
    open,
    defaultContactId,
    defaultContactName,
    defaultCompanyId,
    defaultCompanyName,
    defaultCompanyFuente,
    form,
    canReassign,
    currentUser.id,
    currentUser.role,
  ]);

  const watchContactIds = form.watch('contactIds') ?? [];
  const watchContactId = form.watch('contactId');
  const watchCompanyId = form.watch('companyId');

  function setSelectedContactIds(ids: string[]) {
    const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    form.setValue('contactIds', unique);
    form.setValue('contactId', unique[0] ?? '');
    form.clearErrors('contactId');
  }

  function contactLabelForId(id: string): string {
    const fromLabel = pickedContactLabels[id]?.trim();
    if (fromLabel) return fromLabel;
    const c = mergedContactsForForm.find((x) => x.id === id);
    if (c) {
      const companyPart = getPrimaryCompany(c)?.name;
      return companyPart ? `${c.name} — ${companyPart}` : c.name;
    }
    if (pickedContactRow?.id === id && pickedContactRow.name?.trim()) {
      return pickedContactRow.name.trim();
    }
    if (defaultContactId === id && defaultContactName.trim()) {
      return defaultContactName.trim();
    }
    return `Contacto (${id.slice(0, 8)}…)`;
  }

  const companyLinkedLabel = useMemo(() => {
    if (!watchCompanyId?.trim()) return null;
    if (pickedCompanyRow?.id === watchCompanyId && pickedCompanyRow.name?.trim()) {
      return pickedCompanyRow.name;
    }
    if (defaultCompanyId === watchCompanyId && defaultCompanyName.trim()) {
      return defaultCompanyName.trim();
    }
    return `Empresa (${watchCompanyId.slice(0, 8)}…)`;
  }, [watchCompanyId, pickedCompanyRow, defaultCompanyId, defaultCompanyName]);

  const fuentePreviewLabel = useMemo(() => {
    const contactId = watchContactId?.trim();
    let oppFuenteSlug = 'base';
    if (contactId && pickedContactRow?.id === contactId && pickedContactRow.fuente) {
      oppFuenteSlug = pickedContactRow.fuente;
    } else {
      const c = contactId ? mergedContactsForForm.find((x) => x.id === contactId) : undefined;
      if (c?.fuente) {
        oppFuenteSlug = c.fuente;
      } else if (pickedCompanyRow?.fuente?.trim()) {
        oppFuenteSlug = pickedCompanyRow.fuente.trim();
      } else if (defaultCompanyFuente.trim()) {
        oppFuenteSlug = defaultCompanyFuente.trim();
      }
    }
    const oppFuenteLabel = getSourceLabelFromCatalog(oppFuenteSlug, bundle, contactSourceLabels);
    return oppFuenteLabel;
  }, [
    watchContactId,
    pickedContactRow,
    pickedCompanyRow,
    mergedContactsForForm,
    defaultCompanyFuente,
    bundle,
  ]);

  function resetLinkState() {
    setContactPanelOpen(false);
    setCompanyPanelOpen(false);
    setContactSearch('');
    setCompanySearch('');
    setPickedContactLabels({});
    setPickedContactRow(null);
    setPickedCompanyRow(null);
  }

  const contactsForPicker = useMemo(() => {
    const rows = [...contactPickerRows];
    for (const id of watchContactIds) {
      if (!id || rows.some((r) => r.id === id)) continue;
      if (pickedContactRow?.id === id) {
        rows.unshift(pickedContactRow);
      } else {
        rows.unshift({ id, name: contactLabelForId(id) } as ApiContactListRow);
      }
    }
    return rows;
  }, [contactPickerRows, watchContactIds, pickedContactRow, pickedContactLabels, mergedContactsForForm, defaultContactId, defaultContactName]);

  const companiesForPicker = useMemo(() => {
    const rows = [...companyPickerRows];
    const id = watchCompanyId?.trim();
    if (id && !rows.some((r) => r.id === id)) {
      if (pickedCompanyRow?.id === id) {
        rows.unshift(pickedCompanyRow);
      } else {
        rows.unshift({
          id,
          name: companyLinkedLabel ?? 'Empresa',
          urlSlug: id,
          fuente: null,
          createdAt: '',
          updatedAt: '',
        });
      }
    }
    return rows;
  }, [companyPickerRows, watchCompanyId, pickedCompanyRow, companyLinkedLabel]);

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
      <FormDialogShell
        open={open}
        onOpenChange={handleDialogOpenChange}
        maxWidthClassName="sm:max-w-lg"
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
          className="space-y-3.5"
        >
          <FormDialogGrid>
            <FormDialogField label="Nombre" required>
              <Input id="opp-form-title" className={formDialogInputClass} {...form.register('title')} placeholder="Ej: Servicio Corporativo Empresa X" />
              <FormDialogFieldError>{form.formState.errors.title?.message}</FormDialogFieldError>
            </FormDialogField>

            <FormDialogField label="Contactos" compactControl={false}>
              <Popover
                open={contactPanelOpen}
                onOpenChange={(next) => {
                  setContactPanelOpen(next);
                  if (next) {
                    setCompanyPanelOpen(false);
                    setContactSearch('');
                  }
                }}
                modal={false}
              >
                <PopoverTrigger asChild>
                  <AssociationPickerTrigger
                    open={contactPanelOpen}
                    placeholder="Buscar contactos"
                    chips={watchContactIds.map((id) => {
                      const locked = lockContactSelection && id === defaultContactId;
                      return (
                        <AssociationChip
                          key={id}
                          kind="contacto"
                          label={contactLabelForId(id)}
                          showTypeLabel={false}
                          locked={locked}
                          onRemove={locked ? undefined : () => {
                            setSelectedContactIds(watchContactIds.filter((x) => x !== id));
                            setPickedContactLabels((prev) => {
                              const next = { ...prev };
                              delete next[id];
                              return next;
                            });
                            if (pickedContactRow?.id === id) setPickedContactRow(null);
                          }}
                        />
                      );
                    })}
                  />
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  side="bottom"
                  sideOffset={8}
                  collisionPadding={16}
                  className={formDialogPopoverContentClass}
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <div className="p-3">
                    <div className="relative mb-3">
                      <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar..."
                        value={contactSearch}
                        onChange={(e) => setContactSearch(e.target.value)}
                        className={`${formDialogInputClass} h-10 pl-9 text-sm`}
                      />
                    </div>
                    <div
                      className={cn(formDialogScrollListClass, 'space-y-0.5')}
                      onWheel={(e) => e.stopPropagation()}
                    >
                      {contactPickerLoading && contactsForPicker.length === 0 ? (
                        <p className="px-2.5 py-3 text-sm text-muted-foreground">Cargando…</p>
                      ) : null}
                      {!contactPickerLoading && contactsForPicker.length === 0 ? (
                        <p className="px-2.5 py-3 text-sm text-muted-foreground">Sin resultados</p>
                      ) : null}
                      {contactsForPicker.map((row) => {
                        const isSelected = watchContactIds.includes(row.id);
                        const lockedSelected =
                          lockContactSelection && isSelected && row.id === defaultContactId;
                        const companyPart =
                          row.companies?.find((c) => c.isPrimary)?.company?.name
                          ?? row.companies?.[0]?.company?.name;
                        const label = companyPart ? `${row.name} — ${companyPart}` : row.name;
                        return (
                          <label
                            key={row.id}
                            className={cn(
                              'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm',
                              lockedSelected
                                ? 'cursor-not-allowed opacity-70'
                                : 'cursor-pointer hover:bg-muted/60',
                              isSelected ? 'bg-muted/50' : '',
                            )}
                          >
                            <Checkbox
                              checked={isSelected}
                              disabled={lockedSelected}
                              className="size-3.5 shrink-0"
                              onCheckedChange={() => {
                                if (lockedSelected) return;
                                if (isSelected) {
                                  setSelectedContactIds(watchContactIds.filter((x) => x !== row.id));
                                  setPickedContactLabels((prev) => {
                                    const next = { ...prev };
                                    delete next[row.id];
                                    return next;
                                  });
                                  if (pickedContactRow?.id === row.id) setPickedContactRow(null);
                                } else {
                                  setSelectedContactIds([...watchContactIds, row.id]);
                                  setPickedContactLabels((prev) => ({ ...prev, [row.id]: label }));
                                  setPickedContactRow(row);
                                }
                              }}
                            />
                            <User className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 truncate text-left">{label}</span>
                          </label>
                        );
                      })}
                      {contactPickerHasMore ? (
                        <button
                          type="button"
                          className="w-full px-2.5 py-2 text-xs font-medium text-[#13944C] hover:underline disabled:opacity-50"
                          disabled={contactPickerLoadingMore}
                          onClick={() => void contactPickerLoadMore()}
                        >
                          {contactPickerLoadingMore ? 'Cargando…' : 'Cargar más'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </FormDialogField>

            <FormDialogField label="Empresa" compactControl={false}>
              {lockCompanySelection && watchCompanyId?.trim() && companyLinkedLabel ? (
                <AssociationPickerStatic
                  chips={(
                    <AssociationChip
                      kind="empresa"
                      label={companyLinkedLabel}
                      locked
                      showTypeLabel={false}
                    />
                  )}
                />
              ) : (
                <Popover
                  open={companyPanelOpen}
                  onOpenChange={(next) => {
                    setCompanyPanelOpen(next);
                    if (next) {
                      setContactPanelOpen(false);
                      setCompanySearch('');
                    }
                  }}
                  modal={false}
                >
                  <PopoverTrigger asChild>
                    <AssociationPickerTrigger
                      open={companyPanelOpen}
                      placeholder="Buscar empresa"
                      chips={watchCompanyId?.trim() && companyLinkedLabel ? (
                        <AssociationChip
                          kind="empresa"
                          label={companyLinkedLabel}
                          showTypeLabel={false}
                          onRemove={() => {
                            form.setValue('companyId', '');
                            setPickedCompanyRow(null);
                          }}
                        />
                      ) : null}
                    />
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    side="bottom"
                    sideOffset={8}
                    collisionPadding={16}
                    className={formDialogPopoverContentClass}
                    onOpenAutoFocus={(e) => e.preventDefault()}
                  >
                    <div className="p-3">
                      <div className="relative mb-3">
                        <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Buscar..."
                          value={companySearch}
                          onChange={(e) => setCompanySearch(e.target.value)}
                          className={`${formDialogInputClass} h-10 pl-9 text-sm`}
                        />
                      </div>
                      <div
                        className={cn(formDialogScrollListClass, 'space-y-0.5')}
                        onWheel={(e) => e.stopPropagation()}
                      >
                        {companyPickerLoading && companiesForPicker.length === 0 ? (
                          <p className="px-2.5 py-3 text-sm text-muted-foreground">Cargando…</p>
                        ) : null}
                        {!companyPickerLoading && companiesForPicker.length === 0 ? (
                          <p className="px-2.5 py-3 text-sm text-muted-foreground">Sin resultados</p>
                        ) : null}
                        {companiesForPicker.map((row) => {
                          const isSelected = watchCompanyId === row.id;
                          return (
                            <label
                              key={row.id}
                              className={cn(
                                'flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-muted/60',
                                isSelected ? 'bg-muted/50' : '',
                              )}
                            >
                              <Checkbox
                                checked={isSelected}
                                className="size-3.5 shrink-0"
                                onCheckedChange={() => {
                                  if (isSelected) {
                                    form.setValue('companyId', '');
                                    setPickedCompanyRow(null);
                                  } else {
                                    form.setValue('companyId', row.id);
                                    setPickedCompanyRow(row);
                                    form.clearErrors('companyId');
                                  }
                                }}
                              />
                              <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                              <span className="min-w-0 truncate text-left">{row.name}</span>
                            </label>
                          );
                        })}
                        {companyPickerHasMore ? (
                          <button
                            type="button"
                            className="w-full px-2.5 py-2 text-xs font-medium text-[#13944C] hover:underline disabled:opacity-50"
                            disabled={companyPickerLoadingMore}
                            onClick={() => void companyPickerLoadMore()}
                          >
                            {companyPickerLoadingMore ? 'Cargando…' : 'Cargar más'}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </FormDialogField>

            <FormDialogField label="Fuente" compactControl={false}>
              <p className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-sm text-foreground">
                {fuentePreviewLabel}
              </p>
            </FormDialogField>

            <FormDialogField label="Monto (S/)" required>
              <Input id="opp-form-amount" className={formDialogInputClass} type="number" {...form.register('amount', { valueAsNumber: true })} placeholder="0" />
              <FormDialogFieldError>{form.formState.errors.amount?.message}</FormDialogFieldError>
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

            <FormDialogField label="Etapa" required>
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
              label="Asesor"
              formStyle
            />
          </FormDialogGrid>
        </form>
      </FormDialogShell>
  );
}

/** Cuerpo JSON estándar para POST /opportunities (ids validados como cuid) */
export function buildOpportunityCreateBody(data: NewOpportunityFormValues): Record<string, unknown> {
  const contactIds = opportunityContactIdsFromForm(data);
  const resolvedContactId = contactIds[0];
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
