import { useState, useMemo, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Building2, ChevronsUpDown, User, X } from 'lucide-react';
import { etapaLabels } from '@/data/mock';
import { useUsers } from '@/hooks/useUsers';
import type { Etapa } from '@/types';
import { useCRMStore } from '@/store/crmStore';
import { getPrimaryCompany, cn } from '@/lib/utils';
import { api } from '@/lib/api';
import {
  type ApiContactListRow,
  isLikelyContactCuid,
  mapApiContactRowToContact,
} from '@/lib/contactApi';
import { type ApiCompanyRecord, isLikelyCompanyCuid, companyListAll } from '@/lib/companyApi';
import { isLikelyOpportunityCuid } from '@/lib/opportunityApi';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { LinkExistingDialog } from '@/components/shared/LinkExistingDialog';

const etapasParaOportunidad: Etapa[] = [
  'lead', 'contacto', 'reunion_agendada', 'reunion_efectiva',
  'propuesta_economica', 'negociacion', 'licitacion', 'licitacion_etapa_final',
  'cierre_ganado', 'firma_contrato', 'activo', 'cierre_perdido', 'inactivo',
];

const etapaEnum = z.enum([
  'lead', 'contacto', 'reunion_agendada', 'reunion_efectiva', 'propuesta_economica',
  'negociacion', 'licitacion', 'licitacion_etapa_final', 'cierre_ganado', 'firma_contrato',
  'activo', 'cierre_perdido', 'inactivo',
] as const);

const schema = z.object({
  title: z.string().min(2, 'El título debe tener al menos 2 caracteres'),
  amount: z.coerce.number().min(0, 'El monto debe ser positivo'),
  etapa: etapaEnum,
  expectedCloseDate: z.string().min(1, 'Selecciona una fecha'),
  assignedTo: z.string().min(1, 'Selecciona un responsable'),
  contactId: z.string().optional(),
  companyId: z.string().optional(),
});

export type NewOpportunityFromPipelineData = z.infer<typeof schema>;

const defaultValues: NewOpportunityFromPipelineData = {
  title: '',
  amount: 0,
  etapa: 'lead',
  expectedCloseDate: '',
  assignedTo: '',
  contactId: '',
  companyId: '',
};

interface NewOpportunityFromPipelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewOpportunityFromPipelineDialog({ open, onOpenChange }: NewOpportunityFromPipelineDialogProps) {
  const { contacts, addOpportunity } = useCRMStore();
  const [apiContactRows, setApiContactRows] = useState<ApiContactListRow[]>([]);
  const [apiCompanies, setApiCompanies] = useState<ApiCompanyRecord[]>([]);
  const [linkContactOpen, setLinkContactOpen] = useState(false);
  const [linkCompanyOpen, setLinkCompanyOpen] = useState(false);
  const [linkContactSearch, setLinkContactSearch] = useState('');
  const [linkCompanySearch, setLinkCompanySearch] = useState('');
  const [linkContactSelectedIds, setLinkContactSelectedIds] = useState<string[]>([]);
  const [linkCompanySelectedIds, setLinkCompanySelectedIds] = useState<string[]>([]);

  const loadApiContacts = useCallback(async () => {
    try {
      const list = await api<ApiContactListRow[]>('/contacts');
      setApiContactRows(list);
    } catch {
      setApiContactRows([]);
    }
  }, []);

  const loadApiCompanies = useCallback(async () => {
    try {
      const list = await companyListAll();
      setApiCompanies(list);
    } catch {
      setApiCompanies([]);
    }
  }, []);

  const { activeUsers } = useUsers();

  useEffect(() => {
    if (!open) return;
    void loadApiContacts();
    void loadApiCompanies();
  }, [open, loadApiContacts, loadApiCompanies]);

  const mergedContactsForForm = useMemo(() => {
    const apiIds = new Set(apiContactRows.map((r) => r.id));
    const fromApi = apiContactRows.map(mapApiContactRowToContact);
    const fromStore = contacts.filter((c) => !apiIds.has(c.id));
    return [...fromApi, ...fromStore];
  }, [apiContactRows, contacts]);

  const linkContactItems = useMemo(
    () =>
      mergedContactsForForm.map((c) => ({
        id: c.id,
        title: c.name,
        subtitle: getPrimaryCompany(c)?.name,
      })),
    [mergedContactsForForm],
  );

  const linkCompanyItems = useMemo(
    () =>
      apiCompanies.map((c) => ({
        id: c.id,
        title: c.name,
        subtitle: c.ruc ?? undefined,
      })),
    [apiCompanies],
  );

  const form = useForm<NewOpportunityFromPipelineData>({
    resolver: zodResolver(schema) as import('react-hook-form').Resolver<NewOpportunityFromPipelineData>,
    defaultValues: { ...defaultValues },
  });

  const watchContactId = form.watch('contactId');
  const watchCompanyId = form.watch('companyId');

  const contactLinkedLabel = useMemo(() => {
    if (!watchContactId?.trim()) return null;
    const c = mergedContactsForForm.find((x) => x.id === watchContactId);
    return c
      ? `${c.name} — ${getPrimaryCompany(c)?.name ?? '—'}`
      : `Contacto (${watchContactId.slice(0, 8)}…)`;
  }, [watchContactId, mergedContactsForForm]);

  const companyLinkedLabel = useMemo(() => {
    if (!watchCompanyId?.trim()) return null;
    const c = apiCompanies.find((x) => x.id === watchCompanyId);
    return c?.name ?? `Empresa (${watchCompanyId.slice(0, 8)}…)`;
  }, [watchCompanyId, apiCompanies]);

  function resetLinkState() {
    setLinkContactSearch('');
    setLinkCompanySearch('');
    setLinkContactSelectedIds([]);
    setLinkCompanySelectedIds([]);
  }

  async function handleSubmit(data: NewOpportunityFromPipelineData) {
    const resolvedContactId = data.contactId?.trim() || undefined;
    const resolvedCompanyId = data.companyId?.trim() || undefined;

    const body: Record<string, unknown> = {
      title: data.title.trim(),
      amount: data.amount,
      etapa: data.etapa,
      status: 'abierta',
      expectedCloseDate: data.expectedCloseDate,
      priority: 'media',
    };
    if (data.assignedTo && isLikelyOpportunityCuid(data.assignedTo)) {
      body.assignedTo = data.assignedTo;
    }
    if (resolvedContactId && isLikelyContactCuid(resolvedContactId)) {
      body.contactId = resolvedContactId;
    }
    if (resolvedCompanyId && isLikelyCompanyCuid(resolvedCompanyId)) {
      body.companyId = resolvedCompanyId;
    }

    try {
      await api('/opportunities', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      toast.success(`Oportunidad "${data.title.trim()}" creada exitosamente`);
    } catch (e) {
      const contact = mergedContactsForForm.find((c) => c.id === resolvedContactId);
      const company = apiCompanies.find((c) => c.id === resolvedCompanyId);
      addOpportunity({
        title: data.title.trim(),
        contactId: resolvedContactId,
        contactName: contact?.name,
        clientId: resolvedCompanyId,
        clientName: company?.name,
        amount: data.amount,
        etapa: data.etapa as Etapa,
        status: 'abierta',
        priority: 'media',
        expectedCloseDate: data.expectedCloseDate,
        assignedTo: data.assignedTo,
        createdAt: new Date().toISOString().slice(0, 10),
      });
      toast.success(`Oportunidad "${data.title.trim()}" guardada en modo local`, {
        description: e instanceof Error ? e.message : 'No se pudo crear en el servidor',
      });
    }

    form.reset({ ...defaultValues });
    resetLinkState();
    onOpenChange(false);
  }

  function handleOpenChange(value: boolean) {
    if (!value) {
      form.reset({ ...defaultValues });
      resetLinkState();
    }
    onOpenChange(value);
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
        onConfirm={() => {
          const id = linkContactSelectedIds[0];
          if (!id) return;
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
        onConfirm={() => {
          const id = linkCompanySelectedIds[0];
          if (!id) return;
          form.setValue('companyId', id);
          form.clearErrors('companyId');
          setLinkCompanyOpen(false);
          setLinkCompanySearch('');
          setLinkCompanySelectedIds([]);
        }}
      />

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Oportunidad</DialogTitle>
            <DialogDescription>
              Registra una oportunidad en el pipeline. Vincula contacto y empresa ya existentes; no se crean desde aquí.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((d) => void handleSubmit(d))} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="opp-title">Título *</Label>
                <Input
                  id="opp-title"
                  {...form.register('title')}
                  placeholder="Ej: Servicio Corporativo Empresa X"
                />
                {form.formState.errors.title && (
                  <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="opp-amount">Monto (S/) *</Label>
                <Input
                  id="opp-amount"
                  type="number"
                  {...form.register('amount', { valueAsNumber: true })}
                  placeholder="0"
                />
                {form.formState.errors.amount && (
                  <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
                )}
              </div>

              <p className="text-xs text-muted-foreground sm:col-span-2">
                Contacto (API + locales) y empresa (servidor). Pulsa cada campo para elegir de la lista.
              </p>

              <div className="space-y-2">
                <Label>Contacto</Label>
                <div className="relative">
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      'h-10 w-full justify-start gap-2 px-3 pr-14 font-normal',
                      !contactLinkedLabel && 'text-muted-foreground',
                    )}
                    onClick={() => {
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
                  {watchContactId ? (
                    <button
                      type="button"
                      className="absolute right-9 top-1/2 z-[1] -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        form.setValue('contactId', '');
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
                    className={cn(
                      'h-10 w-full justify-start gap-2 px-3 pr-14 font-normal',
                      !companyLinkedLabel && 'text-muted-foreground',
                    )}
                    onClick={() => {
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
                  {watchCompanyId ? (
                    <button
                      type="button"
                      className="absolute right-9 top-1/2 z-[1] -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        form.setValue('companyId', '');
                      }}
                      aria-label="Quitar empresa"
                    >
                      <X className="size-4" />
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="opp-expectedCloseDate">Fecha estimada de cierre *</Label>
                <Input
                  id="opp-expectedCloseDate"
                  type="date"
                  {...form.register('expectedCloseDate')}
                />
                {form.formState.errors.expectedCloseDate && (
                  <p className="text-xs text-destructive">{form.formState.errors.expectedCloseDate.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Etapa *</Label>
                <Select
                  value={form.watch('etapa')}
                  onValueChange={(v) => form.setValue('etapa', v as Etapa)}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {etapasParaOportunidad.map((e) => (
                      <SelectItem key={e} value={e}>{etapaLabels[e]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Responsable *</Label>
                <Select
                  value={form.watch('assignedTo')}
                  onValueChange={(v) => form.setValue('assignedTo', v)}
                >
                  <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar responsable" /></SelectTrigger>
                  <SelectContent>
                    {activeUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.assignedTo && (
                  <p className="text-xs text-destructive">{form.formState.errors.assignedTo.message}</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
              <Button type="submit">Crear Oportunidad</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
