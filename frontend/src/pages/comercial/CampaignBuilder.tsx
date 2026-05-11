import {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  lazy,
  Suspense,
  type ChangeEvent,
} from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import {
  Users,
  Mail,
  FileCheck,
  BarChart3,
  Plus,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  Send,
  Smartphone,
  Monitor,
  FileSpreadsheet,
  Save,
  Loader2,
} from 'lucide-react';
import type {
  Campaign,
  CampaignRecipient,
  CampaignMessage,
  CampaignMessageTemplate,
  CampaignChannel,
  Etapa,
  RecipientStatus,
} from '@/types';
import { contacts } from '@/data/mock';
import {
  campaignTemplates,
  getRecipientsFromContacts,
} from '@/data/campaignMock';
import { useAppStore } from '@/store';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { parseCampaignRecipientsFromXlsx } from '@/lib/campaignImport';
import { IMPORT_SPREADSHEET_ACCEPT } from '@/lib/importSpreadsheet';
import {
  plainTextToHtmlForEmail,
  htmlToPlainText,
  isCampaignBodyEmpty,
  sanitizeCampaignEmailHtml,
} from '@/lib/campaignMessageHtml';
import {
  buildCreateCampaignPayload,
  buildSentCampaignPersistPayload,
  createCampaignApi,
  deleteCampaignApi,
  getCampaignApi,
  sendCampaignEmailApi,
  updateCampaignApi,
} from '@/lib/campaignApi';
import { CampaignEmailAttachments } from '@/components/shared/CampaignEmailAttachments';

const CampaignEmailEditor = lazy(() =>
  import('@/components/shared/CampaignEmailEditor').then((m) => ({
    default: m.CampaignEmailEditor,
  })),
);

const STEPS = [
  { id: 1, label: 'Audiencia', icon: Users },
  { id: 2, label: 'Mensaje', icon: Mail },
  { id: 3, label: 'Revisión', icon: FileCheck },
  { id: 4, label: 'Resultados', icon: BarChart3 },
] as const;

const CHANNEL_LABELS: Record<CampaignChannel, string> = {
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
};

const ETAPA_LABELS: Record<string, string> = {
  lead: 'Lead',
  contacto: 'Contacto',
  reunion_agendada: 'Reunión agendada',
  reunion_efectiva: 'Reunión efectiva',
  propuesta_economica: 'Propuesta económica',
  negociacion: 'Negociación',
  licitacion: 'Licitación',
  licitacion_etapa_final: 'Licitación etapa final',
  cierre_ganado: 'Cierre ganado',
  firma_contrato: 'Firma contrato',
  activo: 'Activo',
  cierre_perdido: 'Cierre perdido',
  inactivo: 'Inactivo',
};

const VAR_MAP: Record<string, keyof CampaignRecipient> = {
  nombre: 'name',
  empresa: 'company',
  email: 'email',
};

function replaceVariables(text: string, recipient: CampaignRecipient): string {
  return text
    .replace(/\{\{nombre\}\}/g, recipient.name)
    .replace(/\{\{empresa\}\}/g, recipient.company ?? '')
    .replace(/\{\{email\}\}/g, recipient.email);
}

function getVariableValue(recipient: CampaignRecipient, varName: string): string {
  const key = VAR_MAP[varName] ?? (varName as keyof CampaignRecipient);
  const val = recipient[key];
  return typeof val === 'string' ? val : '';
}

export default function CampaignBuilderPage() {
  const { currentUser, userTemplates, addUserTemplate } = useAppStore();
  const { hasPermission } = usePermissions();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const audienceFileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [campaignName, setCampaignName] = useState('');
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<CampaignMessage>({
    channel: 'email',
    subject: '',
    body: '',
    variables: [],
    attachments: [],
  });
  const [emailEditorResetKey, setEmailEditorResetKey] = useState(0);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [campaignSent, setCampaignSent] = useState<Campaign | null>(null);
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);
  const [testSendOpen, setTestSendOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [isSendingCampaign, setIsSendingCampaign] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isLoadingCampaign, setIsLoadingCampaign] = useState(false);
  const [audienceFilters, setAudienceFilters] = useState({
    etapa: '' as Etapa | '',
    empresa: '',
    asesor: '',
    search: '',
  });

  const draftIdFromState = (location.state as { draftId?: string } | null)?.draftId;
  const duplicateId = searchParams.get('duplicate');

  useEffect(() => {
    if (!draftIdFromState && !duplicateId) return;
    let cancelled = false;
    const idToLoad = draftIdFromState ?? duplicateId!;
    setIsLoadingCampaign(true);
    (async () => {
      try {
        const c = await getCampaignApi(idToLoad);
        if (cancelled) return;
        if (draftIdFromState && c.status !== 'draft') {
          toast.error('Esta campaña ya no es editable.');
          return;
        }
        setCampaignName(c.name);
        setRecipients(c.recipients);
        setMessage({
          ...c.message,
          attachments:
            c.message.attachments?.map((a) => ({
              ...a,
              dataUrl: a.dataUrl ?? '',
            })) ?? [],
        });
        setEmailEditorResetKey((k) => k + 1);
        setEditingCampaignId(draftIdFromState ? c.id : null);
        setStep(1);
        setCampaignSent(null);
      } catch (e) {
        if (!cancelled) {
          toast.error(
            e instanceof Error ? e.message : 'No se pudo cargar la campaña.',
          );
        }
      } finally {
        if (!cancelled) setIsLoadingCampaign(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draftIdFromState, duplicateId, location.key]);

  const crmContacts = useMemo(() => getRecipientsFromContacts(), []);
  const allTemplates = useMemo(
    () => [...userTemplates, ...campaignTemplates],
    [userTemplates]
  );
  const filteredCrmContacts = useMemo(() => {
    return crmContacts.filter((c) => {
      if (audienceFilters.search) {
        const q = audienceFilters.search.toLowerCase();
        if (
          !c.name.toLowerCase().includes(q) &&
          !c.email.toLowerCase().includes(q) &&
          !(c.company ?? '').toLowerCase().includes(q)
        )
          return false;
      }
      if (audienceFilters.etapa && c.etapa !== audienceFilters.etapa) return false;
      if (audienceFilters.empresa && !(c.company ?? '').toLowerCase().includes(audienceFilters.empresa.toLowerCase()))
        return false;
      if (audienceFilters.asesor) {
        const contact = contacts.find((x) => x.id === c.contactId);
        if (!contact || contact.assignedTo !== audienceFilters.asesor) return false;
      }
      return true;
    });
  }, [crmContacts, audienceFilters]);

  const duplicateEmails = useMemo(() => {
    const seen = new Map<string, string[]>();
    recipients.forEach((r) => {
      const key = r.email.toLowerCase();
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key)!.push(r.id);
    });
    return [...seen.entries()].filter(([, ids]) => ids.length > 1);
  }, [recipients]);

  const invalidEmails = useMemo(() => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return recipients.filter((r) => !re.test(r.email));
  }, [recipients]);

  const emptyVariables = useMemo(() => {
    const vars = (message.body + (message.subject ?? '')).match(/\{\{(\w+)\}\}/g) ?? [];
    const unique = [...new Set(vars.map((v) => v.replace(/\{\{|\}\}/g, '')))];
    const sample = recipients[0];
    if (!sample) return unique;
    return unique.filter((v) => !getVariableValue(sample, v));
  }, [message, recipients]);

  const campaignEntityFromForm = useCallback(
    (status: Campaign['status']): Campaign => {
      const defaultName =
        status === 'draft' ? 'Borrador sin nombre' : 'Campaña sin nombre';
      return {
        id: editingCampaignId ?? 'temp',
        name: campaignName.trim() || defaultName,
        status,
        channel: message.channel,
        message,
        recipients,
        results: [],
        sentCount: 0,
        deliveredCount: 0,
        openedCount: 0,
        clickedCount: 0,
        failedCount: 0,
        bounceCount: 0,
        createdAt: new Date().toISOString().slice(0, 10),
        createdBy: currentUser.id,
        createdByName: currentUser.name,
        relatedContactIds: recipients.map((r) => r.contactId).filter(Boolean) as string[],
      };
    },
    [campaignName, message, recipients, currentUser.id, currentUser.name, editingCampaignId],
  );

  const handleSaveDraft = async () => {
    if (!hasPermission('campanas.crear')) {
      toast.error('No tienes permiso para guardar borradores.');
      return;
    }
    setIsSavingDraft(true);
    try {
      const c = campaignEntityFromForm('draft');
      const payload = buildCreateCampaignPayload(c);
      if (editingCampaignId) {
        await updateCampaignApi(editingCampaignId, payload);
        toast.success('Borrador actualizado.');
      } else {
        const saved = await createCampaignApi(payload);
        setEditingCampaignId(saved.id);
        toast.success('Borrador guardado.');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar el borrador.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const addFromCrm = useCallback((ids: string[]) => {
    const toAdd = crmContacts.filter((c) => ids.includes(c.id) && !recipients.some((r) => r.id === c.id));
    setRecipients((prev) => [...prev, ...toAdd]);
  }, [crmContacts, recipients]);

  const removeRecipients = useCallback((ids: string[]) => {
    setRecipients((prev) => prev.filter((r) => !ids.includes(r.id)));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  const toggleSelectAll = () => {
    if (selectedIds.size === recipients.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(recipients.map((r) => r.id)));
    }
  };

  const loadTemplate = (t: CampaignMessageTemplate) => {
    const matches = t.body.match(/\{\{\w+\}\}/g) ?? [];
    const vars = [...new Set(matches.map((v) => v.slice(2, -2)))];
    const body =
      t.channel === 'email' ? plainTextToHtmlForEmail(t.body) : t.body;
    setMessage({
      channel: t.channel,
      subject: t.subject,
      body,
      variables: vars,
      attachments: t.channel === 'email' ? [] : undefined,
    });
    setEmailEditorResetKey((k) => k + 1);
  };

  const handleAudienceFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      const lower = file.name.toLowerCase();
      try {
        let result;
        if (lower.endsWith('.xlsx')) {
          const buf = await file.arrayBuffer();
          result = parseCampaignRecipientsFromXlsx(buf);
        } else {
          toast.error('Usa un archivo Excel (.xlsx).');
          return;
        }
        if (result.errors.length > 0) {
          toast.error(result.errors[0]);
          return;
        }
        if (result.recipients.length === 0) {
          toast.message('No se importaron filas', {
            description: 'Incluye columnas nombre y email con al menos una fila de datos.',
          });
          return;
        }
        let added = 0;
        let skippedDup = 0;
        setRecipients((prev) => {
          const emailSet = new Set(prev.map((p) => p.email.toLowerCase()));
          const next = [...prev];
          const batchSeen = new Set<string>();
          for (const r of result.recipients) {
            const k = r.email.toLowerCase();
            if (batchSeen.has(k)) {
              skippedDup++;
              continue;
            }
            batchSeen.add(k);
            if (emailSet.has(k)) {
              skippedDup++;
              continue;
            }
            emailSet.add(k);
            next.push(r);
            added++;
          }
          return next;
        });
        const descParts: string[] = [];
        if (result.skipped > 0) {
          descParts.push(`${result.skipped} fila(s) sin nombre o email omitidas.`);
        }
        if (skippedDup > 0) {
          descParts.push(`${skippedDup} omitido(s) (duplicado en archivo o ya en la lista).`);
        }
        toast.success(
          added > 0
            ? `Se agregaron ${added} destinatario(s) desde el archivo.`
            : 'Ninguna fila nueva (todos duplicados o ya en la lista).',
          descParts.length > 0 ? { description: descParts.join(' ') } : undefined,
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'No se pudo leer el archivo.');
      }
    },
    [],
  );

  const finalizeCampaignSend = (newCampaign: Campaign) => {
    setCampaignSent(newCampaign);
    setConfirmSendOpen(false);
    setStep(4);
  };

  const persistCampaignAfterSend = async (draft: Campaign, messageWithAttachments: CampaignMessage) => {
    const previousDraftId = editingCampaignId;
    try {
      const saved = await createCampaignApi(
        buildSentCampaignPersistPayload({
          ...draft,
          message: messageWithAttachments,
        }),
      );
      if (previousDraftId) {
        try {
          await deleteCampaignApi(previousDraftId);
        } catch {
          /* el envío ya quedó registrado */
        }
      }
      setEditingCampaignId(null);
      finalizeCampaignSend({ ...saved, message: messageWithAttachments });
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar la campaña en el historial.',
      );
      finalizeCampaignSend({
        ...draft,
        message: messageWithAttachments,
      });
    }
  };

  const handleMockSend = () => {
    const draft: Campaign = {
      id: `temp-${Date.now()}`,
      name: campaignName || 'Campaña sin nombre',
      status: 'sent',
      channel: message.channel,
      message,
      recipients,
      results: recipients.map((r) => ({
        recipientId: r.id,
        contactId: r.contactId,
        name: r.name,
        email: r.email,
        status: Math.random() > 0.1 ? 'entregado' : 'fallido',
        sentAt: new Date().toISOString(),
        deliveredAt: Math.random() > 0.2 ? new Date().toISOString() : undefined,
      })),
      sentCount: recipients.length,
      deliveredCount: Math.floor(recipients.length * 0.85),
      openedCount: Math.floor(recipients.length * 0.5),
      clickedCount: Math.floor(recipients.length * 0.15),
      failedCount: Math.floor(recipients.length * 0.1),
      bounceCount: 0,
      createdAt: new Date().toISOString().slice(0, 10),
      sentAt: new Date().toISOString(),
      createdBy: currentUser.id,
      createdByName: currentUser.name,
      relatedContactIds: recipients.map((r) => r.contactId).filter(Boolean) as string[],
    };
    void persistCampaignAfterSend(draft, message);
  };

  const handleSendEmailCampaign = async () => {
    const subject = (message.subject ?? '').trim();
    if (!subject) {
      toast.error('Indica un asunto antes de enviar.');
      return;
    }
    setIsSendingCampaign(true);
    try {
      const res = await sendCampaignEmailApi({
        campaignName: campaignName.trim() || undefined,
        subject,
        htmlBody: message.body,
        recipients: recipients.map((r) => ({
          id: r.id,
          email: r.email,
          name: r.name,
          company: r.company,
          contactId: r.contactId,
        })),
        attachments: message.attachments,
      });

      const delivered = res.results.filter((r) => r.status === 'entregado').length;
      const failed = res.results.filter((r) => r.status === 'fallido').length;

      const draft: Campaign = {
        id: `temp-${Date.now()}`,
        name: campaignName || 'Campaña sin nombre',
        status: 'sent',
        channel: 'email',
        message,
        recipients,
        results: res.results.map((r) => ({
          recipientId: r.recipientId,
          contactId: r.contactId,
          name: r.name,
          email: r.email,
          status: r.status as RecipientStatus,
          sentAt: r.sentAt,
          deliveredAt: r.status === 'entregado' ? r.sentAt : undefined,
          errorMessage: r.errorMessage,
        })),
        sentCount: recipients.length,
        deliveredCount: delivered,
        openedCount: 0,
        clickedCount: 0,
        failedCount: failed,
        bounceCount: 0,
        createdAt: new Date().toISOString().slice(0, 10),
        sentAt: new Date().toISOString(),
        createdBy: currentUser.id,
        createdByName: currentUser.name,
        relatedContactIds: recipients.map((r) => r.contactId).filter(Boolean) as string[],
      };
      await persistCampaignAfterSend(draft, message);
      if (failed > 0) {
        toast.message('Envío completado con errores', {
          description: `${delivered} correos aceptados por el servidor, ${failed} fallidos.`,
        });
      } else {
        toast.success(`Se enviaron ${delivered} correo(s).`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo enviar la campaña.');
    } finally {
      setIsSendingCampaign(false);
    }
  };

  const handleConfirmSend = () => {
    if (message.channel === 'email') {
      void handleSendEmailCampaign();
    } else {
      handleMockSend();
    }
  };

  const previewBodyRaw = useMemo(() => {
    return recipients[0]
      ? replaceVariables(message.body, recipients[0])
      : message.body.replace(/\{\{(\w+)\}\}/g, '[variable]');
  }, [message.body, recipients]);

  const previewBodyHtml =
    message.channel === 'email'
      ? sanitizeCampaignEmailHtml(previewBodyRaw)
      : '';

  const previewSubject = recipients[0] && message.subject
    ? replaceVariables(message.subject, recipients[0])
    : (message.subject ?? '').replace(/\{\{(\w+)\}\}/g, '[variable]');

  const progress = (step / 4) * 100;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b bg-card px-6 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {editingCampaignId ? 'Editar campaña' : 'Crear campaña'}
            </h1>
            <p className="text-sm text-muted-foreground">
              Paso {step} de 4: {STEPS[step - 1].label}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:gap-4">
            {hasPermission('campanas.crear') && step < 4 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSavingDraft || isLoadingCampaign}
                onClick={() => void handleSaveDraft()}
              >
                {isSavingDraft ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Guardar borrador
              </Button>
            )}
            <div className="hidden w-48 sm:block">
              <Progress value={progress} className="h-2" />
            </div>
            <div className="flex gap-1">
              {STEPS.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.id}
                    onClick={() => step >= s.id && setStep(s.id)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors',
                      step === s.id
                        ? 'bg-[#13944C] text-white'
                        : step > s.id
                          ? 'bg-[#13944C]/20 text-[#13944C] hover:bg-[#13944C]/30'
                          : 'text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <Icon className="size-4" />
                    <span className="hidden sm:inline">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="relative flex-1">
        {isLoadingCampaign && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/70">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        )}
        <div className="p-6">
          {/* STEP 1 — Audience */}
          {step === 1 && (
            <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Seleccionar audiencia</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Importa contactos o filtra desde el CRM
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Nombre de la campaña</Label>
                    <Input
                      placeholder="Ej: Campaña Q1 - Leads Minería"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Fuente</Label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => addFromCrm(filteredCrmContacts.map((c) => c.id))}
                      >
                        <Users className="size-4" />
                        CRM
                      </Button>
                      {hasPermission('campanas.crear') && (
                        <>
                          <input
                            ref={audienceFileInputRef}
                            type="file"
                            accept={IMPORT_SPREADSHEET_ACCEPT}
                            className="sr-only"
                            onChange={handleAudienceFileChange}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => audienceFileInputRef.current?.click()}
                          >
                            <FileSpreadsheet className="size-4" />
                            Excel (.xlsx)
                          </Button>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Archivo: columnas <span className="font-medium">nombre</span> y{' '}
                      <span className="font-medium">email</span> (o correo). Opcional: empresa, etapa,
                      teléfono.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Filtros CRM</Label>
                    <Input
                      placeholder="Buscar..."
                      value={audienceFilters.search}
                      onChange={(e) =>
                        setAudienceFilters((f) => ({ ...f, search: e.target.value }))
                      }
                      className="h-9"
                    />
                    <Select
                      value={audienceFilters.etapa}
                      onValueChange={(v) =>
                        setAudienceFilters((f) => ({ ...f, etapa: v as Etapa }))
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Etapa" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ETAPA_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Empresa"
                      value={audienceFilters.empresa}
                      onChange={(e) =>
                        setAudienceFilters((f) => ({ ...f, empresa: e.target.value }))
                      }
                      className="h-9"
                    />
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-sm font-medium">Contactos del CRM</p>
                    <p className="text-2xl font-bold text-[#13944C]">
                      {filteredCrmContacts.length}
                    </p>
                    <Button
                      size="sm"
                      className="mt-2 w-full bg-[#13944C] hover:bg-[#0f7a3d]"
                      onClick={() =>
                        addFromCrm(
                          filteredCrmContacts
                            .filter((c) => !recipients.some((r) => r.id === c.id))
                            .map((c) => c.id)
                        )
                      }
                    >
                      <Plus className="size-4" />
                      Agregar todos
                    </Button>
                  </div>
                  <ScrollArea className="h-48 rounded border">
                    <div className="space-y-1 p-2">
                      {filteredCrmContacts.slice(0, 20).map((c) => {
                        const isAdded = recipients.some((r) => r.id === c.id);
                        return (
                          <div
                            key={c.id}
                            className={cn(
                              'flex items-center justify-between rounded px-2 py-1.5 text-sm',
                              isAdded && 'bg-[#13944C]/10'
                            )}
                          >
                            <span className="truncate">{c.name}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2"
                              disabled={isAdded}
                              onClick={() => !isAdded && addFromCrm([c.id])}
                            >
                              {isAdded ? '✓' : '+'}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Destinatarios seleccionados</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {recipients.length} contactos · {duplicateEmails.length > 0 && `${duplicateEmails.length} duplicados`}
                      {invalidEmails.length > 0 && ` · ${invalidEmails.length} emails inválidos`}
                    </p>
                  </div>
                  {recipients.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (selectedIds.size > 0) removeRecipients([...selectedIds]);
                      }}
                    >
                      Eliminar seleccionados
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {(duplicateEmails.length > 0 || invalidEmails.length > 0) && (
                    <div className="mb-4 flex flex-wrap gap-2">
                      {duplicateEmails.length > 0 && (
                        <Badge variant="secondary" className="gap-1">
                          <AlertTriangle className="size-3" />
                          Duplicados detectados
                        </Badge>
                      )}
                      {invalidEmails.length > 0 && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="size-3" />
                          Emails inválidos
                        </Badge>
                      )}
                    </div>
                  )}
                  {recipients.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
                      <Users className="size-12 text-muted-foreground/50" />
                      <p className="mt-2 text-sm text-muted-foreground">
                        No hay destinatarios. Agrega desde el CRM o importa un archivo.
                      </p>
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => addFromCrm(filteredCrmContacts.map((c) => c.id))}
                      >
                        <Plus className="size-4" />
                        Agregar desde CRM
                      </Button>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={selectedIds.size === recipients.length}
                              onCheckedChange={toggleSelectAll}
                            />
                          </TableHead>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Empresa</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recipients.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedIds.has(r.id)}
                                onCheckedChange={(c) => {
                                  if (c) setSelectedIds((prev) => new Set([...prev, r.id]));
                                  else setSelectedIds((prev) => { const n = new Set(prev); n.delete(r.id); return n; });
                                }}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{r.name}</TableCell>
                            <TableCell>
                              <span className={invalidEmails.some((i) => i.id === r.id) ? 'text-destructive' : ''}>
                                {r.email}
                              </span>
                            </TableCell>
                            <TableCell>{r.company ?? '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* STEP 2 — Message */}
          {step === 2 && (
            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Editor de mensaje</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Variables: {'{{nombre}}'}, {'{{empresa}}'}, {'{{email}}'}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    {(['email', 'sms', 'whatsapp'] as CampaignChannel[]).map((ch) => (
                      <Button
                        key={ch}
                        variant={message.channel === ch ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          setMessage((m) => {
                            if (m.channel === 'email' && ch !== 'email') {
                              return {
                                ...m,
                                channel: ch,
                                body: htmlToPlainText(m.body),
                                attachments: undefined,
                              };
                            }
                            if (m.channel !== 'email' && ch === 'email') {
                              return {
                                ...m,
                                channel: ch,
                                body: plainTextToHtmlForEmail(m.body),
                                attachments: [],
                              };
                            }
                            return { ...m, channel: ch };
                          });
                          if (ch === 'email') {
                            setEmailEditorResetKey((k) => k + 1);
                          }
                        }}
                        style={message.channel === ch ? { backgroundColor: '#13944C' } : undefined}
                      >
                        {ch === 'email' && <Mail className="size-4" />}
                        {ch === 'sms' && <Smartphone className="size-4" />}
                        {ch === 'whatsapp' && <Smartphone className="size-4" />}
                        {CHANNEL_LABELS[ch]}
                      </Button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Label className="w-full">Plantillas</Label>
                    {allTemplates
                      .filter((t) => t.channel === message.channel)
                      .map((t) => (
                        <Button
                          key={t.id}
                          variant="outline"
                          size="sm"
                          onClick={() => loadTemplate(t)}
                          className="border-slate-200 hover:bg-slate-50"
                        >
                          {t.name}
                        </Button>
                      ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setNewTemplateName('');
                        setSaveTemplateOpen(true);
                      }}
                      disabled={isCampaignBodyEmpty(message.channel, message.body)}
                      className="border-dashed border-[#13944C] text-[#13944C] hover:bg-[#13944C]/10"
                    >
                      <Save className="size-4" />
                      Guardar como plantilla
                    </Button>
                  </div>
                  {message.channel === 'email' && (
                    <div>
                      <Label>Asunto</Label>
                      <Input
                        placeholder="Asunto del correo"
                        value={message.subject ?? ''}
                        onChange={(e) => setMessage((m) => ({ ...m, subject: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                  )}
                  <div>
                    <Label>Cuerpo del mensaje</Label>
                    {message.channel === 'email' ? (
                      <div className="mt-1 space-y-3">
                        <Suspense
                          fallback={
                            <div className="flex min-h-[320px] items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground">
                              Cargando editor…
                            </div>
                          }
                        >
                          <CampaignEmailEditor
                            initialHtml={
                              message.body.trim() ? message.body : '<p></p>'
                            }
                            resetKey={emailEditorResetKey}
                            onChange={(html) =>
                              setMessage((m) => ({ ...m, body: html }))
                            }
                          />
                        </Suspense>
                        <CampaignEmailAttachments
                          attachments={message.attachments ?? []}
                          onChange={(next) =>
                            setMessage((m) => ({ ...m, attachments: next }))
                          }
                        />
                      </div>
                    ) : (
                      <Textarea
                        placeholder="Escribe tu mensaje. Usa {{nombre}} para personalizar."
                        value={message.body}
                        onChange={(e) =>
                          setMessage((m) => ({ ...m, body: e.target.value }))
                        }
                        rows={12}
                        className="mt-1 font-mono text-sm"
                      />
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Vista previa</CardTitle>
                  <div className="flex gap-1">
                    <Button
                      variant={previewDevice === 'desktop' ? 'secondary' : 'ghost'}
                      size="icon-sm"
                      onClick={() => setPreviewDevice('desktop')}
                    >
                      <Monitor className="size-4" />
                    </Button>
                    <Button
                      variant={previewDevice === 'mobile' ? 'secondary' : 'ghost'}
                      size="icon-sm"
                      onClick={() => setPreviewDevice('mobile')}
                    >
                      <Smartphone className="size-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div
                    className={cn(
                      'rounded-lg border bg-muted/30 p-4',
                      previewDevice === 'mobile' && 'max-w-[320px]'
                    )}
                  >
                    {message.channel === 'email' && previewSubject && (
                      <p className="mb-2 text-sm font-medium">Asunto: {previewSubject}</p>
                    )}
                    {message.channel === 'email' ? (
                      previewBodyHtml.trim() ? (
                        <div
                          className="email-preview text-sm leading-relaxed [&_a]:text-[#13944C] [&_img]:max-w-full [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                          dangerouslySetInnerHTML={{ __html: previewBodyHtml }}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">Sin contenido</p>
                      )
                    ) : (
                      <div className="whitespace-pre-wrap text-sm">
                        {previewBodyRaw || 'Sin contenido'}
                      </div>
                    )}
                    {message.channel === 'email' &&
                      (message.attachments?.length ?? 0) > 0 && (
                        <div className="mt-3 rounded-md border border-dashed bg-muted/20 p-3 text-sm">
                          <p className="mb-1 font-medium text-muted-foreground">Adjuntos</p>
                          <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
                            {message.attachments!.map((a) => (
                              <li key={a.id}>{a.fileName}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* STEP 3 — Review */}
          {step === 3 && (
            <div className="mx-auto max-w-3xl space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Resumen de la campaña</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Revisa los detalles antes de enviar
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-lg border p-4">
                      <p className="text-sm text-muted-foreground">Destinatarios</p>
                      <p className="text-2xl font-bold">{recipients.length}</p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-sm text-muted-foreground">Canal</p>
                      <p className="text-lg font-semibold">{CHANNEL_LABELS[message.channel]}</p>
                    </div>
                  </div>
                  {(invalidEmails.length > 0 || emptyVariables.length > 0 || recipients.length === 0) && (
                    <div className="flex flex-col gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
                      <p className="font-medium text-amber-700 dark:text-amber-400">Advertencias</p>
                      <ul className="list-inside list-disc text-sm">
                        {recipients.length === 0 && <li>No hay destinatarios</li>}
                        {invalidEmails.length > 0 && (
                          <li>{invalidEmails.length} emails inválidos</li>
                        )}
                        {emptyVariables.length > 0 && (
                          <li>Variables sin valor: {emptyVariables.join(', ')}</li>
                        )}
                      </ul>
                    </div>
                  )}
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground mb-2">Vista previa del mensaje</p>
                    {message.channel === 'email' && message.subject && (
                      <p className="font-medium">Asunto: {previewSubject}</p>
                    )}
                    {message.channel === 'email' ? (
                      previewBodyHtml.trim() ? (
                        <div
                          className="email-preview mt-2 text-sm leading-relaxed text-muted-foreground [&_a]:text-[#13944C] [&_img]:max-w-full [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                          dangerouslySetInnerHTML={{ __html: previewBodyHtml }}
                        />
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">Sin contenido</p>
                      )
                    ) : (
                      <div className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                        {previewBodyRaw}
                      </div>
                    )}
                    {message.channel === 'email' &&
                      (message.attachments?.length ?? 0) > 0 && (
                        <div className="mt-3 rounded-md border border-dashed bg-muted/30 p-3 text-sm">
                          <p className="mb-1 font-medium text-muted-foreground">Adjuntos</p>
                          <ul className="list-inside list-disc space-y-0.5">
                            {message.attachments!.map((a) => (
                              <li key={a.id}>{a.fileName}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="bg-[#13944C] hover:bg-[#0f7a3d]"
                      onClick={() => setConfirmSendOpen(true)}
                      disabled={
                        recipients.length === 0 || !hasPermission('campanas.crear')
                      }
                      title={
                        !hasPermission('campanas.crear')
                          ? 'No tienes permiso para enviar campañas'
                          : undefined
                      }
                    >
                      <Send className="size-4" />
                      Enviar ahora
                    </Button>
                    <Button variant="outline" onClick={() => setTestSendOpen(true)}>
                      Envío de prueba
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* STEP 4 — Results */}
          {step === 4 && campaignSent && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Enviados</p>
                    <p className="text-2xl font-bold">{campaignSent.sentCount ?? 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Entregados</p>
                    <p className="text-2xl font-bold text-[#13944C]">
                      {campaignSent.deliveredCount ?? 0}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Abiertos</p>
                    <p className="text-2xl font-bold">{campaignSent.openedCount ?? 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Clics</p>
                    <p className="text-2xl font-bold">{campaignSent.clickedCount ?? 0}</p>
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Resultados por contacto</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contacto</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Enviado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(campaignSent.results ?? []).map((r) => (
                        <TableRow key={r.recipientId}>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell>{r.email}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                r.status === 'fallido' || r.status === 'rebote'
                                  ? 'destructive'
                                  : r.status === 'entregado' || r.status === 'abierto' || r.status === 'clic'
                                    ? 'default'
                                    : 'secondary'
                              }
                              className={r.status === 'entregado' || r.status === 'abierto' || r.status === 'clic' ? 'bg-[#13944C]' : ''}
                            >
                              {r.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {r.sentAt
                              ? new Date(r.sentAt).toLocaleString('es-PE')
                              : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer navigation */}
      <div className="flex items-center justify-between border-t bg-card px-6 py-4">
        <Button
          variant="outline"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
        >
          <ChevronLeft className="size-4" />
          Anterior
        </Button>
        {step < 4 ? (
          <Button
            className="bg-[#13944C] hover:bg-[#0f7a3d]"
            onClick={() => setStep((s) => s + 1)}
            disabled={
              (step === 1 && recipients.length === 0) ||
              (step === 2 && isCampaignBodyEmpty(message.channel, message.body))
            }
          >
            Siguiente
            <ChevronRight className="size-4" />
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => {
              setStep(1);
              setCampaignName('');
              setRecipients([]);
              setMessage({
                channel: 'email',
                subject: '',
                body: '<p></p>',
                variables: [],
                attachments: [],
              });
              setEmailEditorResetKey((k) => k + 1);
              setCampaignSent(null);
            }}
          >
            Nueva campaña
          </Button>
        )}
      </div>

      {/* Confirm Send Modal */}
      <Dialog
        open={confirmSendOpen}
        onOpenChange={(open) => {
          if (!isSendingCampaign) setConfirmSendOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar envío</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {message.channel === 'email'
              ? `Se enviarán correos reales a ${recipients.length} destinatario(s) usando el servidor SMTP configurado.`
              : `Se registrará el envío (simulado) a ${recipients.length} destinatarios.`}{' '}
            Esta acción no se puede deshacer.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={isSendingCampaign}
              onClick={() => setConfirmSendOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              className="bg-[#13944C] hover:bg-[#0f7a3d]"
              disabled={isSendingCampaign}
              onClick={handleConfirmSend}
            >
              <Send className="size-4" />
              {isSendingCampaign ? 'Enviando…' : 'Enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Send Modal */}
      <Dialog open={testSendOpen} onOpenChange={setTestSendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Envío de prueba</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Envía una copia a tu correo para verificar el mensaje antes del envío masivo.
          </p>
          <div>
            <Label>Email de prueba</Label>
            <Input
              type="email"
              placeholder={currentUser.username}
              defaultValue={currentUser.username}
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestSendOpen(false)}>
              Cancelar
            </Button>
            <Button className="bg-[#13944C] hover:bg-[#0f7a3d]">
              Enviar prueba
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Template Modal */}
      <Dialog open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Guardar como plantilla</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Guarda el mensaje actual como plantilla para usarlo en futuras campañas.
            </p>
          </DialogHeader>
          <div>
            <Label>Nombre de la plantilla</Label>
            <Input
              placeholder="Ej: Recordatorio cotización"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveTemplateOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-[#13944C] hover:bg-[#0f7a3d]"
              disabled={!newTemplateName.trim()}
              onClick={() => {
                const template: CampaignMessageTemplate = {
                  id: `user-${Date.now()}`,
                  name: newTemplateName.trim(),
                  subject: message.channel === 'email' ? message.subject : undefined,
                  body: message.body,
                  channel: message.channel,
                  createdAt: new Date().toISOString().slice(0, 10),
                };
                addUserTemplate(template);
                setSaveTemplateOpen(false);
                setNewTemplateName('');
              }}
            >
              <Save className="size-4" />
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
