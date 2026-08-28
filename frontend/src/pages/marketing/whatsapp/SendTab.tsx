import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Loader2,
  MessageCircle,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GlassCard } from '@/components/shared/GlassCard';
import { toast } from '@/lib/notify';
import {
  createWhatsAppBulkCampaign,
  fetchWhatsAppBulkCampaign,
  sendWhatsAppBulkCampaign,
  type WhatsAppCloudAccount,
} from '@/lib/marketingApi';
import { PhonePreview } from './PhonePreview';
import { formatWhatsAppPhoneDisplay } from './whatsappAudienceExcel';
import {
  WHATSAPP_CATEGORY_META,
  extractWhatsAppPlaceholders,
  type WhatsAppContact,
  type WhatsAppTemplate,
} from './mockData';
import {
  audienceCount,
  audiencePreviewContacts,
  resolveWhatsAppAudienceContacts,
  type WhatsAppAudience,
} from './whatsappAudienceModel';

type VariableSource = 'name' | 'company' | 'phone' | 'form';

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

const VARIABLE_FIELD_LABEL: Record<VariableSource, string> = {
  name: 'Nombre',
  company: 'Empresa / Formulario',
  phone: 'Teléfono',
  form: 'Formulario',
};

const NAMED_DEFAULT: Record<string, VariableSource> = {
  nombre: 'name',
  first_name: 'name',
  name: 'name',
  empresa: 'company',
  company: 'company',
  formulario: 'form',
  telefono: 'phone',
  phone: 'phone',
  fecha: 'company',
};

/** `YYYY-MM-DDTHH:mm` como hora de pared en Perú (UTC−5) → ISO UTC. */
function limaLocalInputToIso(value: string): string {
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) throw new Error('Fecha u hora inválida');
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  return new Date(Date.UTC(y, mo - 1, d, h + 5, mi, 0, 0)).toISOString();
}

function formatLimaLocalInput(value: string): string {
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return value;
  return `${m[3]}/${m[2]}/${m[1]}, ${m[4]}:${m[5]} (Perú)`;
}

/** Mínimo sugerido para datetime-local: ahora en Lima. */
function limaNowLocalInput(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`;
}

function valueForField(c: WhatsAppContact, field: VariableSource): string {
  if (field === 'name') return c.name;
  if (field === 'phone') return formatWhatsAppPhoneDisplay(c.phone);
  return c.company ?? '';
}

function defaultSourceFor(key: string, index: number): VariableSource {
  const defaults: VariableSource[] = ['name', 'company', 'phone', 'form'];
  if (/^\d+$/.test(key)) return defaults[(Number(key) - 1) % defaults.length];
  return NAMED_DEFAULT[key.toLowerCase()] ?? defaults[index % defaults.length];
}

function renderPlaceholders(
  text: string,
  c: WhatsAppContact,
  map: Record<string, VariableSource>,
): string {
  return text.replace(/\{\{([a-z][a-z0-9_]*|\d+)\}\}/gi, (_, key: string) => {
    const field = map[key] ?? 'name';
    return valueForField(c, field) || `[${VARIABLE_FIELD_LABEL[field]}]`;
  });
}

export function SendTab({
  templates,
  audience,
  initialTemplateId,
  activeAccount,
  onSent,
  onGoToTemplates,
  onGoToAudience,
}: {
  templates: WhatsAppTemplate[];
  audience: WhatsAppAudience;
  initialTemplateId: string | null;
  activeAccount?: WhatsAppCloudAccount | null;
  onSent: (campaignId: string, meta?: { scheduled?: boolean; scheduledAt?: string | null }) => void;
  onGoToTemplates: () => void;
  onGoToAudience: () => void;
}) {
  const approved = useMemo(() => templates.filter((t) => t.status === 'approved'), [templates]);
  const [templateId, setTemplateId] = useState<string | null>(
    initialTemplateId && approved.some((t) => t.id === initialTemplateId) ? initialTemplateId : approved[0]?.id ?? null,
  );
  const [variableMap, setVariableMap] = useState<Record<string, VariableSource>>({});
  const [scheduleNow, setScheduleNow] = useState(true);
  const [scheduleAt, setScheduleAt] = useState('');
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resolvingLabel, setResolvingLabel] = useState<string | null>(null);

  const template = approved.find((t) => t.id === templateId) ?? null;
  const placeholders = useMemo(
    () => (template ? extractWhatsAppPlaceholders(template.header, template.body) : []),
    [template],
  );

  const effectiveVariableMap = useMemo(() => {
    const next: Record<string, VariableSource> = {};
    placeholders.forEach((key, i) => {
      next[key] = variableMap[key] ?? defaultSourceFor(key, i);
    });
    return next;
  }, [placeholders, variableMap]);

  const totalAudience = audienceCount(audience);
  const previewContacts = useMemo(() => audiencePreviewContacts(audience, 1), [audience]);
  const sampleContact = previewContacts[0];
  const deferredCrm = audience.mode === 'crmSelectAll';
  const withoutWhatsApp =
    audience.mode === 'explicit'
      ? audience.contacts.filter((c) => !c.hasWhatsApp).length
      : 0;

  const limitReached =
    template?.dailySendLimit != null &&
    (template.sentToday ?? 0) >= template.dailySendLimit;

  const runSend = () => {
    if (!template || !activeAccount || totalAudience === 0) return;

    let scheduledAtIso: string | undefined;
    if (!scheduleNow) {
      if (!scheduleAt.trim()) {
        toast.error('Elige fecha y hora de envío (hora Perú).');
        return;
      }
      try {
        scheduledAtIso = limaLocalInputToIso(scheduleAt);
      } catch {
        toast.error('Fecha u hora inválida.');
        return;
      }
      const when = new Date(scheduledAtIso).getTime();
      if (when <= Date.now() + 15_000) {
        toast.error('La programación debe ser al menos unos minutos en el futuro (hora Perú).');
        return;
      }
    }

    if (limitReached) {
      toast.error(
        `Se alcanzó el límite diario de ${template.dailySendLimit} envíos para «${template.name}».`,
      );
      return;
    }

    setSending(true);
    setProgress(3);

    void (async () => {
      try {
        if (deferredCrm) {
          setResolvingLabel('Cargando audiencia del CRM…');
        }
        const selectedContacts = await resolveWhatsAppAudienceContacts(audience);
        setResolvingLabel(null);

        if (selectedContacts.length === 0) {
          toast.error('No hay destinatarios con celular válido.');
          return;
        }

        const eligible = selectedContacts.filter((c) => c.hasWhatsApp);
        if (eligible.length === 0) {
          toast.error('Ningún contacto seleccionado tiene WhatsApp activo.');
          return;
        }

        const skipped = selectedContacts.length - eligible.length;
        if (skipped > 0) {
          toast.message('Algunos contactos no tienen WhatsApp', {
            description: `${skipped} contacto(s) se marcarán como fallidos.`,
          });
        }

        if (
          template.dailySendLimit != null &&
          (template.sentToday ?? 0) + eligible.length > template.dailySendLimit
        ) {
          const remaining = Math.max(0, template.dailySendLimit - (template.sentToday ?? 0));
          toast.error(
            remaining === 0
              ? `Límite diario alcanzado para «${template.name}».`
              : `Solo quedan ${remaining} envío(s) hoy para «${template.name}». Reduce la audiencia o sube el límite.`,
          );
          return;
        }

        setProgress(8);
        setResolvingLabel(scheduledAtIso ? 'Programando envío…' : 'Creando campaña…');
        const campaign = await createWhatsAppBulkCampaign({
          accountId: activeAccount.id,
          templateId: template.id,
          variableMapping: effectiveVariableMap,
          recipients: eligible.map((c) => ({
            phone: c.phone,
            name: c.name,
            company: c.company,
            source: c.source,
            ...(c.flotaProspectoId ? { flotaProspectoId: c.flotaProspectoId } : {}),
          })),
          ...(scheduledAtIso ? { scheduledAt: scheduledAtIso } : {}),
        });

        if (campaign.status === 'scheduled') {
          setProgress(100);
          onSent(campaign.id, { scheduled: true, scheduledAt: campaign.scheduledAt });
          return;
        }

        setResolvingLabel('Enviando vía Meta…');
        await sendWhatsAppBulkCampaign(campaign.id);

        let current = campaign;
        while (current.status === 'sending' || current.status === 'draft') {
          await sleep(1200);
          current = await fetchWhatsAppBulkCampaign(campaign.id);
          const done = current.sent + current.failed;
          setProgress(Math.min(99, Math.round((done / Math.max(1, current.total)) * 100)));
        }

        setProgress(100);
        onSent(campaign.id, { scheduled: false });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al enviar');
      } finally {
        setResolvingLabel(null);
        setSending(false);
        setProgress(0);
      }
    })();
  };

  const handleSend = () => {
    if (!template) {
      toast.error('Selecciona una plantilla aprobada para enviar.');
      return;
    }
    if (!activeAccount) {
      toast.error('No hay canal WhatsApp activo.');
      return;
    }
    if (totalAudience === 0) {
      toast.error('Agrega contactos a la audiencia antes de enviar.');
      return;
    }
    if (audience.mode === 'explicit') {
      const eligible = audience.contacts.filter((c) => c.hasWhatsApp);
      if (eligible.length === 0) {
        toast.error('Ningún contacto seleccionado tiene WhatsApp activo.');
        return;
      }
      if (withoutWhatsApp > 0) {
        toast.message('Algunos contactos no tienen WhatsApp', {
          description: `${withoutWhatsApp} contacto(s) se marcarán como fallidos.`,
        });
      }
    }
    runSend();
  };

  if (approved.length === 0) {
    return (
      <GlassCard>
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
          <MessageCircle className="size-10 text-muted-foreground/40" />
          <p className="font-medium">No hay plantillas aprobadas</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Para enviar por WhatsApp necesitas una plantilla aprobada por Meta. Crea una o sincroniza las existentes.
          </p>
          <Button variant="outline" onClick={onGoToTemplates}>
            Ir a Plantillas
          </Button>
        </div>
      </GlassCard>
    );
  }

  if (totalAudience === 0) {
    return (
      <GlassCard>
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
          <MessageCircle className="size-10 text-muted-foreground/40" />
          <p className="font-medium">Aún no hay contactos</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Importa un Excel o selecciona prospectos del CRM en la pestaña Audiencia.
          </p>
          <Button
            className="bg-[#13944C] hover:bg-[#0f7a3d]"
            onClick={onGoToAudience}
          >
            Ir a Audiencia
          </Button>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <GlassCard>
          <div className="space-y-4 px-5 py-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                1 · Plantilla
              </p>
              <Button variant="link" size="sm" className="h-auto px-0 text-xs" onClick={onGoToTemplates}>
                Ver todas
              </Button>
            </div>
            <Select
              value={template?.id ?? '__none__'}
              onValueChange={(v) => setTemplateId(v === '__none__' ? null : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona una plantilla aprobada" />
              </SelectTrigger>
              <SelectContent>
                {approved.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} — {WHATSAPP_CATEGORY_META[t.category]}
                    {t.dailySendLimit != null
                      ? ` · ${t.sentToday ?? 0}/${t.dailySendLimit} hoy`
                      : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {template && (
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Contenido de la plantilla
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{template.body}</p>
                {template.dailySendLimit != null ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Límite diario: {(template.sentToday ?? 0).toLocaleString('es-PE')} /{' '}
                    {template.dailySendLimit.toLocaleString('es-PE')}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </GlassCard>

        <GlassCard>
          <div className="space-y-4 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              2 · Mapeo de variables
            </p>
            {placeholders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Esta plantilla no usa variables: el mensaje será idéntico para todos.
              </p>
            ) : (
              <div className="space-y-2">
                {placeholders.map((key) => (
                  <div key={key} className="flex items-center gap-3">
                    <code className="min-w-12 shrink-0 rounded-md bg-muted px-1.5 py-1 text-center text-xs font-semibold">
                      {`{{${key}}}`}
                    </code>
                    <Select
                      value={effectiveVariableMap[key] ?? 'name'}
                      onValueChange={(v) => setVariableMap((prev) => ({ ...prev, [key]: v as VariableSource }))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(['name', 'company', 'phone', 'form'] as VariableSource[]).map((f) => (
                          <SelectItem key={f} value={f}>
                            {VARIABLE_FIELD_LABEL[f]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {sampleContact && (
                      <span className="truncate text-xs text-muted-foreground">
                        Ej: {valueForField(sampleContact, effectiveVariableMap[key] ?? 'name') || '—'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </GlassCard>

        <GlassCard>
          <div className="space-y-4 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              3 · Programación
            </p>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <Checkbox checked={scheduleNow} onCheckedChange={(v) => setScheduleNow(Boolean(v))} />
              Enviar ahora
            </label>
            {!scheduleNow && (
              <div className="space-y-2 pl-7">
                <div className="flex items-center gap-2">
                  <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
                  <Input
                    type="datetime-local"
                    value={scheduleAt}
                    min={limaNowLocalInput()}
                    onChange={(e) => setScheduleAt(e.target.value)}
                    className="h-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Hora de Perú (UTC−5). El envío se dispara automáticamente a esa hora.
                </p>
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      <div className="space-y-4">
        <GlassCard>
          <div className="space-y-4 px-5 py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">
                Resumen del envío
                <Badge variant="secondary" className="ml-2 align-middle">
                  {totalAudience}
                </Badge>
              </p>
            </div>
            <div className="space-y-1.5 text-sm">
              {activeAccount ? (
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Canal</span>
                  <span className="max-w-[180px] truncate text-right font-medium">{activeAccount.displayName}</span>
                </div>
              ) : null}
              {deferredCrm ? (
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Origen</span>
                  <span className="max-w-[180px] truncate text-right font-medium">
                    Filtro CRM ({audience.source === 'flota' ? 'Flota' : 'Comercial'})
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Destinatarios</span>
                <span className="font-medium">{totalAudience}</span>
              </div>
              {!deferredCrm ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Con WhatsApp</span>
                    <span className="font-medium">{totalAudience - withoutWhatsApp}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sin WhatsApp (se omitirán)</span>
                    <span className="font-medium text-amber-600 dark:text-amber-400">{withoutWhatsApp}</span>
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Los contactos se cargan del CRM al confirmar el envío (una sola petición).
                </p>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plantilla</span>
                <span className="max-w-[180px] truncate font-medium">{template?.name ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Programación</span>
                <span className="max-w-[180px] text-right font-medium">
                  {scheduleNow
                    ? 'Inmediata'
                    : scheduleAt
                      ? formatLimaLocalInput(scheduleAt)
                      : 'Selecciona fecha'}
                </span>
              </div>
            </div>

            {withoutWhatsApp > 0 && (
              <p className="flex items-start gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                Los contactos sin WhatsApp activo se registrarán como fallidos.
              </p>
            )}

            {limitReached ? (
              <p className="flex items-start gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                Límite diario de esta plantilla alcanzado. Ajusta el límite o espera a mañana.
              </p>
            ) : null}

            <Button
              className="w-full bg-[#13944C] shadow-md hover:bg-[#0f7a3d]"
              disabled={sending || limitReached}
              onClick={handleSend}
            >
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {sending
                ? resolvingLabel ?? 'Enviando…'
                : scheduleNow
                  ? 'Enviar ahora'
                  : 'Programar envío'}
            </Button>

            {sending && (
              <div className="space-y-1.5">
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-[#13944C] transition-[width] duration-150"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-center text-xs text-muted-foreground">
                  {resolvingLabel ?? `Enviando vía Meta… ${Math.round(progress)}%`}
                </p>
              </div>
            )}
          </div>
        </GlassCard>

        <GlassCard>
          <div className="px-5 py-4">
            <PhonePreview
              senderName="Taxi Monterrico"
              contactName={sampleContact?.name ?? 'Contacto'}
              header={
                template?.header && sampleContact
                  ? renderPlaceholders(template.header, sampleContact, effectiveVariableMap)
                  : template?.header
              }
              headerMedia={template?.headerMedia}
              footer={template?.footer}
              body={
                template && sampleContact
                  ? renderPlaceholders(template.body, sampleContact, effectiveVariableMap)
                  : 'Selecciona una plantilla para previsualizar…'
              }
              buttons={template?.buttons}
              time="Ahora"
            />
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
