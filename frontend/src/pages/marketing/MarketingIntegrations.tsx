import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Clock, Copy, Loader2, Plus, Trash2, RefreshCw, ExternalLink, Key, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogClose,
} from '@/components/ui/dialog';
import { toast } from '@/lib/notify';
import { API_BASE } from '@/lib/api';
import {
  fetchFacebookAccounts, connectFacebookAccount, disconnectFacebookAccount,
  syncFacebookForms, syncFacebookLeads, type FacebookAccount, type ConnectAccountDto,
} from '@/lib/marketingApi';

const STORAGE_KEY_ID = 'fb_page_id';
const STORAGE_KEY_NAME = 'fb_page_name';

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle2; class: string }> = {
  active: { label: 'Activo', icon: CheckCircle2, class: 'text-emerald-600 bg-emerald-100' },
  inactive: { label: 'Inactivo', icon: XCircle, class: 'text-red-600 bg-red-100' },
  coming_soon: { label: 'Próximamente', icon: Clock, class: 'text-amber-600 bg-amber-100' },
};

function AccountCard({ account, onUpdate, onEdit }: { account: FacebookAccount; onUpdate: () => void; onEdit: () => void }) {
  const navigate = useNavigate();
  const [syncingForms, setSyncingForms] = useState(false);
  const [syncingLeads, setSyncingLeads] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const handleSyncForms = async () => {
    setSyncingForms(true);
    try {
      await syncFacebookForms(account.id);
      toast.success('Formularios sincronizados');
      onUpdate();
    } catch {
      toast.error('Error al sincronizar formularios');
    } finally {
      setSyncingForms(false);
    }
  };

  const handleSyncLeads = async () => {
    setSyncingLeads(true);
    try {
      const result = await syncFacebookLeads(account.id);
      toast.success(`${result.imported} leads importados`);
      onUpdate();
    } catch {
      toast.error('Error al sincronizar leads');
    } finally {
      setSyncingLeads(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectFacebookAccount(account.id);
      localStorage.removeItem(STORAGE_KEY_ID);
      localStorage.removeItem(STORAGE_KEY_NAME);
      toast.success('Cuenta desconectada');
      onUpdate();
    } catch {
      toast.error('Error al desconectar');
    } finally {
      setDisconnecting(false);
    }
  };

  const webhookUrl = `${API_BASE}/api/webhooks/facebook`;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
              f
            </div>
            <div>
              <CardTitle className="text-base">{account.pageName}</CardTitle>
              <p className="text-xs text-muted-foreground">ID: {account.pageId}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-600">
              <CheckCircle2 className="size-3" /> Activo
            </span>
            {account.lastSyncedAt && (
              <span className="text-xs text-muted-foreground">
                Última sincronización: {new Date(account.lastSyncedAt).toLocaleString('es-PE')}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleSyncLeads} disabled={syncingLeads}>
            {syncingLeads ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
            Sincronizar Leads
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleSyncForms} disabled={syncingForms}>
            {syncingForms ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
            Sinc. Formularios
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={onEdit} title="Editar token">
            <Pencil className="size-3" />
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-red-600" onClick={handleDisconnect} disabled={disconnecting}>
            {disconnecting ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ExternalLink className="size-3" />
              Webhook URL
            </div>
            <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success('URL copiada'); }}>
              <Copy className="size-3" /> Copiar
            </Button>
          </div>
          <p className="mt-1 break-all font-mono text-xs">{webhookUrl}</p>
        </div>

        {account.forms.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 py-8">
            <p className="text-sm text-muted-foreground">No hay formularios. Sincroniza para obtenerlos.</p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Formulario</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Estado</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Leads</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Último lead</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Acción</th>
                </tr>
              </thead>
              <tbody>
                {account.forms.map((f) => (
                  <tr key={f.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{f.name}</td>
                    <td className="px-3 py-2">
                      <Badge className={f.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}>
                        {f.status === 'active' ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{f.leadsCount}</td>
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                      {f.lastLeadAt ? new Date(f.lastLeadAt).toLocaleDateString('es-PE') : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={async () => {
                          try {
                            const r = await syncFacebookLeads(account.id, f.id);
                            toast.success(`${r.imported} leads importados de "${f.name}"`);
                            onUpdate();
                            navigate(`/marketing/leads?formId=${f.id}`);
                          } catch {
                            toast.error('Error al sincronizar');
                          }
                        }}
                      >
                        <RefreshCw className="size-3" /> Sinc.
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ConnectDialog({ open, onOpenChange, onConnected, initialValues }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConnected: () => void;
  initialValues?: { pageId: string; pageName: string };
}) {
  const [pageId, setPageId] = useState('');
  const [pageName, setPageName] = useState('');
  const [pageAccessToken, setPageAccessToken] = useState('');
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (open) {
      if (initialValues) {
        setPageId(initialValues.pageId);
        setPageName(initialValues.pageName);
        setPageAccessToken('');
      } else {
        setPageId(localStorage.getItem(STORAGE_KEY_ID) || '');
        setPageName(localStorage.getItem(STORAGE_KEY_NAME) || '');
        setPageAccessToken('');
      }
    }
  }, [open, initialValues]);

  const handleConnect = async () => {
    if (!pageId.trim() || !pageName.trim() || !pageAccessToken.trim()) {
      toast.error('Completa todos los campos');
      return;
    }
    setConnecting(true);
    try {
      const dto: ConnectAccountDto = { pageId: pageId.trim(), pageName: pageName.trim(), pageAccessToken: pageAccessToken.trim() };
      await connectFacebookAccount(dto);
      localStorage.setItem(STORAGE_KEY_ID, pageId.trim());
      localStorage.setItem(STORAGE_KEY_NAME, pageName.trim());
      toast.success('Cuenta de Facebook conectada');
      onOpenChange(false);
      onConnected();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al conectar');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initialValues ? 'Actualizar token' : 'Conectar página de Facebook'}</DialogTitle>
          <DialogDescription>
            {initialValues
              ? 'Actualiza el Page Access Token. El Page ID y nombre ya están guardados.'
              : 'Ingresa los datos de tu página de Facebook. El Page ID y nombre se guardarán para la próxima vez.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border bg-blue-50 p-3 text-xs text-blue-700">
            <p className="font-medium mb-1">¿Cómo obtener el token?</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Ve a <a href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noopener noreferrer" className="underline">Graph API Explorer</a></li>
              <li>Selecciona tu App y la página, genera el token con permisos <code className="bg-blue-100 px-1 rounded">leads_retrieval</code></li>
              <li>Copia el Page ID y el Token generado</li>
            </ol>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Page ID</label>
            <Input value={pageId} onChange={(e) => setPageId(e.target.value)} placeholder="Ej: 123456789012345" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Nombre de la página</label>
            <Input value={pageName} onChange={(e) => setPageName(e.target.value)} placeholder="Ej: Taxi Monterrico" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Page Access Token</label>
            <Input value={pageAccessToken} onChange={(e) => setPageAccessToken(e.target.value)} type="password" placeholder="EAAxxxx..." />
          </div>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="outline" size="sm">Cancelar</Button>
            </DialogClose>
            <Button size="sm" onClick={handleConnect} disabled={connecting}>
              {connecting && <Loader2 className="mr-1 size-4 animate-spin" />}
              {initialValues ? 'Actualizar token' : 'Conectar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function MarketingIntegrations() {
  const [accounts, setAccounts] = useState<FacebookAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectOpen, setConnectOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<{ pageId: string; pageName: string } | undefined>(undefined);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchFacebookAccounts();
      setAccounts(data);
    } catch {
      // empty
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleOpenConnect = () => {
    setEditAccount(undefined);
    setConnectOpen(true);
  };

  const handleEdit = (account: FacebookAccount) => {
    setEditAccount({ pageId: account.pageId, pageName: account.pageName });
    setConnectOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Integraciones" description="Conecta tus plataformas de anuncios para importar leads automáticamente">
        <Button size="sm" className="gap-1.5" onClick={handleOpenConnect}>
          <Plus className="size-4" /> Conectar Facebook
        </Button>
      </PageHeader>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25 py-24">
          <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <Key className="size-8 text-primary" />
          </div>
          <p className="text-lg font-medium">Conecta tu página de Facebook</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Importa leads de tus formularios de Facebook Lead Ads automáticamente.
          </p>
          <div className="mt-6">
            <Button size="sm" className="gap-1.5" onClick={handleOpenConnect}>
              <Plus className="size-4" /> Conectar Facebook
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {accounts.map((a) => (
            <AccountCard key={a.id} account={a} onUpdate={load} onEdit={() => handleEdit(a)} />
          ))}
        </div>
      )}

      <ConnectDialog
        open={connectOpen}
        onOpenChange={(v) => { setConnectOpen(v); if (!v) setEditAccount(undefined); }}
        onConnected={load}
        initialValues={editAccount}
      />
    </div>
  );
}
