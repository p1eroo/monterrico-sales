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
import { PhonePreview } from './PhonePreview';
import {
  WHATSAPP_CATEGORY_META,
  extractWhatsAppPlaceholders,
  type WhatsAppContact,
  type WhatsAppSendResult,
  type WhatsAppSendStatus,
  type WhatsAppTemplate,
} from './mockData';

type VariableSource = 'name' | 'company' | 'phone' | 'form';

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

function valueForField(c: WhatsAppContact, field: VariableSource): string {
  if (field === 'name') return c.name;
  if (field === 'phone') return `+51 ${c.phone}`;
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
  selectedContacts,
  initialTemplateId,
  onSent,
  onGoToTemplates,
  onGoToAudience,
}: {
  templates: WhatsAppTemplate[];
  selectedContacts: WhatsAppContact[];
  initialTemplateId: string | null;
  onSent: (results: WhatsAppSendResult[]) => void;
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

  const sampleContact = selectedContacts.find((c) => c.hasWhatsApp) ?? selectedContacts[0];
  const withoutWhatsApp = selectedContacts.filter((c) => !c.hasWhatsApp).length;

  const simulateSend = () => {
    if (!template || selectedContacts.length === 0) return;
    setSending(true);
    setProgress(0);
    const started = new Date();
    const interval = window.setInterval(() => {
      setProgress((p) => {
        const next = p + Math.random() * 9 + 3;
        if (next >= 100) {
          window.clearInterval(interval);
          const results: WhatsAppSendResult[] = selectedContacts.map((c, i) => {
            if (!c.hasWhatsApp) {
              return {
                contactId: c.id,
                name: c.name,
                phone: c.phone,
                status: 'fallido' as const,
                error: 'El número no tiene WhatsApp activo',
                sentAt: started.toISOString(),
              };
            }
            const roll = i % 5;
            let status: WhatsAppSendStatus = 'entregado';
            if (roll === 0) status = 'enviado';
            if (roll === 1) status = 'leido';
            return {
              contactId: c.id,
              name: c.name,
              phone: c.phone,
              status,
              sentAt: started.toISOString(),
            };
          });
          window.setTimeout(() => {
            setSending(false);
            setProgress(0);
            onSent(results);
          }, 400);
          return 100;
        }
        return next;
      });
    }, 120);
  };

  const handleSend = () => {
    if (!template) {
      toast.error('Selecciona una plantilla aprobada para enviar.');
      return;
    }
    if (selectedContacts.length === 0) {
      toast.error('Agrega contactos a la audiencia antes de enviar.');
      return;
    }
    if (withoutWhatsApp > 0) {
      toast.message('Algunos contactos no tienen WhatsApp', {
        description: `${withoutWhatsApp} contacto(s) se omitirán o marcarán como fallidos.`,
      });
    }
    simulateSend();
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

  if (selectedContacts.length === 0) {
    return (
      <GlassCard>
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
          <MessageCircle className="size-10 text-muted-foreground/40" />
          <p className="font-medium">Aún no hay contactos</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Adjunta contactos (leads, CRM o Excel) para armar la audiencia del envío.
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
              <div className="flex items-center gap-2 pl-7">
                <CalendarClock className="size-4 text-muted-foreground" />
                <Input
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(e) => setScheduleAt(e.target.value)}
                  className="h-9"
                />
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
                  {selectedContacts.length}
                </Badge>
              </p>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Con WhatsApp</span>
                <span className="font-medium">{selectedContacts.length - withoutWhatsApp}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sin WhatsApp (se omitirán)</span>
                <span className="font-medium text-amber-600 dark:text-amber-400">{withoutWhatsApp}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plantilla</span>
                <span className="max-w-[180px] truncate font-medium">{template?.name ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Programación</span>
                <span className="font-medium">
                  {scheduleNow
                    ? 'Inmediata'
                    : scheduleAt
                      ? new Date(scheduleAt).toLocaleString('es-PE')
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

            <Button
              className="w-full bg-[#13944C] shadow-md hover:bg-[#0f7a3d]"
              disabled={sending}
              onClick={handleSend}
            >
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {sending ? 'Enviando…' : scheduleNow ? 'Enviar ahora' : 'Programar envío'}
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
                  Enviando vía Meta… {Math.round(progress)}%
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
