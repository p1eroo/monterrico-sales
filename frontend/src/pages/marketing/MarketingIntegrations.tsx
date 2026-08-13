import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, FileText, Facebook, Key, Loader2, MoreHorizontal, Pencil, Plus, Settings2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FormDialogActions,
  FormDialogField,
  FormDialogGrid,
  FormDialogShell,
  formDialogBtnOutlineClass,
  formDialogBtnPrimaryClass,
  formDialogInputClass,
} from '@/components/ui/form-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { API_BASE } from '@/lib/api';
import {
  fetchFacebookAccounts, connectFacebookAccount, disconnectFacebookAccount,
  type FacebookAccount, type ConnectAccountDto,
} from '@/lib/marketingApi';

const STORAGE_KEY_ID = 'fb_page_id';
const STORAGE_KEY_NAME = 'fb_page_name';

function ConfigDialog({
  account,
  open,
  onOpenChange,
  webhookUrl,
  onEditToken,
  onViewForms,
}: {
  account: FacebookAccount | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  webhookUrl: string;
  onEditToken: () => void;
  onViewForms: () => void;
}) {
  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      maxWidthClassName="sm:max-w-lg"
      title={account ? `Configuración: ${account.pageName}` : 'Configuración'}
      description="Datos de la página y URL del webhook para Meta."
      footer={(
        <div className="flex flex-row justify-end gap-3">
          <Button type="button" variant="outline" className={cn('min-w-[7.5rem]', formDialogBtnOutlineClass)} onClick={onEditToken}>
            Actualizar token
          </Button>
          <Button type="button" className={cn('min-w-[7.5rem]', formDialogBtnPrimaryClass)} onClick={onViewForms}>
            Ver formularios
          </Button>
        </div>
      )}
    >
      {account ? (
        <FormDialogGrid>
          <FormDialogField label="Página">
            <Input readOnly value={account.pageName} className={formDialogInputClass} />
          </FormDialogField>
          <FormDialogField label="Page ID">
            <Input readOnly value={account.pageId} className={cn(formDialogInputClass, 'font-mono')} />
          </FormDialogField>
          <FormDialogField label="Estado">
            <div className={cn(formDialogInputClass, 'flex items-center')}>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Activo
              </span>
            </div>
          </FormDialogField>
          <FormDialogField label="Formularios">
            <Input readOnly value={String(account.forms.length)} className={formDialogInputClass} />
          </FormDialogField>
          <FormDialogField
            label="URL de devolución de llamada"
            hint="Pégala en Meta → Webhooks (objeto Page) junto al token de verificación del .env."
            compactControl={false}
          >
            <div className="flex gap-2">
              <Input readOnly value={webhookUrl} className={cn(formDialogInputClass, 'font-mono text-xs')} />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 shrink-0 rounded-lg"
                title="Copiar webhook"
                onClick={() => { void navigator.clipboard.writeText(webhookUrl); toast.success('URL copiada'); }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </FormDialogField>
        </FormDialogGrid>
      ) : null}
    </FormDialogShell>
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
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      maxWidthClassName="sm:max-w-lg"
      title={initialValues ? 'Actualizar token' : 'Conectar Facebook'}
      description={
        initialValues
          ? 'Actualiza el Page Access Token. El Page ID y nombre ya están guardados.'
          : 'Ingresa los datos de tu página. El Page ID y nombre se guardarán para la próxima vez.'
      }
      footer={(
        <FormDialogActions
          submitLabel={connecting ? (initialValues ? 'Actualizando…' : 'Conectando…') : (initialValues ? 'Actualizar' : 'Conectar')}
          submitting={connecting}
          onSubmit={() => void handleConnect()}
        />
      )}
    >
      <FormDialogGrid>
        <FormDialogField
          label="Page ID"
          required
          hint={
            <>
              Token desde{' '}
              <a href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                Graph API Explorer
              </a>
              {' '}con permiso <code className="rounded bg-muted px-1">leads_retrieval</code>.
            </>
          }
        >
          <Input id="fb-page-id" value={pageId} onChange={(e) => setPageId(e.target.value)} placeholder="Ej: 123456789012345" className={formDialogInputClass} />
        </FormDialogField>
        <FormDialogField label="Nombre de la página" required>
          <Input id="fb-page-name" value={pageName} onChange={(e) => setPageName(e.target.value)} placeholder="Ej: Taxi Monterrico" className={formDialogInputClass} />
        </FormDialogField>
        <FormDialogField label="Page Access Token" required>
          <Input id="fb-page-token" value={pageAccessToken} onChange={(e) => setPageAccessToken(e.target.value)} type="password" placeholder="EAAxxxx..." className={formDialogInputClass} />
        </FormDialogField>
      </FormDialogGrid>
    </FormDialogShell>
  );
}

export default function MarketingIntegrations() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<FacebookAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<{ pageId: string; pageName: string } | undefined>(undefined);
  const [configAccount, setConfigAccount] = useState<FacebookAccount | null>(null);

  const webhookUrl = `${API_BASE}/api/webhooks/facebook`;

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

  useEffect(() => { void load(); }, []);

  const handleDisconnect = async (account: FacebookAccount) => {
    if (!window.confirm(`¿Desconectar "${account.pageName}"? Dejarán de entrar leads de esta página.`)) return;
    setBusyId(account.id);
    try {
      await disconnectFacebookAccount(account.id);
      localStorage.removeItem(STORAGE_KEY_ID);
      localStorage.removeItem(STORAGE_KEY_NAME);
      toast.success('Cuenta desconectada');
      await load();
    } catch {
      toast.error('Error al desconectar');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
            <Facebook className="size-4 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Integraciones</h2>
            <p className="text-sm text-muted-foreground">
              Páginas de Facebook conectadas para importar leads de formularios.
            </p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5 shrink-0" onClick={() => { setEditAccount(undefined); setConnectOpen(true); }}>
          <Plus className="size-4" />
          Conectar Facebook
        </Button>
      </div>

      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center rounded-xl border bg-card">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Página</th>
                <th className="px-4 py-3 text-left font-medium">Page ID</th>
                <th className="px-4 py-3 text-left font-medium">Estado</th>
                <th className="px-4 py-3 text-left font-medium">Formularios</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                        <Key className="size-5 text-primary" />
                      </div>
                      <p>No hay páginas conectadas. Usá &quot;Conectar Facebook&quot; para vincular una.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                accounts.map((account) => {
                  const busy = busyId === account.id;
                  return (
                    <tr key={account.id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">{account.pageName}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{account.pageId}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                          <span className="size-1.5 rounded-full bg-emerald-500" />
                          Activo
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">{account.forms.length}</td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={busy}>
                              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setConfigAccount(account)}>
                              <Settings2 className="mr-2 h-4 w-4" />
                              Configuración
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate('/marketing/facebook')}>
                              <FileText className="mr-2 h-4 w-4" />
                              Ver formularios
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setEditAccount({ pageId: account.pageId, pageName: account.pageName }); setConnectOpen(true); }}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Actualizar token
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => void handleDisconnect(account)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Desconectar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <ConfigDialog
        account={configAccount}
        open={Boolean(configAccount)}
        onOpenChange={(open) => { if (!open) setConfigAccount(null); }}
        webhookUrl={webhookUrl}
        onEditToken={() => {
          if (!configAccount) return;
          setEditAccount({ pageId: configAccount.pageId, pageName: configAccount.pageName });
          setConfigAccount(null);
          setConnectOpen(true);
        }}
        onViewForms={() => {
          setConfigAccount(null);
          navigate('/marketing/facebook');
        }}
      />
      <ConnectDialog
        open={connectOpen}
        onOpenChange={(v) => { setConnectOpen(v); if (!v) setEditAccount(undefined); }}
        onConnected={() => void load()}
        initialValues={editAccount}
      />
    </div>
  );
}
