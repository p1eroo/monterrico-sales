import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Clock, Copy, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { fetchIntegrations, type MarketingIntegration } from '@/lib/marketingApi';

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle2; class: string }> = {
  active: { label: 'Activo', icon: CheckCircle2, class: 'text-emerald-600 bg-emerald-100' },
  inactive: { label: 'Inactivo', icon: XCircle, class: 'text-red-600 bg-red-100' },
  coming_soon: { label: 'Próximamente', icon: Clock, class: 'text-amber-600 bg-amber-100' },
};

function IntegrationPanel({ int: initialInt }: { int: MarketingIntegration }) {
  const [campaigns, setCampaigns] = useState(initialInt.campaigns);
  const int = initialInt;
  const st = STATUS_CONFIG[int.status];
  const Icon = st.icon;

  const toggleCampaign = (campId: string) => {
    setCampaigns((prev) =>
      prev.map((c) =>
        c.id === campId ? { ...c, status: c.status === 'active' ? 'inactive' : 'active' } : c,
      ),
    );
    const c = campaigns.find((c) => c.id === campId);
    toast.success(`Campaña ${c?.status === 'active' ? 'desactivada' : 'activada'} (mock)`);
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-lg font-bold text-primary">
            {int.name === 'Facebook' ? 'f' : '𝕏'}
          </div>
          <div>
            <p className="text-sm font-semibold">{int.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${st.class}`}>
                <Icon className="size-3" /> {st.label}
              </span>
              {int.status !== 'coming_soon' && int.webhookUrl && (
                <span className="text-xs text-muted-foreground truncate max-w-[300px]">{int.webhookUrl}</span>
              )}
            </div>
          </div>
        </div>
        {int.status !== 'coming_soon' && (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => { navigator.clipboard.writeText(int.webhookUrl || ''); toast.success('URL copiada'); }}>
            <Copy className="size-3" /> Copiar Webhook
          </Button>
        )}
      </div>

      {int.status === 'coming_soon' ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 py-16">
          <Clock className="mb-3 size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Esta integración estará disponible próximamente.</p>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 py-16">
          <p className="text-sm text-muted-foreground">No hay campañas configuradas.</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Campaña</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Estado</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Leads</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={c.status === 'active'}
                        onCheckedChange={() => toggleCampaign(c.id)}
                      />
                      <span className={cn('text-xs font-medium', c.status === 'active' ? 'text-emerald-600' : 'text-muted-foreground')}>
                        {c.status === 'active' ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.leads}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function MarketingIntegrations() {
  const [integrations, setIntegrations] = useState<MarketingIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('facebook');

  useEffect(() => {
    fetchIntegrations().then(setIntegrations).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Integraciones" description="Conecta tus plataformas de anuncios para importar leads automáticamente" />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="gap-2">
          {integrations.map((int) => (
            <TabsTrigger key={int.id} value={int.id} className="gap-2">
              <span>{int.name === 'Facebook' ? 'f' : '𝕏'}</span>
              {int.name}
            </TabsTrigger>
          ))}
        </TabsList>
        {integrations.map((int) => (
          <TabsContent key={int.id} value={int.id} className="mt-4">
            <IntegrationPanel int={int} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
