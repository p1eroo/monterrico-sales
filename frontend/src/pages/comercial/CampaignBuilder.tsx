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
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type { Editor, JSONContent } from '@tiptap/core';
import {
  Mail,
  Plus,
  AlertTriangle,
  Send,
  Smartphone,
  Monitor,
  Save,
  Loader2,
  ChevronLeft,
} from 'lucide-react';
import type {
  Campaign,
  CampaignRecipient,
  CampaignMessage,
  CampaignMessageTemplate,
  Etapa,
  RecipientStatus,
} from '@/types';
import { campaignTemplates } from '@/data/campaignMock';
import { contactListAll, type ApiContactListRow } from '@/lib/contactApi';
import { useAppStore } from '@/store';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  FormDialogActions,
  FormDialogShell,
} from '@/components/ui/form-dialog';
import { toast } from '@/lib/notify';
import { parseCampaignRecipientsFromXlsx } from '@/lib/campaignImport';
import {
  plainTextToHtmlForEmail,
  isCampaignBodyEmpty,
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
import { CampaignAudienceSheet } from '@/components/shared/CampaignAudienceSheet';
import { CampaignGmailPreviewDialog } from '@/components/shared/CampaignGmailPreviewDialog';

type CrmCampaignContact = CampaignRecipient & { assignedTo?: string | null };

function mapApiContactToCampaignRecipient(row: ApiContactListRow): CrmCampaignContact {
  const companies = row.companies ?? [];
  const primary =
    companies.find((c) => c.isPrimary)?.company ?? companies[0]?.company;
  return {
    id: `crm-${row.id}`,
    name: row.name,
    email: (row.correo ?? '').trim(),
    phone: row.telefono?.trim() || undefined,
    company: primary?.name,
    etapa: row.etapa as Etapa,
    contactId: row.id,
    assignedTo: row.assignedTo ?? undefined,
  };
}

const CampaignMailyEditor = lazy(() =>
  import('@/components/shared/CampaignMailyEditor').then((m) => ({
    default: m.CampaignMailyEditor,
  })),
);

function insertVariable(editor: Editor | null, id: string) {
  editor
    ?.chain()
    .focus()
    .insertContent({ type: 'variable', attrs: { id } })
    .run();
}

const FROM_LABEL = 'Taxi Monterrico <monterrico@taximonterrico.info>';

const VARIABLES = [
  { token: '{{nombre}}', label: 'Nombre' },
  { token: '{{empresa}}', label: 'Empresa' },
  { token: '{{email}}', label: 'Email' },
] as const;

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
  const navigate = useNavigate();
  const { currentUser, userTemplates, addUserTemplate } = useAppStore();
  const { hasPermission } = usePermissions();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const audienceFileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const [view, setView] = useState<'compose' | 'results'>('compose');
  const [audienceOpen, setAudienceOpen] = useState(false);
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [campaignSent, setCampaignSent] = useState<Campaign | null>(null);
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);
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
  const [crmContacts, setCrmContacts] = useState<CrmCampaignContact[]>([]);
  const [crmContactsLoading, setCrmContactsLoading] = useState(false);
  const [crmContactsError, setCrmContactsError] = useState<string | null>(null);

  const draftIdFromState = (location.state as { draftId?: string } | null)?.draftId;
  const duplicateId = searchParams.get('duplicate');

  const handleMailyChange = useCallback((html: string, json: JSONContent) => {
    setMessage((m) => ({
      ...m,
      body: html,
      editorJson: json as Record<string, unknown>,
    }));
  }, []);

  const handleMailyEditorReady = useCallback((ed: Editor | null) => {
    editorRef.current = ed;
  }, []);

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
        const body =
          c.message.channel === 'email'
            ? c.message.body
            : plainTextToHtmlForEmail(c.message.body);
        setMessage({
          ...c.message,
          channel: 'email',
          body,
          attachments:
            c.message.attachments?.map((a) => ({
              ...a,
              dataUrl: a.dataUrl ?? '',
            })) ?? [],
        });
        setEmailEditorResetKey((k) => k + 1);
        setEditingCampaignId(draftIdFromState ? c.id : null);
        setView('compose');
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

  const loadCrmContacts = useCallback(async () => {
    setCrmContactsLoading(true);
    setCrmContactsError(null);
    try {
      const rows = await contactListAll();
      setCrmContacts(rows.map(mapApiContactToCampaignRecipient));
    } catch {
      setCrmContactsError('No se pudieron cargar los contactos del CRM.');
      toast.error('No se pudieron cargar los contactos del CRM.');
    } finally {
      setCrmContactsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!audienceOpen) return;
    void loadCrmContacts();
  }, [audienceOpen, loadCrmContacts]);

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
      if (audienceFilters.asesor && c.assignedTo !== audienceFilters.asesor) return false;
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
    const already = (r: CampaignRecipient, c: CrmCampaignContact) =>
      r.id === c.id ||
      (Boolean(c.contactId) && r.contactId === c.contactId) ||
      (Boolean(c.email) && r.email.toLowerCase() === c.email.toLowerCase());
    const toAdd = crmContacts.filter(
      (c) => ids.includes(c.id) && !recipients.some((r) => already(r, c)),
    );
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
    const body = plainTextToHtmlForEmail(t.body);
    setMessage({
      channel: 'email',
      subject: t.subject,
      body,
      variables: vars,
      attachments: [],
      editorJson: t.editorJson,
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
    setView('results');
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
          resendEmailId: r.resendEmailId,
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
    void handleSendEmailCampaign();
  };

  const previewBodyRaw = useMemo(() => {
    return recipients[0]
      ? replaceVariables(message.body, recipients[0])
      : message.body.replace(/\{\{(\w+)\}\}/g, '[variable]');
  }, [message.body, recipients]);

  const previewSubject = recipients[0] && message.subject
    ? replaceVariables(message.subject, recipients[0])
    : (message.subject ?? '').replace(/\{\{(\w+)\}\}/g, '[variable]');

  const invalidEmailIds = useMemo(
    () => new Set(invalidEmails.map((r) => r.id)),
    [invalidEmails],
  );

  const canSend =
    hasPermission('campanas.crear') &&
    recipients.length > 0 &&
    Boolean((message.subject ?? '').trim()) &&
    !isCampaignBodyEmpty('email', message.body);

  const resetCompose = () => {
    setView('compose');
    setCampaignName('');
    setRecipients([]);
    setSelectedIds(new Set());
    setMessage({
      channel: 'email',
      subject: '',
      body: '<p></p>',
      variables: [],
      attachments: [],
      editorJson: undefined,
    });
    setEmailEditorResetKey((k) => k + 1);
    setCampaignSent(null);
    setEditingCampaignId(null);
  };

  const requestSend = () => {
    if (!hasPermission('campanas.crear')) {
      toast.error('No tienes permiso para enviar campañas.');
      return;
    }
    if (recipients.length === 0) {
      setAudienceOpen(true);
      toast.error('Elige destinatarios antes de enviar.');
      return;
    }
    if (!(message.subject ?? '').trim()) {
      toast.error('Indica un asunto antes de enviar.');
      return;
    }
    if (isCampaignBodyEmpty('email', message.body)) {
      toast.error('El mensaje está vacío.');
      return;
    }
    if (invalidEmails.length > 0) {
      toast.error('Hay emails inválidos en la audiencia.');
      setAudienceOpen(true);
      return;
    }
    setConfirmSendOpen(true);
  };

  if (view === 'results' && campaignSent) {
    return (
      <div className="flex min-h-0 flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Campaña enviada</h1>
            <p className="text-sm text-muted-foreground">{campaignSent.name}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/campaigns')}>
              Ver historial
            </Button>
            <Button
              className="bg-[#13944C] hover:bg-[#0f7a3d]"
              onClick={resetCompose}
            >
              Nueva campaña
            </Button>
          </div>
        </div>
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
                            : r.status === 'entregado' ||
                                r.status === 'abierto' ||
                                r.status === 'clic'
                              ? 'default'
                              : 'secondary'
                        }
                        className={
                          r.status === 'entregado' ||
                          r.status === 'abierto' ||
                          r.status === 'clic'
                            ? 'bg-[#13944C]'
                            : ''
                        }
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.sentAt ? new Date(r.sentAt).toLocaleString('es-PE') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-0 flex-col overflow-hidden rounded-xl border bg-card">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/campaigns')}
          className="text-muted-foreground"
        >
          <ChevronLeft className="size-4" />
          Campañas
        </Button>
        <Input
          value={campaignName}
          onChange={(e) => setCampaignName(e.target.value)}
          placeholder="Nombre de la campaña"
          className="h-9 max-w-xs border-0 bg-transparent text-base font-semibold shadow-none focus-visible:ring-0"
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {hasPermission('campanas.crear') && (
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
              Guardar
            </Button>
          )}
          <Button
            size="sm"
            className="bg-[#13944C] hover:bg-[#0f7a3d]"
            disabled={isSendingCampaign || isLoadingCampaign}
            onClick={requestSend}
          >
            {isSendingCampaign ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Enviar
          </Button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {isLoadingCampaign && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/70">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        )}

        <div className="min-w-0 flex-1 overflow-y-auto bg-muted/40 p-4 md:p-8">
          <div className="relative mx-auto max-w-[720px]">
            <div className="overflow-hidden rounded-2xl border bg-white text-[#111827] shadow-sm dark:border-border">
              <div className="space-y-3 border-b border-slate-200 px-6 py-4">
                <div className="grid grid-cols-[5.5rem_1fr] items-center gap-2 text-sm">
                  <span className="text-slate-500">De</span>
                  <span className="truncate font-medium">{FROM_LABEL}</span>
                </div>
                <div className="grid grid-cols-[5.5rem_1fr] items-center gap-2 text-sm">
                  <span className="text-slate-500">Para</span>
                  <button
                    type="button"
                    onClick={() => setAudienceOpen(true)}
                    className="flex min-w-0 items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-slate-50"
                  >
                    {recipients.length === 0 ? (
                      <span className="text-slate-400">Seleccionar destinatarios…</span>
                    ) : (
                      <>
                        <span className="truncate font-medium">
                          {recipients.length === 1
                            ? recipients[0].email
                            : `${recipients[0].email} y ${recipients.length - 1} más`}
                        </span>
                        <Badge className="bg-[#13944C] hover:bg-[#13944C]">
                          {recipients.length}
                        </Badge>
                      </>
                    )}
                    <Plus className="ml-auto size-3.5 shrink-0 text-slate-400" />
                  </button>
                </div>
                <div className="grid grid-cols-[5.5rem_1fr] items-center gap-2 text-sm">
                  <span className="text-slate-500">Asunto</span>
                  <Input
                    value={message.subject ?? ''}
                    onChange={(e) =>
                      setMessage((m) => ({ ...m, subject: e.target.value }))
                    }
                    placeholder="Asunto del correo"
                    className="h-8 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>

              <div className="px-4 py-3 md:px-6 md:py-5">
                <Suspense
                  fallback={
                    <div className="flex min-h-[320px] items-center justify-center text-sm text-slate-400">
                      Cargando editor…
                    </div>
                  }
                >
                  <CampaignMailyEditor
                    initialHtml={message.body.trim() ? message.body : '<p></p>'}
                    initialJson={message.editorJson}
                    resetKey={emailEditorResetKey}
                    onChange={handleMailyChange}
                    onEditorReady={handleMailyEditorReady}
                  />
                </Suspense>
                <p className="mt-2 text-xs text-slate-400">
                  Pulsa <span className="font-medium text-slate-500">/</span> para
                  bloques (botón, columnas, imagen). Escribe{' '}
                  <span className="font-mono text-slate-500">{'{{'}</span> o usa
                  las variables del panel.
                </p>
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <CampaignEmailAttachments
                    attachments={message.attachments ?? []}
                    onChange={(next) =>
                      setMessage((m) => ({ ...m, attachments: next }))
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="hidden w-80 shrink-0 flex-col overflow-y-auto border-l bg-card lg:flex">
          <div className="space-y-5 p-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Audiencia
              </p>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setAudienceOpen(true)}
              >
                <Mail className="size-4" />
                {recipients.length === 0
                  ? 'Elegir destinatarios'
                  : `${recipients.length} destinatario${recipients.length === 1 ? '' : 's'}`}
              </Button>
              {(invalidEmails.length > 0 || emptyVariables.length > 0) && (
                <div className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-200">
                  <p className="flex items-center gap-1 font-medium">
                    <AlertTriangle className="size-3.5" />
                    Revisa antes de enviar
                  </p>
                  {invalidEmails.length > 0 && (
                    <p>{invalidEmails.length} email(s) inválidos</p>
                  )}
                  {emptyVariables.length > 0 && (
                    <p>Variables vacías: {emptyVariables.join(', ')}</p>
                  )}
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Variables
              </p>
              <div className="flex flex-wrap gap-1.5">
                {VARIABLES.map((v) => (
                  <Button
                    key={v.token}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 font-mono text-xs"
                    onClick={() =>
                      insertVariable(editorRef.current, v.token.slice(2, -2))
                    }
                  >
                    {v.token}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Plantillas
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-[#13944C]"
                  disabled={isCampaignBodyEmpty('email', message.body)}
                  onClick={() => {
                    setNewTemplateName('');
                    setSaveTemplateOpen(true);
                  }}
                >
                  Guardar
                </Button>
              </div>
              <div className="flex flex-col gap-1">
                {allTemplates
                  .filter((t) => t.channel === 'email')
                  .slice(0, 8)
                  .map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => loadTemplate(t)}
                      className="rounded-lg border px-3 py-2 text-left text-sm hover:border-[#13944C]/50 hover:bg-[#13944C]/5"
                    >
                      <span className="block truncate font-medium">{t.name}</span>
                      {t.subject && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {t.subject}
                        </span>
                      )}
                    </button>
                  ))}
              </div>
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Vista previa
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isCampaignBodyEmpty('email', message.body)}
                  onClick={() => {
                    setPreviewDevice('desktop');
                    setPreviewOpen(true);
                  }}
                  className="flex flex-col items-center gap-2 rounded-xl border border-border/80 bg-background px-2 py-4 text-sm font-medium shadow-none transition-colors hover:border-[#13944C]/40 hover:bg-[#13944C]/5 disabled:pointer-events-none disabled:opacity-50"
                >
                  <span className="flex size-9 items-center justify-center rounded-full bg-muted">
                    <Monitor className="size-4 text-muted-foreground" />
                  </span>
                  Computadora
                </button>
                <button
                  type="button"
                  disabled={isCampaignBodyEmpty('email', message.body)}
                  onClick={() => {
                    setPreviewDevice('mobile');
                    setPreviewOpen(true);
                  }}
                  className="flex flex-col items-center gap-2 rounded-xl border border-border/80 bg-background px-2 py-4 text-sm font-medium shadow-none transition-colors hover:border-[#13944C]/40 hover:bg-[#13944C]/5 disabled:pointer-events-none disabled:opacity-50"
                >
                  <span className="flex size-9 items-center justify-center rounded-full bg-muted">
                    <Smartphone className="size-4 text-muted-foreground" />
                  </span>
                  Celular
                </button>
              </div>
              {isCampaignBodyEmpty('email', message.body) && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Escribe el correo para previsualizarlo.
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>

      <CampaignAudienceSheet
        open={audienceOpen}
        onOpenChange={setAudienceOpen}
        canImport={hasPermission('campanas.crear')}
        fileInputRef={audienceFileInputRef}
        onFileChange={handleAudienceFileChange}
        filters={audienceFilters}
        onFiltersChange={setAudienceFilters}
        crmContacts={filteredCrmContacts}
        crmLoading={crmContactsLoading}
        crmError={crmContactsError}
        onRetryCrm={() => void loadCrmContacts()}
        recipients={recipients}
        selectedIds={selectedIds}
        onToggleSelectAll={toggleSelectAll}
        onToggleSelect={(id, checked) => {
          setSelectedIds((prev) => {
            const next = new Set(prev);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
          });
        }}
        onAddFromCrm={addFromCrm}
        onRemoveIds={removeRecipients}
        duplicateCount={duplicateEmails.length}
        invalidIds={invalidEmailIds}
      />

      <CampaignGmailPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        device={previewDevice}
        onDeviceChange={setPreviewDevice}
        subject={previewSubject}
        html={previewBodyRaw}
        recipient={recipients[0] ?? null}
        attachments={message.attachments}
      />

      <FormDialogShell
        open={confirmSendOpen}
        onOpenChange={(open) => {
          if (!isSendingCampaign) setConfirmSendOpen(open);
        }}
        title="Confirmar envío"
        description={
          recipients.length === 1
            ? 'Se enviará un correo real a 1 destinatario. Esta acción no se puede deshacer.'
            : `Se enviarán correos reales a ${recipients.length} destinatarios. Esta acción no se puede deshacer.`
        }
        maxWidthClassName="sm:max-w-md"
        showHeaderCloseButton={!isSendingCampaign}
        suspendOutsideDismiss={isSendingCampaign}
        bodyClassName={canSend ? 'mt-0 pb-0' : 'mt-4 pb-2'}
        footer={
          <FormDialogActions
            showCancel
            submitting={isSendingCampaign}
            submitLabel={isSendingCampaign ? 'Enviando…' : 'Enviar'}
            submitDisabled={!canSend}
            onCancel={() => setConfirmSendOpen(false)}
            onSubmit={handleConfirmSend}
          />
        }
      >
        {!canSend ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Completa asunto, mensaje y destinatarios para enviar.
          </p>
        ) : null}
      </FormDialogShell>

      <Dialog open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Guardar como plantilla</DialogTitle>
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
                  subject: message.subject,
                  body: message.body,
                  channel: 'email',
                  createdAt: new Date().toISOString().slice(0, 10),
                  editorJson: message.editorJson,
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
