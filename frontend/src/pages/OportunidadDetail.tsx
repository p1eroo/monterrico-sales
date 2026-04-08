import { useParams, useNavigate } from 'react-router-dom';
import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Briefcase, DollarSign, Target, CalendarDays, User, Building2,
  Users, Edit, RefreshCw, UserPlus, Plus, FileArchive, Loader2,
} from 'lucide-react';
import { useCRMStore } from '@/store/crmStore';
import { etapaLabels, companyRubroLabels, timelineEvents, activities } from '@/data/mock';
import { useUsers } from '@/hooks/useUsers';
import { getPrimaryCompany } from '@/lib/utils';
import type { CompanyRubro, Etapa, OpportunityStatus } from '@/types';
import { EmptyState } from '@/components/shared/EmptyState';
import { DetailLayout } from '@/components/shared/DetailLayout';
import { EntityInfoCard } from '@/components/shared/EntityInfoCard';
import { TimelinePanel } from '@/components/shared/TimelinePanel';
import { ActivityPanel } from '@/components/shared/ActivityPanel';
import { QuickActionsWithDialogs } from '@/components/shared/QuickActionsWithDialogs';
import { LinkedOpportunitiesCard } from '@/components/shared/LinkedOpportunitiesCard';
import { LinkedContactsCard } from '@/components/shared/LinkedContactsCard';
import { LinkedCompaniesCard } from '@/components/shared/LinkedCompaniesCard';
import {
  NewCompanyWizard,
  type NewCompanyData,
  type NewCompanyWizardSubmitMeta,
} from '@/components/shared/NewCompanyWizard';
import { newCompanyDataToPatchBody } from '@/lib/companyWizardMap';
import {
  NewOpportunityFormDialog,
  buildOpportunityCreateBody,
  type NewOpportunityFormValues,
} from '@/components/shared/NewOpportunityFormDialog';
import { LinkExistingDialog, type LinkExistingItem } from '@/components/shared/LinkExistingDialog';
import { NewContactWizard } from '@/components/shared/NewContactWizard';
import type { NewContactData } from '@/components/shared/NewContactWizard';
import { TasksTab, type TasksTabHandle } from '@/components/shared/TasksTab';
import { ChangeEtapaDialog } from '@/components/shared/ChangeEtapaDialog';
import { AssignDialog } from '@/components/shared/AssignDialog';
import { EntityFilesTab } from '@/components/files';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { api } from '@/lib/api';
import { type ApiCompanyRecord } from '@/lib/companyApi';
import { isEntityDetailApiParam } from '@/lib/detailRoutes';
import {
  type ApiOpportunityDetail,
  type ApiOpportunityListRow,
  isLikelyOpportunityCuid,
  mapApiContactToContact,
  mapApiOpportunityToOpportunity,
  opportunityListAll,
} from '@/lib/opportunityApi';
import {
  type ApiContactDetail,
  type ApiContactListRow,
  contactAddCompany,
  contactListAll,
  contactRemoveCompany,
  isLikelyContactCuid,
  mapApiContactRowToContact,
} from '@/lib/contactApi';

const statusLabels: Record<string, string> = {
  abierta: 'Abierta',
  ganada: 'Ganada',
  perdida: 'Perdida',
  suspendida: 'Suspendida',
};

const statusColors: Record<string, string> = {
  abierta: 'bg-blue-100 text-blue-700',
  ganada: 'bg-emerald-100 text-emerald-700',
  perdida: 'bg-red-100 text-red-700',
  suspendida: 'bg-amber-100 text-amber-700',
};

export default function OportunidadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const routeId = id ? decodeURIComponent(id) : '';
  const fromApi = isEntityDetailApiParam(routeId);
  const { opportunities, contacts, getOpportunitiesByContactId, addOpportunity, updateOpportunity, updateContact, addContact } = useCRMStore();

  const [apiRecord, setApiRecord] = useState<ApiOpportunityDetail | null>(null);
  const [apiLoading, setApiLoading] = useState(fromApi);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiContactsList, setApiContactsList] = useState<ApiContactListRow[]>([]);
  const [allApiOpportunities, setAllApiOpportunities] = useState<ApiOpportunityListRow[]>([]);

  useEffect(() => {
    if (!fromApi || !routeId) {
      setApiLoading(false);
      setApiRecord(null);
      setApiError(null);
      setApiContactsList([]);
      setAllApiOpportunities([]);
      return;
    }
    let cancelled = false;
    setApiLoading(true);
    setApiError(null);
    Promise.all([
      api<ApiOpportunityDetail>(`/opportunities/${routeId}`),
      contactListAll(),
      opportunityListAll(),
    ])
      .then(([oppRow, contactsList, oppsList]) => {
        if (!cancelled) {
          setApiRecord(oppRow);
          setApiContactsList(contactsList);
          setAllApiOpportunities(oppsList);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setApiRecord(null);
          setApiError(e.message);
          setApiContactsList([]);
          setAllApiOpportunities([]);
        }
      })
      .finally(() => {
        if (!cancelled) setApiLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fromApi, routeId]);

  const { users } = useUsers();
  const storeOpp = opportunities.find((o) => o.id === routeId);

  const opp = useMemo(() => {
    if (fromApi) {
      if (!apiRecord) return undefined;
      return mapApiOpportunityToOpportunity(apiRecord);
    }
    return storeOpp;
  }, [fromApi, apiRecord, storeOpp]);

  const linkedContact = useMemo(() => {
    if (!opp) return null;
    if (fromApi && apiRecord?.contacts?.[0]?.contact) {
      return mapApiContactToContact(apiRecord.contacts[0].contact);
    }
    return opp.contactId ? contacts.find((l) => l.id === opp.contactId) ?? null : null;
  }, [fromApi, apiRecord, opp, contacts]);

  const primaryCompany = useMemo(() => {
    if (!opp) return null;
    if (fromApi && apiRecord?.companies?.[0]?.company) {
      const comp = apiRecord.companies[0].company;
      return { id: comp.id, name: comp.name };
    }
    return linkedContact ? getPrimaryCompany(linkedContact) : null;
  }, [fromApi, apiRecord, opp, linkedContact]);

  const defaultCompanyIdForNewOpp = useMemo(() => {
    if (primaryCompany && 'id' in primaryCompany && primaryCompany.id) {
      return primaryCompany.id;
    }
    return '';
  }, [primaryCompany]);

  const otherOpportunities = useMemo(() => {
    if (!linkedContact || !opp) return [];
    // Excluir por id real de la oportunidad, no por routeId (puede ser urlSlug ≠ id).
    if (fromApi) {
      return allApiOpportunities
        .map(mapApiOpportunityToOpportunity)
        .filter((o) => o.contactId === linkedContact.id && o.id !== opp.id);
    }
    return getOpportunitiesByContactId(linkedContact.id).filter((o) => o.id !== opp.id);
  }, [linkedContact, opp, fromApi, allApiOpportunities, getOpportunitiesByContactId]);

  const initialOppActivities = useMemo(() => {
    if (!opp?.contactId) return [];
    return activities.filter((a) => a.contactId === opp.contactId);
  }, [opp]);
  const [oppActivities, setOppActivities] = useState(initialOppActivities);

  const tasksTabRef = useRef<TasksTabHandle>(null);
  const [newContactOpen, setNewContactOpen] = useState(false);
  const [addExistingContactOpen, setAddExistingContactOpen] = useState(false);
  const [linkContactIds, setLinkContactIds] = useState<string[]>([]);
  const [linkContactSearch, setLinkContactSearch] = useState('');

  const [newOppOpen, setNewOppOpen] = useState(false);
  const [addExistingOppOpen, setAddExistingOppOpen] = useState(false);
  const [linkOppIds, setLinkOppIds] = useState<string[]>([]);
  const [linkOppSearch, setLinkOppSearch] = useState('');

  const [newCompanyDialogOpen, setNewCompanyDialogOpen] = useState(false);

  const [addExistingCompanyOpen, setAddExistingCompanyOpen] = useState(false);
  const [linkCompanyNames, setLinkCompanyNames] = useState<string[]>([]);
  const [linkCompanySearch, setLinkCompanySearch] = useState('');

  const [notes, setNotes] = useState([
    { id: 'n1', text: 'Negociación en fase avanzada, el cliente solicita condiciones especiales de pago.', author: 'Ana Torres', date: '2026-03-02' },
    { id: 'n2', text: 'Se envió propuesta final con descuento por volumen incluido.', author: 'Carlos Mendoza', date: '2026-03-04' },
  ]);
  const [noteText, setNoteText] = useState('');

  function handleAddNote() {
    if (!noteText.trim()) return;
    setNotes((prev) => [
      { id: `n-${Date.now()}`, text: noteText.trim(), author: 'Tú', date: new Date().toISOString().slice(0, 10) },
      ...prev,
    ]);
    setNoteText('');
    toast.success('Nota agregada correctamente');
  }

  // --- Edit / Etapa / Asignar dialogs ---
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', amount: 0, expectedCloseDate: '', status: '' as OpportunityStatus | '' });

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  function handleOpenEditDialog() {
    if (!opp) return;
    setEditForm({
      title: opp.title,
      amount: opp.amount,
      expectedCloseDate: opp.expectedCloseDate,
      status: opp.status,
    });
    setEditDialogOpen(true);
  }

  function handleSaveEdit() {
    if (!opp) return;
    if (fromApi && routeId) {
      void (async () => {
        try {
          const updated = await api<ApiOpportunityDetail>(`/opportunities/${routeId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              title: editForm.title.trim(),
              amount: editForm.amount,
              expectedCloseDate: editForm.expectedCloseDate || null,
              status: editForm.status || undefined,
            }),
          });
          setApiRecord(updated);
          toast.success('Oportunidad actualizada correctamente');
          setEditDialogOpen(false);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
        }
      })();
      return;
    }
    updateOpportunity(opp.id, {
      title: editForm.title,
      amount: editForm.amount,
      expectedCloseDate: editForm.expectedCloseDate,
      status: (editForm.status || undefined) as OpportunityStatus | undefined,
    });
    toast.success('Oportunidad actualizada correctamente');
    setEditDialogOpen(false);
  }

  function handleEtapaChange(newEtapa: string) {
    if (!opp) return;
    if (fromApi && routeId) {
      void (async () => {
        try {
          const updated = await api<ApiOpportunityDetail>(`/opportunities/${routeId}`, {
            method: 'PATCH',
            body: JSON.stringify({ etapa: newEtapa }),
          });
          setApiRecord(updated);
          toast.success('Etapa actualizada correctamente');
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'No se pudo actualizar la etapa');
        }
      })();
      setStatusDialogOpen(false);
      return;
    }
    updateOpportunity(opp.id, { etapa: newEtapa as Etapa });
    toast.success('Etapa actualizada correctamente');
    setStatusDialogOpen(false);
  }

  function handleAssignChange(newAssigneeId: string) {
    if (!opp) return;
    if (fromApi && routeId) {
      if (!isLikelyOpportunityCuid(newAssigneeId)) {
        toast.error('El asesor debe ser un usuario del servidor (id válido en PostgreSQL).');
        return;
      }
      void (async () => {
        try {
          const updated = await api<ApiOpportunityDetail>(`/opportunities/${routeId}`, {
            method: 'PATCH',
            body: JSON.stringify({ assignedTo: newAssigneeId }),
          });
          setApiRecord(updated);
          toast.success('Asesor asignado correctamente');
          setAssignDialogOpen(false);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'No se pudo asignar');
        }
      })();
      return;
    }
    const user = users.find((u) => u.id === newAssigneeId);
    updateOpportunity(opp.id, { assignedTo: newAssigneeId, assignedToName: user?.name ?? 'Sin asignar' });
    toast.success('Asesor asignado correctamente');
    setAssignDialogOpen(false);
  }

  async function handleCreateNewContact(data: NewContactData) {
    if (!opp) return;
    if (fromApi && routeId) {
      try {
        const w = data.newCompanyWizardData;
        const today = new Date().toISOString().slice(0, 10);
        const baseBody: Record<string, unknown> = {
          name: data.name.trim(),
          telefono: data.phone?.trim() || '',
          correo: data.email?.trim() || '',
          fuente: data.source,
          cargo: data.cargo?.trim() || undefined,
          etapa: data.etapaCiclo,
          assignedTo: data.assignedTo?.trim() || opp.assignedTo || undefined,
          estimatedValue: data.estimatedValue ?? 0,
          docType: data.docType || undefined,
          docNumber: data.docNumber?.trim() || undefined,
          departamento: data.departamento?.trim() || undefined,
          provincia: data.provincia?.trim() || undefined,
          distrito: data.distrito?.trim() || undefined,
          direccion: data.direccion?.trim() || undefined,
          clienteRecuperado: data.clienteRecuperado || undefined,
          etapaHistory: [{ etapa: data.etapaCiclo, fecha: today }],
        };

        if (w) {
          const coPatchId = data.newCompanyWizardUpdate?.companyId;
          if (coPatchId) {
            if (!w.origenLead) {
              toast.error('Selecciona la fuente del lead en el wizard de empresa');
              return;
            }
            try {
              await api(`/companies/${coPatchId}`, {
                method: 'PATCH',
                body: JSON.stringify(newCompanyDataToPatchBody(w)),
              });
            } catch (err) {
              toast.error(
                err instanceof Error ? err.message : 'No se pudo actualizar la empresa',
              );
              return;
            }
            baseBody.companyId = coPatchId;
          } else {
            const factEmpresa = (() => {
              const f = Number(w.facturacion);
              if (Number.isFinite(f) && f > 0) return f;
              return data.estimatedValue > 0 ? data.estimatedValue : 0;
            })();
            if (factEmpresa <= 0) {
              toast.error(
                'Indica facturación estimada en el paso de oportunidad o un valor estimado del contacto mayor que 0',
              );
              return;
            }
            if (!w.origenLead) {
              toast.error('Selecciona la fuente del lead en el wizard de empresa');
              return;
            }
            baseBody.newCompany = {
              name: w.nombreComercial.trim(),
              razonSocial: w.razonSocial.trim() || undefined,
              ruc: w.ruc.trim() || undefined,
              telefono: w.telefono.trim() || undefined,
              domain: w.dominio.trim() || undefined,
              rubro: w.rubro || undefined,
              tipo: w.tipoEmpresa || undefined,
              linkedin: w.linkedin.trim() || undefined,
              correo: w.correo.trim() || undefined,
              distrito: w.distrito.trim() || undefined,
              provincia: w.provincia.trim() || undefined,
              departamento: w.departamento.trim() || undefined,
              direccion: w.direccion.trim() || undefined,
              facturacionEstimada: factEmpresa,
              fuente: w.origenLead,
              clienteRecuperado: w.clienteRecuperado,
              etapa: w.etapa,
              ...(w.propietario && isLikelyContactCuid(w.propietario)
                ? { assignedTo: w.propietario }
                : {}),
            };
          }
        } else if (data.companyId) {
          baseBody.companyId = data.companyId;
        }

        const createdContact = await api<ApiContactDetail>('/contacts', {
          method: 'POST',
          body: JSON.stringify(baseBody),
        });
        const updated = await api<ApiOpportunityDetail>(`/opportunities/${routeId}`, {
          method: 'PATCH',
          body: JSON.stringify({ contactId: createdContact.id }),
        });
        setApiRecord(updated);
        setNewContactOpen(false);
        toast.success('Contacto creado y vinculado a la oportunidad');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo crear el contacto');
      }
      return;
    }
    const newContact = addContact({
      name: data.name,
      cargo: data.cargo,
      docType: data.docType,
      docNumber: data.docNumber,
      companies: data.company ? [{ name: data.company }] : [],
      telefono: data.phone || '',
      correo: data.email || '',
      fuente: data.source,
      assignedTo: data.assignedTo || opp.assignedTo,
      estimatedValue: data.estimatedValue,
      clienteRecuperado: data.clienteRecuperado,
    });
    updateOpportunity(opp.id, { contactId: newContact.id, contactName: newContact.name });
    toast.success('Contacto creado y vinculado a la oportunidad');
    setNewContactOpen(false);
  }

  async function handleLinkContacts() {
    if (linkContactIds.length === 0 || !opp) return;
    if (fromApi && routeId) {
      try {
        const firstContactId = linkContactIds[0];
        const updated = await api<ApiOpportunityDetail>(`/opportunities/${routeId}`, {
          method: 'PATCH',
          body: JSON.stringify({ contactId: firstContactId }),
        });
        setApiRecord(updated);
        toast.success('Contacto vinculado a la oportunidad');
        setLinkContactIds([]);
        setLinkContactSearch('');
        setAddExistingContactOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo vincular');
      }
      return;
    }
    const firstContactId = linkContactIds[0];
    updateOpportunity(opp.id, { contactId: firstContactId, contactName: contacts.find((l) => l.id === firstContactId)?.name });
    toast.success('Contacto vinculado a la oportunidad');
    setLinkContactIds([]);
    setLinkContactSearch('');
    setAddExistingContactOpen(false);
  }

  async function handleRemoveContact(_contact?: { id: string }) {
    if (!opp || !linkedContact) return;
    if (fromApi && routeId) {
      try {
        const updated = await api<ApiOpportunityDetail>(`/opportunities/${routeId}`, {
          method: 'PATCH',
          body: JSON.stringify({ contactId: null }),
        });
        setApiRecord(updated);
        toast.success('Contacto desvinculado de la oportunidad');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo desvincular');
      }
      return;
    }
    updateOpportunity(opp.id, { contactId: '', contactName: '' });
    toast.success('Contacto desvinculado de la oportunidad');
  }

  async function handleAddCompany(
    data: NewCompanyData,
    meta?: NewCompanyWizardSubmitMeta,
  ) {
    if (!linkedContact) return;
    if (fromApi && routeId && isLikelyContactCuid(linkedContact.id)) {
      try {
        if (meta?.mode === 'update' && meta.existingCompanyId) {
          await api(`/companies/${meta.existingCompanyId}`, {
            method: 'PATCH',
            body: JSON.stringify(newCompanyDataToPatchBody(data)),
          });
          const isPrimary = !(apiRecord?.companies?.length);
          await contactAddCompany(linkedContact.id, meta.existingCompanyId, isPrimary);
          const updatedOpp = await api<ApiOpportunityDetail>(`/opportunities/${routeId}`);
          setApiRecord(updatedOpp);
          setNewCompanyDialogOpen(false);
          toast.success('Empresa actualizada y vinculada correctamente');
          return;
        }

        const created = await api<ApiCompanyRecord>('/companies', {
          method: 'POST',
          body: JSON.stringify({
            name: data.nombreComercial.trim(),
            razonSocial: data.razonSocial.trim() || undefined,
            ruc: data.ruc.trim() || undefined,
            telefono: data.telefono.trim() || undefined,
            domain: data.dominio.trim() || undefined,
            rubro: data.rubro || undefined,
            tipo: data.tipoEmpresa || undefined,
            linkedin: data.linkedin.trim() || undefined,
            correo: data.correo.trim() || undefined,
            distrito: data.distrito.trim() || undefined,
            provincia: data.provincia.trim() || undefined,
            departamento: data.departamento.trim() || undefined,
            direccion: data.direccion.trim() || undefined,
            facturacionEstimada: (() => {
              const f = Number(data.facturacion);
              if (Number.isFinite(f) && f > 0) return f;
              return Math.max(linkedContact.estimatedValue ?? 0, 1);
            })(),
            fuente: data.origenLead || linkedContact.fuente,
            etapa: data.etapa || linkedContact.etapa,
            clienteRecuperado: data.clienteRecuperado,
          }),
        });
        const isPrimary = !(apiRecord?.companies?.length);
        await contactAddCompany(linkedContact.id, created.id, isPrimary);
        const updatedOpp = await api<ApiOpportunityDetail>(`/opportunities/${routeId}`);
        setApiRecord(updatedOpp);
        setNewCompanyDialogOpen(false);
        toast.success('Empresa creada y vinculada correctamente');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo crear la empresa');
      }
      return;
    }
    const companies = [...(linkedContact.companies ?? []), {
      name: data.nombreComercial,
      rubro: data.rubro || undefined,
      tipo: data.tipoEmpresa || undefined,
      domain: data.dominio || undefined,
      isPrimary: false,
    }];
    updateContact(linkedContact.id, { companies });
    toast.success('Empresa agregada');
  }

  async function handleRemoveCompany(company: import('@/types').LinkedCompany) {
    if (!linkedContact) return;
    if (fromApi && linkedContact.id && company.id && isLikelyContactCuid(linkedContact.id)) {
      try {
        await contactRemoveCompany(linkedContact.id, company.id);
        const filtered = (linkedContact.companies ?? []).filter((c) => c.id !== company.id && c.name !== company.name);
        updateContact(linkedContact.id, { companies: filtered });
        toast.success('Empresa desvinculada');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo desvincular');
      }
      return;
    }
    const filtered = (linkedContact.companies ?? []).filter((c) => c.name !== company.name);
    updateContact(linkedContact.id, { companies: filtered });
    toast.success('Empresa desvinculada');
  }

  async function handleRemoveOpportunity(oppItem: import('@/types').Opportunity) {
    if (fromApi && isLikelyOpportunityCuid(oppItem.id)) {
      try {
        await api(`/opportunities/${oppItem.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ contactId: null }),
        });
        toast.success('Oportunidad desvinculada');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo desvincular');
      }
      return;
    }
    updateOpportunity(oppItem.id, { contactId: '', contactName: '' });
    toast.success('Oportunidad desvinculada');
  }

  async function handleCreateNewOpportunity(data: NewOpportunityFormValues) {
    if (!linkedContact) {
      toast.error('Vincula un contacto antes de crear otra oportunidad.');
      throw new Error('no contact');
    }
    const merged: NewOpportunityFormValues = {
      ...data,
      contactId: linkedContact.id,
      companyId: defaultCompanyIdForNewOpp || data.companyId,
    };
    if (fromApi && isLikelyContactCuid(linkedContact.id)) {
      try {
        const body = buildOpportunityCreateBody(merged);
        await api('/opportunities', { method: 'POST', body: JSON.stringify(body) });
        toast.success(`Oportunidad "${data.title.trim()}" creada correctamente`);
        setNewOppOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo crear la oportunidad');
        throw e;
      }
      return;
    }
    addOpportunity({
      title: data.title.trim(),
      contactId: linkedContact.id,
      contactName: linkedContact.name,
      clientId: merged.companyId?.trim(),
      clientName: primaryCompany?.name,
      amount: data.amount,
      etapa: data.etapa as Etapa,
      status: 'abierta',
      priority: data.priority,
      expectedCloseDate: data.expectedCloseDate,
      assignedTo: data.assignedTo ?? '',
      createdAt: new Date().toISOString().slice(0, 10),
    });
    toast.success(`Oportunidad "${data.title.trim()}" creada correctamente`);
    setNewOppOpen(false);
  }

  function handleLinkOpportunities() {
    if (linkOppIds.length === 0 || !linkedContact) return;
    if (fromApi) {
      void (async () => {
        try {
          for (const oppId of linkOppIds) {
            if (isLikelyOpportunityCuid(oppId)) {
              await api(`/opportunities/${oppId}`, {
                method: 'PATCH',
                body: JSON.stringify({ contactId: linkedContact.id }),
              });
            } else {
              updateOpportunity(oppId, { contactId: linkedContact.id, contactName: linkedContact.name });
            }
          }
          toast.success(linkOppIds.length === 1 ? 'Oportunidad vinculada' : `${linkOppIds.length} oportunidades vinculadas`);
          setLinkOppIds([]);
          setLinkOppSearch('');
          setAddExistingOppOpen(false);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'No se pudo vincular');
        }
      })();
      return;
    }
    for (const oppId of linkOppIds) {
      updateOpportunity(oppId, { contactId: linkedContact.id, contactName: linkedContact.name });
    }
    toast.success(linkOppIds.length === 1 ? 'Oportunidad vinculada' : `${linkOppIds.length} oportunidades vinculadas`);
    setLinkOppIds([]);
    setLinkOppSearch('');
    setAddExistingOppOpen(false);
  }

  function handleLinkCompanies() {
    if (linkCompanyNames.length === 0 || !linkedContact) return;
    const currentNames = new Set(linkedContact.companies?.map((c) => c.name) ?? []);
    let companies = [...(linkedContact.companies ?? [])];
    const contactsForLinkCompanies = fromApi
      ? apiContactsList.map(mapApiContactRowToContact)
      : contacts;
    for (const name of linkCompanyNames) {
      if (currentNames.has(name)) continue;
      const sourceContact = contactsForLinkCompanies.find((l) => l.companies?.some((c) => c.name === name));
      const sourceCompany = sourceContact?.companies?.find((c) => c.name === name);
      companies.push({ name, rubro: sourceCompany?.rubro, tipo: sourceCompany?.tipo, isPrimary: false });
      currentNames.add(name);
    }
    if (companies.length > (linkedContact.companies?.length ?? 0)) {
      updateContact(linkedContact.id, { companies });
      toast.success('Empresa(s) vinculada(s)');
    }
    setLinkCompanyNames([]);
    setLinkCompanySearch('');
    setAddExistingCompanyOpen(false);
  }

  const allOppsForLink = fromApi
    ? allApiOpportunities.map(mapApiOpportunityToOpportunity)
    : opportunities;
  const availableOppsToLink = allOppsForLink.filter(
    (o) => o.id !== routeId && o.contactId !== linkedContact?.id,
  );
  const opportunityLinkItems: LinkExistingItem[] = availableOppsToLink.map((o) => ({
    id: o.id,
    title: o.title,
    subtitle: `${formatCurrency(o.amount)} · ${etapaLabels[o.etapa]}`,
    status: o.status,
    icon: <DollarSign className="size-4" />,
  }));

  const availableContacts = (() => {
    if (fromApi) {
      const linkedId = apiRecord?.contacts?.[0]?.contact?.id;
      return apiContactsList
        .filter((c) => c.id !== linkedId)
        .map((r) => mapApiContactRowToContact(r));
    }
    return linkedContact ? contacts.filter((l) => l.id !== linkedContact.id) : contacts;
  })();
  const contactLinkItems: LinkExistingItem[] = availableContacts.map((c) => ({
    id: c.id,
    title: c.name,
    subtitle: [c.cargo, getPrimaryCompany(c)?.name].filter(Boolean).join(' · ') || c.telefono,
    status: 'Activo',
    icon: <Users className="size-4" />,
  }));

  const currentCompanyNames = new Set((linkedContact?.companies ?? []).map((c) => c.name.trim().toLowerCase()));
  const availableCompanies = (() => {
    const contactsForCompanies = fromApi
      ? apiContactsList.map(mapApiContactRowToContact)
      : contacts;
    const seen = new Set<string>();
    const result: { name: string; rubro?: CompanyRubro }[] = [];
    for (const l of contactsForCompanies) {
      for (const c of l.companies ?? []) {
        const key = c.name.trim().toLowerCase();
        if (!currentCompanyNames.has(key) && !seen.has(key)) {
          seen.add(key);
          result.push({ name: c.name, rubro: c.rubro });
        }
      }
    }
    return result;
  })();
  const companyLinkItems: LinkExistingItem[] = availableCompanies.map((c) => ({
    id: c.name,
    title: c.name,
    subtitle: c.rubro ? companyRubroLabels[c.rubro] : undefined,
    status: 'Activo',
    icon: <Building2 className="size-4" />,
  }));

  if (fromApi && apiLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
        <span>Cargando oportunidad…</span>
      </div>
    );
  }

  if (fromApi && (apiError || !apiRecord)) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon={Briefcase}
          title="Oportunidad no encontrada"
          description={apiError ?? 'La oportunidad que buscas no existe en el servidor.'}
          actionLabel="Volver a Oportunidades"
          onAction={() => navigate('/opportunities')}
        />
      </div>
    );
  }

  if (!opp) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon={Briefcase}
          title="Oportunidad no encontrada"
          description="La oportunidad que buscas no existe."
          actionLabel="Volver a Oportunidades"
          onAction={() => navigate('/opportunities')}
        />
      </div>
    );
  }

  return (
    <>
    <DetailLayout
      backPath="/opportunities"
      title={opp.title}
      headerActions={
        <>
          <Badge variant="outline" className={`${statusColors[opp.status] ?? ''} border-0`}>
            {statusLabels[opp.status] ?? opp.status}
          </Badge>
          <Button variant="outline" size="sm" onClick={handleOpenEditDialog}>
            <Edit /> Editar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setStatusDialogOpen(true)}>
            <RefreshCw /> Cambiar Etapa
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAssignDialogOpen(true)}>
            <UserPlus /> Asignar
          </Button>
        </>
      }
      quickActions={
        <QuickActionsWithDialogs
          entityName={opp.title}
          contacts={linkedContact ? [linkedContact] : []}
          companies={linkedContact?.companies ?? []}
          opportunities={[opp]}
          contactId={opp?.contactId}
          onTaskCreated={(task) => tasksTabRef.current?.addTask(task as any)}
          onActivityCreated={(activity) => setOppActivities((prev) => [activity, ...prev])}
        />
      }
      summaryCards={
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="py-0">
            <CardContent className="px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                  <DollarSign className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Monto</p>
                  <p className="text-l font-semibold text-emerald-600">{formatCurrency(opp.amount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="py-0">
            <CardContent className="px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <Target className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Probabilidad</p>
                  <p className="text-l font-semibold">{opp.probability}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="py-0">
            <CardContent className="px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                  <CalendarDays className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Fecha de cierre</p>
                  <p className="text-l font-semibold">{formatDate(opp.expectedCloseDate)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="py-0">
            <CardContent className="px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                  <RefreshCw className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Etapa</p>
                  <p className="text-l font-semibold">{etapaLabels[opp.etapa]}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      }
      sidebar={
        <>
          <EntityInfoCard
            title="Información de la Oportunidad"
            fields={[
              { icon: DollarSign, value: formatCurrency(opp.amount) },
              { icon: Target, value: `${opp.probability}% probabilidad` },
              { icon: CalendarDays, value: `Cierre: ${formatDate(opp.expectedCloseDate)}` },
              { icon: User, value: opp.assignedToName },
              { icon: CalendarDays, value: `Creada: ${formatDate(opp.createdAt)}` },
            ]}
          />

          <LinkedOpportunitiesCard
            opportunities={otherOpportunities}
            onCreate={() => setNewOppOpen(true)}
            onAddExisting={() => setAddExistingOppOpen(true)}
            onRemove={handleRemoveOpportunity}
          />

          <LinkedCompaniesCard
            companies={primaryCompany ? [primaryCompany] : (linkedContact?.companies ?? [])}
            onCreate={() => setNewCompanyDialogOpen(true)}
            onAddExisting={() => setAddExistingCompanyOpen(true)}
            onRemove={linkedContact ? handleRemoveCompany : undefined}
            etapa={primaryCompany ? opp?.etapa : linkedContact?.etapa}
          />

          <LinkedContactsCard
            contacts={linkedContact ? [linkedContact] : []}
            title="Contacto vinculado"
            onCreate={() => setNewContactOpen(true)}
            onAddExisting={() => setAddExistingContactOpen(true)}
            onRemove={linkedContact ? handleRemoveContact : undefined}
          />
        </>
      }
    >
      <Tabs defaultValue="historial">
        <TabsList variant="line" className="w-full justify-start flex-wrap">
          <TabsTrigger value="historial">Historial</TabsTrigger>
          <TabsTrigger value="actividades">Actividades</TabsTrigger>
          <TabsTrigger value="tareas">Tareas</TabsTrigger>
          <TabsTrigger value="notas">Notas</TabsTrigger>
          <TabsTrigger value="archivos" className="gap-1.5">
            <FileArchive className="size-3.5" />
            Archivos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="historial" className="mt-4">
          <TimelinePanel events={timelineEvents} />
        </TabsContent>

        <TabsContent value="actividades" className="mt-4">
          <ActivityPanel activities={oppActivities} />
        </TabsContent>

        <TabsContent value="archivos" className="mt-4">
          <EntityFilesTab
            entityType="opportunity"
            entityId={opp.id}
            entityName={opp.title}
          />
        </TabsContent>

        <TabsContent value="notas" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Notas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Textarea
                  placeholder="Escribe una nota..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={3}
                />
                <Button size="sm" onClick={handleAddNote} disabled={!noteText.trim()}>
                  <Plus className="size-4" /> Agregar nota
                </Button>
              </div>
              <div className="space-y-3">
                {notes.map((note) => (
                  <div key={note.id} className="rounded-lg border p-4">
                    <p className="text-sm">{note.text}</p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium">{note.author}</span>
                      <span>·</span>
                      <span>{formatDate(note.date)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tareas" className="mt-4">
          <TasksTab
            ref={tasksTabRef}
            contacts={linkedContact ? [linkedContact] : []}
            companies={primaryCompany ? [{ name: primaryCompany.name }] : []}
            opportunities={opp ? [opp] : []}
            defaultAssigneeId={opp?.assignedTo}
            onActivityCreated={(activity) => setOppActivities((prev) => [activity as any, ...prev])}
            contactId={opp?.contactId}
            opportunityId={opp?.id}
          />
        </TabsContent>
      </Tabs>
    </DetailLayout>

    {/* Crear nuevo contacto */}
    <NewContactWizard
      open={newContactOpen}
      onOpenChange={setNewContactOpen}
      onSubmit={handleCreateNewContact}
      title="Crear nuevo contacto"
      description={`Crea un nuevo contacto vinculado a la oportunidad "${opp.title}".`}
      submitLabel="Crear y vincular"
    />

    <NewOpportunityFormDialog
      open={newOppOpen}
      onOpenChange={setNewOppOpen}
      title="Nueva oportunidad"
      description={
        linkedContact
          ? `Registra otra oportunidad para ${linkedContact.name}.`
          : `Registra una oportunidad relacionada con "${opp?.title ?? 'esta oportunidad'}".`
      }
      defaultContactId={linkedContact?.id ?? ''}
      defaultCompanyId={defaultCompanyIdForNewOpp}
      lockContactSelection={!!linkedContact}
      lockCompanySelection={!!defaultCompanyIdForNewOpp}
      onCreate={handleCreateNewOpportunity}
    />

    {/* Vincular oportunidad existente */}
    <LinkExistingDialog
      open={addExistingOppOpen}
      onOpenChange={(open) => { setAddExistingOppOpen(open); if (!open) { setLinkOppIds([]); setLinkOppSearch(''); } }}
      title="Vincular Oportunidad Existente"
      searchPlaceholder="Buscar oportunidades..."
      contactName={linkedContact?.name ?? opp.title}
      items={opportunityLinkItems}
      selectedIds={linkOppIds}
      onSelectionChange={setLinkOppIds}
      onConfirm={handleLinkOpportunities}
      searchValue={linkOppSearch}
      onSearchChange={setLinkOppSearch}
      emptyMessage="No hay oportunidades disponibles para vincular."
    />

    {/* Vincular contacto existente */}
    <LinkExistingDialog
      open={addExistingContactOpen}
      onOpenChange={(open) => { setAddExistingContactOpen(open); if (!open) { setLinkContactIds([]); setLinkContactSearch(''); } }}
      title="Vincular Contacto Existente"
      searchPlaceholder="Buscar contactos..."
      contactName={opp.title}
      items={contactLinkItems}
      selectedIds={linkContactIds}
      onSelectionChange={setLinkContactIds}
      onConfirm={handleLinkContacts}
      searchValue={linkContactSearch}
      onSearchChange={setLinkContactSearch}
      emptyMessage="No hay contactos disponibles para vincular."
    />

    <NewCompanyWizard
      open={newCompanyDialogOpen}
      onOpenChange={setNewCompanyDialogOpen}
      onSubmit={handleAddCompany}
      title="Agregar empresa"
      description={`Vincula una nueva empresa al contacto de esta oportunidad.`}
    />

    {/* Vincular empresa existente */}
    <LinkExistingDialog
      open={addExistingCompanyOpen}
      onOpenChange={(open) => { setAddExistingCompanyOpen(open); if (!open) { setLinkCompanyNames([]); setLinkCompanySearch(''); } }}
      title="Vincular Empresa Existente"
      searchPlaceholder="Buscar empresas..."
      contactName={opp.title}
      items={companyLinkItems}
      selectedIds={linkCompanyNames}
      onSelectionChange={setLinkCompanyNames}
      onConfirm={handleLinkCompanies}
      searchValue={linkCompanySearch}
      onSearchChange={setLinkCompanySearch}
      emptyMessage="No hay empresas disponibles para vincular."
    />

    {/* Editar Oportunidad */}
    <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Oportunidad</DialogTitle>
          <DialogDescription>Modifica los datos de la oportunidad.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label>Nombre *</Label>
            <Input value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Monto (S/)</Label>
              <Input type="number" value={editForm.amount} onChange={(e) => setEditForm((f) => ({ ...f, amount: Number(e.target.value) }))} />
            </div>
            <div className="space-y-2">
              <Label>Fecha estimada de cierre</Label>
              <Input type="date" value={editForm.expectedCloseDate} onChange={(e) => setEditForm((f) => ({ ...f, expectedCloseDate: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Estado</Label>
            <Select value={editForm.status} onValueChange={(v) => setEditForm((f) => ({ ...f, status: v as OpportunityStatus }))}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                {Object.entries(statusLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleSaveEdit} disabled={!editForm.title.trim()}>Guardar cambios</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <ChangeEtapaDialog
      open={statusDialogOpen}
      onOpenChange={setStatusDialogOpen}
      entityName={opp.title}
      currentEtapa={opp.etapa}
      onEtapaChange={handleEtapaChange}
    />

    <AssignDialog
      open={assignDialogOpen}
      onOpenChange={setAssignDialogOpen}
      entityName={opp.title}
      currentAssigneeId={opp.assignedTo}
      onAssignChange={handleAssignChange}
    />
    </>
  );
}
