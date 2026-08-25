import { useCallback, useRef, useState } from 'react';
import { FlaskConical, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/PageHeader';
import { toast } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { TemplatesTab } from './whatsapp/TemplatesTab';
import { AudienceTab } from './whatsapp/AudienceTab';
import { SendTab } from './whatsapp/SendTab';
import { ResultsTab } from './whatsapp/ResultsTab';
import {
  MOCK_WHATSAPP_CONTACTS,
  MOCK_WHATSAPP_TEMPLATES,
  type WhatsAppContact,
  type WhatsAppSendResult,
  type WhatsAppTemplate,
} from './whatsapp/mockData';

type WhatsappTab = 'plantillas' | 'audiencia' | 'envio' | 'resultados';

const TABS: { id: WhatsappTab; label: string }[] = [
  { id: 'plantillas', label: 'Plantillas' },
  { id: 'audiencia', label: 'Audiencia' },
  { id: 'envio', label: 'Envío' },
  { id: 'resultados', label: 'Resultados' },
];

export default function MarketingWhatsapp() {
  const [tab, setTab] = useState<WhatsappTab>('plantillas');
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>(MOCK_WHATSAPP_TEMPLATES);
  const [contacts, setContacts] = useState<WhatsAppContact[]>(MOCK_WHATSAPP_CONTACTS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [templateForSend, setTemplateForSend] = useState<string | null>(null);
  const [results, setResults] = useState<WhatsAppSendResult[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const excelImportRef = useRef(0);

  const selectedContacts = contacts.filter((c) => selectedIds.has(c.id));

  const goTo = useCallback((next: WhatsappTab) => {
    setTab(next);
    window.scrollTo({ top: 0 });
  }, []);

  const handleCreateTemplate = useCallback((template: WhatsAppTemplate) => {
    setTemplates((prev) => [template, ...prev]);
    toast.success('Plantilla enviada a Meta para revisión', {
      description: 'Normalmente la revisión toma unos minutos.',
    });
  }, []);

  const handleDeleteTemplate = useCallback((id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    toast.success('Plantilla eliminada');
  }, []);

  const handleSync = useCallback(() => {
    if (syncing) return;
    setSyncing(true);
    window.setTimeout(() => {
      setSyncing(false);
      toast.success('Plantillas sincronizadas con Meta', {
        description: `${templates.length} plantilla(s) disponibles desde la cuenta de negocio.`,
      });
    }, 1400);
  }, [syncing, templates.length]);

  const handleToggleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleAddAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      contacts.forEach((c) => next.add(c.id));
      return next;
    });
    toast.success(`Audiencia actualizada: ${contacts.length} contacto(s)`);
  }, [contacts]);

  const handleRemoveIds = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  const handleImportExcel = useCallback(() => {
    excelImportRef.current += 1;
    const n = excelImportRef.current;
    const newContacts: WhatsAppContact[] = [
      {
        id: `xl-${Date.now()}`,
        name: `Contacto Excel ${n}`,
        phone: `900${String(100000 + n).slice(-6)}`,
        company: 'Importado de plantilla.xlsx',
        source: 'excel',
        hasWhatsApp: n % 3 !== 0,
      },
    ];
    setContacts((prev) => [...prev, ...newContacts]);
    toast.success('Contactos importados desde Excel', {
      description: `${newContacts.length} registro(s) agregados a la lista.`,
    });
  }, []);

  const handleUseTemplate = useCallback((id: string) => {
    setTemplateForSend(id);
    goTo('envio');
  }, [goTo]);

  const handleSent = useCallback((sentResults: WhatsAppSendResult[]) => {
    setResults(sentResults);
    goTo('resultados');
    toast.success('Envío completado vía Meta', {
      description: `${sentResults.filter((r) => r.status !== 'fallido').length} mensaje(s) aceptados, ${sentResults.filter((r) => r.status === 'fallido').length} fallidos.`,
    });
  }, [goTo]);

  const handleNewSend = useCallback(() => {
    setResults(null);
    goTo('envio');
  }, [goTo]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="WhatsApp Masivo"
        description="Envío masivo por WhatsApp Business API (Meta) usando plantillas aprobadas."
        className="mb-4"
      >
        <Badge
          variant="outline"
          className="inline-flex h-7 items-center gap-1.5 rounded-full border-violet-300/60 bg-violet-50 px-3 text-[11px] font-semibold text-violet-700 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-200"
        >
          <FlaskConical className="size-3.5" />
          Modo demostración (mock)
        </Badge>
      </PageHeader>

      <div className="inline-flex h-11 w-full items-center gap-1 rounded-xl border bg-card p-1 sm:w-auto">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              'inline-flex h-full flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors',
              tab === item.id
                ? 'bg-[#13944C] text-white'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
            {item.id === 'audiencia' && selectedIds.size > 0 && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-[11px] font-semibold',
                  tab === item.id ? 'bg-white/20 text-white' : 'bg-black/10',
                )}
              >
                {selectedIds.size}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'plantillas' && (
        <TemplatesTab
          templates={templates}
          onCreate={handleCreateTemplate}
          onDelete={handleDeleteTemplate}
          onSync={handleSync}
          syncing={syncing}
          onUseTemplate={handleUseTemplate}
        />
      )}
      {tab === 'audiencia' && (
        <AudienceTab
          contacts={contacts}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onAddAll={handleAddAll}
          onRemoveIds={handleRemoveIds}
          onImportExcel={handleImportExcel}
        />
      )}
      {tab === 'envio' && (
        <SendTab
          templates={templates}
          selectedContacts={selectedContacts}
          initialTemplateId={templateForSend}
          onSent={handleSent}
          onGoToTemplates={() => goTo('plantillas')}
          onGoToAudience={() => goTo('audiencia')}
        />
      )}
      {tab === 'resultados' &&
        (results ? (
          <ResultsTab results={results} onNewSend={handleNewSend} />
        ) : (
          <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-xl border bg-card">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Aún no hay envíos. Completa un envío para ver los resultados.
            </p>
          </div>
        ))}
    </div>
  );
}
