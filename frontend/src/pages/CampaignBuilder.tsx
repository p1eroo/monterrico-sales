import { useState, useMemo, useCallback } from 'react';
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
  Calendar,
  Smartphone,
  Monitor,
  FileSpreadsheet,
  Save,
} from 'lucide-react';
import type {
  Campaign,
  CampaignRecipient,
  CampaignMessage,
  CampaignMessageTemplate,
  CampaignChannel,
  Etapa,
} from '@/types';
import { contacts } from '@/data/mock';
import {
  campaignTemplates,
  getRecipientsFromContacts,
} from '@/data/campaignMock';
import { useAppStore } from '@/store';
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
  const { currentUser, addSentCampaign, userTemplates, addUserTemplate } = useAppStore();
  const [step, setStep] = useState(1);
  const [campaignName, setCampaignName] = useState('');
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<CampaignMessage>({
    channel: 'email',
    subject: '',
    body: '',
    variables: [],
  });
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [campaignSent, setCampaignSent] = useState<Campaign | null>(null);
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);
  const [testSendOpen, setTestSendOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [audienceFilters, setAudienceFilters] = useState({
    etapa: '' as Etapa | '',
    empresa: '',
    asesor: '',
    search: '',
  });

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

  const loadTemplate = (t: (typeof campaignTemplates)[0]) => {
    const matches = t.body.match(/\{\{\w+\}\}/g) ?? [];
    const vars = [...new Set(matches.map((v) => v.slice(2, -2)))];
    setMessage({
      channel: t.channel,
      subject: t.subject,
      body: t.body,
      variables: vars,
    });
  };

  const handleMockSend = () => {
    const newCampaign: Campaign = {
      id: `camp-${Date.now()}`,
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
    addSentCampaign(newCampaign);
    setCampaignSent(newCampaign);
    setConfirmSendOpen(false);
    setStep(4);
  };

  const previewBody = recipients[0]
    ? replaceVariables(message.body, recipients[0])
    : message.body.replace(/\{\{(\w+)\}\}/g, '[variable]');
  const previewSubject = recipients[0] && message.subject
    ? replaceVariables(message.subject, recipients[0])
    : (message.subject ?? '').replace(/\{\{(\w+)\}\}/g, '[variable]');

  const progress = (step / 4) * 100;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b bg-card px-6 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Crear campaña</h1>
            <p className="text-sm text-muted-foreground">
              Paso {step} de 4: {STEPS[step - 1].label}
            </p>
          </div>
          <div className="flex items-center gap-4">
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

      <ScrollArea className="flex-1">
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
                      <Button variant="outline" size="sm" className="flex-1" disabled>
                        <FileSpreadsheet className="size-4" />
                        XLSX/CSV
                      </Button>
                    </div>
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
                          <TableHead>Estado</TableHead>
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
                            <TableCell>
                              {r.etapa ? (
                                <Badge variant="outline">{ETAPA_LABELS[r.etapa] ?? r.etapa}</Badge>
                              ) : (
                                '-'
                              )}
                            </TableCell>
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
                        onClick={() => setMessage((m) => ({ ...m, channel: ch }))}
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
                      disabled={!message.body.trim()}
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
                    <Textarea
                      placeholder="Escribe tu mensaje. Usa {{nombre}} para personalizar."
                      value={message.body}
                      onChange={(e) => setMessage((m) => ({ ...m, body: e.target.value }))}
                      rows={12}
                      className="mt-1 font-mono text-sm"
                    />
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
                    <div className="whitespace-pre-wrap text-sm">{previewBody || 'Sin contenido'}</div>
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
                    <div className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                      {previewBody}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="bg-[#13944C] hover:bg-[#0f7a3d]"
                      onClick={() => setConfirmSendOpen(true)}
                      disabled={recipients.length === 0}
                    >
                      <Send className="size-4" />
                      Enviar ahora
                    </Button>
                    <Button variant="outline" onClick={() => setScheduleOpen(true)}>
                      <Calendar className="size-4" />
                      Programar envío
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
              (step === 2 && !message.body.trim())
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
              setMessage({ channel: 'email', subject: '', body: '' });
              setCampaignSent(null);
            }}
          >
            Nueva campaña
          </Button>
        )}
      </div>

      {/* Confirm Send Modal */}
      <Dialog open={confirmSendOpen} onOpenChange={setConfirmSendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar envío</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Se enviará la campaña a {recipients.length} destinatarios. Esta acción no se puede deshacer.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSendOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-[#13944C] hover:bg-[#0f7a3d]"
              onClick={handleMockSend}
            >
              <Send className="size-4" />
              Enviar
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

      {/* Schedule Modal */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Programar envío</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Elige la fecha y hora para enviar la campaña automáticamente.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Fecha</Label>
              <Input type="date" className="mt-1" />
            </div>
            <div>
              <Label>Hora</Label>
              <Input type="time" className="mt-1" defaultValue="09:00" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>
              Cancelar
            </Button>
            <Button className="bg-[#13944C] hover:bg-[#0f7a3d]">
              Programar
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
