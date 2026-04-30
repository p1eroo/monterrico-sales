import { useState, useMemo, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  User, Building2, ChevronsUpDown, X,
} from 'lucide-react';
import type { ContactPriority, ContactSource } from '@/types';
import { etapaLabels, contactSourceLabels } from '@/data/mock';
import { useUsers } from '@/hooks/useUsers';
import { useCRMStore } from '@/store/crmStore';
import { useCrmConfigStore } from '@/store/crmConfigStore';
import { getPrimaryCompany, cn } from '@/lib/utils';
import { LinkExistingDialog, type LinkExistingItem } from '@/components/shared/LinkExistingDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
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
    });
    setLinkContactSearch('');
    setLinkCompanySearch('');
    setLinkContactSelectedIds([]);
    setLinkCompanySelectedIds([]);
    setPickedContactRow(null);
    setPickedCompanyRow(null);
  }, [open, defaultContactId, defaultCompanyId, form]);

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
    let oppFuenteLabel = contactSourceLabels.base;
    if (contactId && pickedContactRow?.id === contactId && pickedContactRow.fuente) {
      const slug = pickedContactRow.fuente.toLowerCase() as ContactSource;
      oppFuenteLabel = contactSourceLabels[slug] ?? pickedContactRow.fuente;
    } else {
      const c = contactId ? mergedContactsForForm.find((x) => x.id === contactId) : undefined;
      if (c?.fuente) {
        oppFuenteLabel = contactSourceLabels[c.fuente] ?? c.fuente;
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
    try {
      await onCreate(data);
      handleDialogOpenChange(false);
    } catch {
      /* toast / error en el padre */
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
        contentClassName="z-[60]"
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
        contentClassName="z-[60]"
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

      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit((d) => void handleSubmit(d))}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="opp-form-title">Nombre *</Label>
                <Input id="opp-form-title" {...form.register('title')} placeholder="Ej: Servicio Corporativo Empresa X" />
                {form.formState.errors.title && (
                  <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="opp-form-amount">Monto (S/) *</Label>
                <Input
                  id="opp-form-amount"
                  type="number"
                  {...form.register('amount', { valueAsNumber: true })}
                  placeholder="0"
                />
                {form.formState.errors.amount && (
                  <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Contacto</Label>
                <div className="relative">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={lockContactSelection}
                    className={cn(
                      'h-10 w-full justify-start gap-2 px-3 pr-14 font-normal',
                      !contactLinkedLabel && 'text-muted-foreground',
                    )}
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
                    <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 size-4 shrink-0 -translate-y-1/2 opacity-50" />
                  </Button>
                  {watchContactId && !lockContactSelection ? (
                    <button
                      type="button"
                      className="absolute right-9 top-1/2 z-[1] -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
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
              </div>

              <div className="space-y-2">
                <Label>Empresa</Label>
                <div className="relative">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={lockCompanySelection}
                    className={cn(
                      'h-10 w-full justify-start gap-2 px-3 pr-14 font-normal',
                      !companyLinkedLabel && 'text-muted-foreground',
                    )}
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
                    <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 size-4 shrink-0 -translate-y-1/2 opacity-50" />
                  </Button>
                  {watchCompanyId && !lockCompanySelection ? (
                    <button
                      type="button"
                      className="absolute right-9 top-1/2 z-[1] -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
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
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Fuente</Label>
                <p className="rounded-md border border-dashed bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  {fuentePreviewLabel}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Prioridad *</Label>
                <Select
                  value={form.watch('priority')}
                  onValueChange={(v) => form.setValue('priority', v as ContactPriority)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baja">Baja</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="opp-form-close">Fecha estimada de cierre *</Label>
                <Input
                  id="opp-form-close"
                  type="date"
                  {...form.register('expectedCloseDate')}
                />
                {form.formState.errors.expectedCloseDate && (
                  <p className="text-xs text-destructive">{form.formState.errors.expectedCloseDate.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Etapa * (define probabilidad)</Label>
                <Select
                  value={form.watch('etapa')}
                  onValueChange={(v) => form.setValue('etapa', v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {stageOptions.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Asesor (servidor)</Label>
                <Select
                  value={form.watch('assignedTo') ?? 'none'}
                  onValueChange={(v) => form.setValue('assignedTo', v === 'none' ? undefined : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sin asignar en servidor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar en servidor</SelectItem>
                    {activeAdvisors.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit">Crear Oportunidad</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
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
