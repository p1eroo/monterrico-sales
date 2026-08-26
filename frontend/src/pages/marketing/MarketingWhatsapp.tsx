import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { toast } from '@/lib/notify';
import { cn } from '@/lib/utils';
import {
  fetchWhatsAppCloudAccounts,
  fetchWhatsAppCloudTemplates,
  fetchWhatsAppBulkCampaign,
  fetchWhatsAppBulkCampaigns,
  syncWhatsAppCloudTemplates,
  type WhatsAppBulkCampaignSummary,
  type WhatsAppCloudAccount,
  type WhatsAppEstimatedCost,
} from '@/lib/marketingApi';
import { TemplatesTab } from './whatsapp/TemplatesTab';
import { AudienceTab } from './whatsapp/AudienceTab';
import { SendTab } from './whatsapp/SendTab';
import { ResultsTab } from './whatsapp/ResultsTab';
import {
  type WhatsAppContact,
  type WhatsAppTemplate,
} from './whatsapp/mockData';
import { campaignRecipientsToSendResults } from './whatsapp/whatsappCampaignUtils';

type WhatsappTab = 'plantillas' | 'audiencia' | 'envio' | 'resultados';

const TABS: { id: WhatsappTab; label: string }[] = [
  { id: 'plantillas', label: 'Plantillas' },
  { id: 'audiencia', label: 'Audiencia' },
  { id: 'envio', label: 'Envío' },
  { id: 'resultados', label: 'Resultados' },
];

const ACTIVE_CHANNEL_KEY = 'marketing_whatsapp_active_channel_v1';

function resolveActiveAccount(accounts: WhatsAppCloudAccount[]): WhatsAppCloudAccount | null {
  if (accounts.length === 0) return null;
  const stored = localStorage.getItem(ACTIVE_CHANNEL_KEY);
  if (stored) {
    const match = accounts.find((a) => a.id === stored);
    if (match) return match;
  }
  return accounts.find((a) => a.isDefault) ?? accounts[0] ?? null;
}

export default function MarketingWhatsapp() {
  const [tab, setTab] = useState<WhatsappTab>('plantillas');
  const [accounts, setAccounts] = useState<WhatsAppCloudAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [activeAccountId, setActiveAccountIdState] = useState<string | null>(null);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  const [audienceFileName, setAudienceFileName] = useState<string | null>(null);
  const [templateForSend, setTemplateForSend] = useState<string | null>(null);
  const [campaignSummaries, setCampaignSummaries] = useState<WhatsAppBulkCampaignSummary[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [results, setResults] = useState<ReturnType<typeof campaignRecipientsToSendResults> | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [activeCampaignMeta, setActiveCampaignMeta] = useState<{
    templateName: string;
    status: string;
    estimatedCost: WhatsAppEstimatedCost;
  } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [createTemplateOpen, setCreateTemplateOpen] = useState(false);

  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === activeAccountId) ?? resolveActiveAccount(accounts),
    [activeAccountId, accounts],
  );

  const loadTemplates = useCallback(async (accountId: string) => {
    try {
      const data = await fetchWhatsAppCloudTemplates(accountId);
      setTemplates(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cargar plantillas');
      setTemplates([]);
    }
  }, []);

  const reloadAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const next = await fetchWhatsAppCloudAccounts();
      setAccounts(next);
      const resolved = resolveActiveAccount(next);
      if (resolved) {
        setActiveAccountIdState(resolved.id);
        localStorage.setItem(ACTIVE_CHANNEL_KEY, resolved.id);
        await loadTemplates(resolved.id);
      } else {
        setActiveAccountIdState(null);
        setTemplates([]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cargar cuentas WhatsApp');
      setAccounts([]);
      setTemplates([]);
    } finally {
      setLoadingAccounts(false);
    }
  }, [loadTemplates]);

  useEffect(() => {
    void reloadAccounts();
  }, [reloadAccounts]);

  const selectedContacts = contacts;

  const loadCampaignDetail = useCallback(async (campaignId: string) => {
    setResultsLoading(true);
    try {
      const campaign = await fetchWhatsAppBulkCampaign(campaignId);
      setSelectedCampaignId(campaignId);
      setActiveCampaignMeta({
        templateName: campaign.templateName,
        status: campaign.status,
        estimatedCost: campaign.estimatedCost,
      });
      setResults(campaignRecipientsToSendResults(campaign));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cargar resultados');
    } finally {
      setResultsLoading(false);
    }
  }, []);

  const loadCampaignHistory = useCallback(
    async (preferId?: string) => {
      if (!activeAccount) return;
      setResultsLoading(true);
      try {
        const list = await fetchWhatsAppBulkCampaigns(activeAccount.id);
        setCampaignSummaries(list);
        const id =
          preferId && list.some((c) => c.id === preferId)
            ? preferId
            : selectedCampaignId && list.some((c) => c.id === selectedCampaignId)
              ? selectedCampaignId
              : list[0]?.id;
        if (!id) {
          setSelectedCampaignId(null);
          setResults(null);
          setActiveCampaignMeta(null);
          return;
        }
        const campaign = await fetchWhatsAppBulkCampaign(id);
        setSelectedCampaignId(id);
        setActiveCampaignMeta({
        templateName: campaign.templateName,
        status: campaign.status,
        estimatedCost: campaign.estimatedCost,
      });
        setResults(campaignRecipientsToSendResults(campaign));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al cargar historial');
      } finally {
        setResultsLoading(false);
      }
    },
    [activeAccount, selectedCampaignId],
  );

  useEffect(() => {
    if (tab === 'resultados' && activeAccount) {
      void loadCampaignHistory();
    }
  }, [tab, activeAccount?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const goTo = useCallback((next: WhatsappTab) => {
    setTab(next);
    window.scrollTo({ top: 0 });
  }, []);

  const handleCreateTemplate = useCallback((_template: WhatsAppTemplate) => {
    toast.message('Próximamente', {
      description: 'Crear plantillas en Meta desde el CRM estará disponible en una siguiente versión. Usa Meta Business Suite por ahora.',
    });
  }, []);

  const handleDeleteTemplate = useCallback((_id: string) => {
    toast.message('No disponible', {
      description: 'Eliminar plantillas en Meta desde el CRM aún no está implementado.',
    });
  }, []);

  const handleSync = useCallback(() => {
    if (syncing || !activeAccount) return;
    setSyncing(true);
    void syncWhatsAppCloudTemplates(activeAccount.id)
      .then((synced) => {
        setTemplates(synced);
        void reloadAccounts();
        toast.success('Plantillas sincronizadas con Meta', {
          description: `${synced.length} plantilla(s) desde WABA ${activeAccount.wabaId}.`,
        });
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Error al sincronizar');
      })
      .finally(() => {
        setSyncing(false);
      });
  }, [activeAccount, syncing, reloadAccounts]);

  const handleImportAudience = useCallback((imported: WhatsAppContact[], fileName: string) => {
    setContacts(imported);
    setAudienceFileName(fileName);
  }, []);

  const handleRemoveIds = useCallback((ids: string[]) => {
    setContacts((prev) => prev.filter((c) => !ids.includes(c.id)));
  }, []);

  const handleClearAudience = useCallback(() => {
    setContacts([]);
    setAudienceFileName(null);
  }, []);

  const handleUseTemplate = useCallback(
    (id: string) => {
      setTemplateForSend(id);
      goTo('envio');
    },
    [goTo],
  );

  const handleSent = useCallback(
    (campaignId: string) => {
      setSelectedCampaignId(campaignId);
      goTo('resultados');
      void loadCampaignHistory(campaignId);
      toast.success('Envío completado vía Meta', {
        description: 'Los resultados quedaron guardados en el historial.',
      });
    },
    [goTo, loadCampaignHistory],
  );

  const handleNewSend = useCallback(() => {
    goTo('envio');
  }, [goTo]);

  const handleSelectCampaign = useCallback(
    (campaignId: string) => {
      void loadCampaignDetail(campaignId);
    },
    [loadCampaignDetail],
  );

  if (loadingAccounts) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-3">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Cargando WhatsApp Masivo…</p>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="WhatsApp Masivo"
          description="Envío masivo por WhatsApp Business API (Meta) usando plantillas aprobadas."
          className="mb-4"
        />
        <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-xl border bg-card px-6 text-center">
          <p className="font-medium">No hay canal WhatsApp conectado</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Conecta un número en Marketing → Integraciones (sección WhatsApp Cloud API) para sincronizar plantillas y enviar mensajes masivos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="WhatsApp Masivo"
        description="Envío masivo por WhatsApp Business API (Meta) usando plantillas aprobadas."
        className="mb-4"
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex h-11 w-full items-center gap-1 rounded-xl border bg-card p-1 sm:w-auto">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                'inline-flex h-full flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors sm:flex-none',
                tab === item.id
                  ? 'bg-[#13944C] text-white'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {item.label}
              {item.id === 'audiencia' && contacts.length > 0 && (
                <span
                  className={cn(
                    'rounded-full px-1.5 text-[11px] font-semibold',
                    tab === item.id ? 'bg-white/20 text-white' : 'bg-black/10',
                  )}
                >
                  {contacts.length}
                </span>
              )}
            </button>
          ))}
        </div>
        {tab === 'plantillas' ? (
          <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
            <Button
              type="button"
              variant="outline"
              className="h-9 text-sm font-normal"
              onClick={handleSync}
              disabled={syncing || !activeAccount}
            >
              {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Sincronizar
            </Button>
            <Button
              type="button"
              className="h-9 text-sm font-normal shadow-md"
              onClick={() => setCreateTemplateOpen(true)}
              disabled={!activeAccount}
            >
              <Plus className="size-4" />
              Nueva
            </Button>
          </div>
        ) : null}
      </div>

      {tab === 'plantillas' && (
        <TemplatesTab
          templates={templates}
          activeAccount={activeAccount}
          createOpen={createTemplateOpen}
          onCreateOpenChange={setCreateTemplateOpen}
          onCreate={handleCreateTemplate}
          onDelete={handleDeleteTemplate}
          onUseTemplate={handleUseTemplate}
        />
      )}
      {tab === 'audiencia' && (
        <AudienceTab
          contacts={contacts}
          fileName={audienceFileName}
          onImport={handleImportAudience}
          onRemoveIds={handleRemoveIds}
          onClear={handleClearAudience}
        />
      )}
      {tab === 'envio' && (
        <SendTab
          templates={templates}
          selectedContacts={selectedContacts}
          initialTemplateId={templateForSend}
          activeAccount={activeAccount}
          onSent={handleSent}
          onGoToTemplates={() => goTo('plantillas')}
          onGoToAudience={() => goTo('audiencia')}
        />
      )}
      {tab === 'resultados' && (
        <ResultsTab
          results={results ?? []}
          campaigns={campaignSummaries}
          selectedCampaignId={selectedCampaignId}
          templateName={activeCampaignMeta?.templateName}
          campaignStatus={activeCampaignMeta?.status}
          estimatedCost={activeCampaignMeta?.estimatedCost}
          loading={resultsLoading && campaignSummaries.length === 0}
          onSelectCampaign={handleSelectCampaign}
          onNewSend={handleNewSend}
        />
      )}
    </div>
  );
}
