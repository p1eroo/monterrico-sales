import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Key,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { WhatsAppSvgIcon } from '@/components/icons/WhatsAppSvgIcon';
import { PencilFileSvgIcon } from '@/components/icons/PencilFileSvgIcon';
import { SettingsSvgIcon } from '@/components/icons/SettingsSvgIcon';
import { TrashSvgIcon } from '@/components/icons/TrashSvgIcon';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/lib/notify';
import { cn } from '@/lib/utils';
import {
  connectWhatsAppCloud,
  disconnectWhatsAppCloud,
  fetchWhatsAppCloudAccounts,
  formatRelativeSync,
  setDefaultWhatsAppCloudAccount,
  setWhatsAppActiveChannelId,
  syncWhatsAppCloudTemplates,
  testWhatsAppCloudAccount,
  updateWhatsAppCloudToken,
  type WhatsAppCloudAccount,
} from '@/lib/marketingApi';

function StatusBadge({ account }: { account: WhatsAppCloudAccount }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        Activo
      </span>
      {account.isDefault ? (
        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          Por defecto
        </span>
      ) : null}
    </div>
  );
}

function WhatsappConfigDialog({
  account,
  open,
  onOpenChange,
  onEditToken,
  onGoToWhatsapp,
}: {
  account: WhatsAppCloudAccount | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEditToken: () => void;
  onGoToWhatsapp: () => void;
}) {
  if (!account) return null;

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      maxWidthClassName="sm:max-w-xl"
      title={`Configuración: ${account.displayName}`}
      description="Credenciales de Meta Cloud API para plantillas y envío masivo."
      footer={(
        <div className="flex flex-row justify-end gap-3">
          <Button type="button" variant="outline" className={cn('min-w-[7.5rem]', formDialogBtnOutlineClass)} onClick={onEditToken}>
            Actualizar token
          </Button>
          <Button type="button" className={cn('min-w-[7.5rem]', formDialogBtnPrimaryClass)} onClick={onGoToWhatsapp}>
            Ir a WhatsApp Masivo
          </Button>
        </div>
      )}
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-900 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <p>
            El inbox conversacional sigue en Chatwoot. Aquí solo se configuran credenciales para sincronizar plantillas y envíos masivos; no registres webhook ni coexistencia.
          </p>
        </div>
        <FormDialogGrid className="gap-y-5 sm:grid-cols-2 sm:gap-x-5">
          <FormDialogField label="Nombre interno" className="sm:col-span-2">
            <Input readOnly value={account.displayName} className={formDialogInputClass} />
          </FormDialogField>
          <FormDialogField label="Número">
            <Input readOnly value={account.displayPhoneNumber ?? '—'} className={formDialogInputClass} />
          </FormDialogField>
          <FormDialogField label="Nombre verificado (Meta)">
            <Input readOnly value={account.verifiedName ?? account.displayName} className={formDialogInputClass} />
          </FormDialogField>
          <FormDialogField label="WABA ID">
            <Input readOnly value={account.wabaId} className={cn(formDialogInputClass, 'font-mono text-xs')} />
          </FormDialogField>
          <FormDialogField label="Phone Number ID">
            <Input readOnly value={account.phoneNumberId} className={cn(formDialogInputClass, 'font-mono text-xs')} />
          </FormDialogField>
          <FormDialogField label="Versión Graph">
            <Input readOnly value={account.graphApiVersion} className={formDialogInputClass} />
          </FormDialogField>
          <FormDialogField label="Plantillas" className="sm:col-span-2">
            <Input
              readOnly
              value={`${account.approvedCount} aprobadas · ${account.marketingCount} marketing · ${account.utilityCount} utility`}
              className={formDialogInputClass}
            />
          </FormDialogField>
          <FormDialogField label="Última sincronización">
            <Input readOnly value={formatRelativeSync(account.lastSyncedAt)} className={formDialogInputClass} />
          </FormDialogField>
          <FormDialogField label="Canal predeterminado">
            <div className={cn(formDialogInputClass, 'flex items-center')}>
              {account.isDefault ? (
                <span className="text-sm font-medium text-primary">Sí — usado en WhatsApp Masivo</span>
              ) : (
                <span className="text-sm text-muted-foreground">No</span>
              )}
            </div>
          </FormDialogField>
        </FormDialogGrid>
      </div>
    </FormDialogShell>
  );
}

function WhatsappConnectDialog({
  open,
  onOpenChange,
  onConnected,
  editAccount,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConnected: () => void;
  editAccount?: WhatsAppCloudAccount | null;
}) {
  const isEdit = Boolean(editAccount);
  const [displayName, setDisplayName] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [graphApiVersion, setGraphApiVersion] = useState('v22.0');
  const [setAsDefault, setSetAsDefault] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editAccount) {
      setDisplayName(editAccount.displayName);
      setWabaId(editAccount.wabaId);
      setPhoneNumberId(editAccount.phoneNumberId);
      setGraphApiVersion(editAccount.graphApiVersion);
      setSetAsDefault(editAccount.isDefault);
      setAccessToken('');
    } else {
      setDisplayName('');
      setWabaId('');
      setPhoneNumberId('');
      setGraphApiVersion('v22.0');
      setSetAsDefault(true);
      setAccessToken('');
    }
  }, [open, editAccount]);

  const handleSubmit = async () => {
    if (isEdit) {
      if (!accessToken.trim()) {
        toast.error('Ingresa el nuevo token');
        return;
      }
      setSubmitting(true);
      try {
        await updateWhatsAppCloudToken(editAccount!.id, accessToken.trim());
        toast.success('Token actualizado');
        onOpenChange(false);
        onConnected();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al actualizar');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!displayName.trim() || !wabaId.trim() || !phoneNumberId.trim() || !accessToken.trim()) {
      toast.error('Completa todos los campos obligatorios');
      return;
    }
    setSubmitting(true);
    try {
      const result = await connectWhatsAppCloud({
        displayName: displayName.trim(),
        wabaId: wabaId.trim(),
        phoneNumberId: phoneNumberId.trim(),
        accessToken: accessToken.trim(),
        graphApiVersion: graphApiVersion.trim() || 'v22.0',
        setAsDefault,
      });
      if (result.isDefault) {
        setWhatsAppActiveChannelId(result.id);
      }
      toast.success(`Conexión OK · ${result.templateCount} plantilla(s) encontrada(s)`);
      onOpenChange(false);
      onConnected();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al conectar');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      maxWidthClassName="sm:max-w-xl"
      title={isEdit ? 'Actualizar token' : 'Conectar número WhatsApp'}
      description={
        isEdit ? (
          'Actualiza el token de acceso. Los IDs de la cuenta se mantienen.'
        ) : (
          <>
            Credenciales de Meta Cloud API. Usa el token del System User o el que ya tengas en Chatwoot.
            <span className="mt-2 block text-xs leading-relaxed text-muted-foreground">
              El token necesita permisos{' '}
              <code className="rounded bg-muted px-1">whatsapp_business_management</code>
              {' '}y{' '}
              <code className="rounded bg-muted px-1">whatsapp_business_messaging</code>.
            </span>
          </>
        )
      }
      footer={(
        <FormDialogActions
          submitLabel={
            submitting
              ? isEdit
                ? 'Actualizando…'
                : 'Probando…'
              : isEdit
                ? 'Actualizar'
                : 'Probar y guardar'
          }
          submitting={submitting}
          onSubmit={() => void handleSubmit()}
        />
      )}
    >
      <FormDialogGrid className="gap-y-5 sm:grid-cols-2 sm:gap-x-5 sm:items-start">
        {!isEdit ? (
          <>
            <FormDialogField
              label="Nombre interno"
              required
              className="min-w-0 sm:col-span-2"
              hint="Etiqueta visible en el CRM."
            >
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ej: Taxi Monterrico Clientes"
                className={formDialogInputClass}
              />
            </FormDialogField>
            <FormDialogField
              label="WABA ID"
              required
              className="min-w-0"
              hint="Business Manager → Cuentas de WhatsApp."
            >
              <Input
                value={wabaId}
                onChange={(e) => setWabaId(e.target.value)}
                placeholder="1552822609132164"
                className={cn(formDialogInputClass, 'font-mono text-xs')}
              />
            </FormDialogField>
            <FormDialogField
              label="Phone Number ID"
              required
              className="min-w-0"
              hint="ID en Graph (no es el +51)."
            >
              <Input
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                placeholder="1270855672775899"
                className={cn(formDialogInputClass, 'font-mono text-xs')}
              />
            </FormDialogField>
          </>
        ) : (
          <>
            <FormDialogField label="Cuenta" className="min-w-0 sm:col-span-2">
              <Input readOnly value={editAccount?.displayName ?? ''} className={formDialogInputClass} />
            </FormDialogField>
            <FormDialogField label="WABA ID" className="min-w-0">
              <Input readOnly value={editAccount?.wabaId ?? ''} className={cn(formDialogInputClass, 'font-mono text-xs')} />
            </FormDialogField>
            <FormDialogField label="Phone Number ID" className="min-w-0">
              <Input
                readOnly
                value={editAccount?.phoneNumberId ?? ''}
                className={cn(formDialogInputClass, 'font-mono text-xs')}
              />
            </FormDialogField>
          </>
        )}
        <FormDialogField label="Token de acceso" required className="min-w-0 sm:col-span-2">
          <Input
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="EAAxxxx…"
            className={formDialogInputClass}
          />
        </FormDialogField>
        {!isEdit ? (
          <FormDialogField label="Versión Graph" className="min-w-0">
            <Input
              value={graphApiVersion}
              onChange={(e) => setGraphApiVersion(e.target.value)}
              placeholder="v22.0"
              className={formDialogInputClass}
            />
          </FormDialogField>
        ) : null}
        {!isEdit ? (
          <div className="flex items-start gap-2.5 pt-1 sm:col-span-2">
            <Checkbox
              id="wa-set-default"
              checked={setAsDefault}
              onCheckedChange={(v) => setSetAsDefault(v === true)}
              className="mt-0.5"
            />
            <Label htmlFor="wa-set-default" className="cursor-pointer text-sm font-normal leading-snug">
              Usar como canal predeterminado en WhatsApp Masivo
            </Label>
          </div>
        ) : null}
      </FormDialogGrid>
    </FormDialogShell>
  );
}

export function WhatsappCloudIntegrationsSection() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<WhatsAppCloudAccount[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<WhatsAppCloudAccount | null>(null);
  const [configAccount, setConfigAccount] = useState<WhatsAppCloudAccount | null>(null);

  const reload = useCallback(() => {
    void fetchWhatsAppCloudAccounts()
      .then(setAccounts)
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Error al cargar cuentas');
      });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleTest = async (account: WhatsAppCloudAccount) => {
    setBusyId(account.id);
    try {
      const result = await testWhatsAppCloudAccount(account.id);
      toast.success(`Conexión OK · ${result.templateCount} plantilla(s) en la WABA`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al probar');
    } finally {
      setBusyId(null);
    }
  };

  const handleSync = async (account: WhatsAppCloudAccount) => {
    setBusyId(account.id);
    try {
      await syncWhatsAppCloudTemplates(account.id);
      reload();
      toast.success('Plantillas sincronizadas con Meta');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al sincronizar');
    } finally {
      setBusyId(null);
    }
  };

  const handleSetDefault = (account: WhatsAppCloudAccount) => {
    void setDefaultWhatsAppCloudAccount(account.id)
      .then((next) => {
        setAccounts(next);
        toast.success(`"${account.displayName}" es ahora el canal predeterminado`);
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Error al actualizar');
      });
  };

  const handleDisconnect = (account: WhatsAppCloudAccount) => {
    if (!window.confirm(`¿Desconectar "${account.displayName}"? WhatsApp Masivo dejará de usar este número.`)) return;
    setBusyId(account.id);
    void disconnectWhatsAppCloud(account.id)
      .then(() => {
        reload();
        toast.success('Número desconectado');
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Error al desconectar');
      })
      .finally(() => setBusyId(null));
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-[#25D366]/15">
            <WhatsAppSvgIcon className="size-4 text-[#128C7E] dark:text-[#25D366]" />
          </div>
          <div>
            <h3 className="text-base font-semibold tracking-tight">WhatsApp Business (Meta Cloud API)</h3>
            <p className="text-sm text-muted-foreground">
              Plantillas y envío masivo. Cambia de número sin tocar el backend.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 shrink-0 border-[#25D366]/40 text-[#128C7E] hover:bg-[#25D366]/10 dark:text-[#25D366]"
          onClick={() => {
            setEditAccount(null);
            setConnectOpen(true);
          }}
        >
          <Plus className="size-4" />
          Conectar número
        </Button>
      </div>

      <div className="rounded-xl border overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Nombre</th>
              <th className="hidden px-4 py-3 text-left font-medium md:table-cell">Número</th>
              <th className="hidden px-4 py-3 text-left font-medium lg:table-cell">WABA ID</th>
              <th className="hidden px-4 py-3 text-left font-medium xl:table-cell">Phone Number ID</th>
              <th className="px-4 py-3 text-left font-medium">Plantillas</th>
              <th className="px-4 py-3 text-left font-medium">Estado</th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex size-12 items-center justify-center rounded-full bg-[#25D366]/10">
                      <MessageCircle className="size-5 text-[#128C7E] dark:text-[#25D366]" />
                    </div>
                    <p>No hay números conectados. Usa &quot;Conectar número&quot; para agregar credenciales de Meta.</p>
                  </div>
                </td>
              </tr>
            ) : (
              accounts.map((account) => {
                const busy = busyId === account.id;
                return (
                  <tr key={account.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <p className="font-medium">{account.displayName}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground md:hidden">{account.displayPhoneNumber}</p>
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{account.displayPhoneNumber ?? '—'}</td>
                    <td className="hidden px-4 py-3 font-mono text-xs text-muted-foreground lg:table-cell">{account.wabaId}</td>
                    <td className="hidden px-4 py-3 font-mono text-xs text-muted-foreground xl:table-cell">{account.phoneNumberId}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      <span className="font-medium text-foreground">{account.approvedCount}</span>
                      <span className="text-xs"> aprobadas</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge account={account} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={busy}>
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setConfigAccount(account)}>
                            <SettingsSvgIcon />
                            Configuración
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void handleTest(account)}>
                            <Zap />
                            Probar conexión
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void handleSync(account)}>
                            <RefreshCw />
                            Sincronizar plantillas
                          </DropdownMenuItem>
                          {!account.isDefault ? (
                            <DropdownMenuItem onClick={() => handleSetDefault(account)}>
                              <Key />
                              Marcar como predeterminado
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem onClick={() => navigate('/marketing/whatsapp')}>
                            <MessageCircle />
                            Ir a WhatsApp Masivo
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setEditAccount(account);
                              setConnectOpen(true);
                            }}
                          >
                            <PencilFileSvgIcon />
                            Actualizar token
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => handleDisconnect(account)}>
                            <TrashSvgIcon />
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

      <p className="text-xs text-muted-foreground">
        Las credenciales se guardan en el servidor. El inbox conversacional sigue en Chatwoot.
      </p>

      <WhatsappConfigDialog
        account={configAccount}
        open={Boolean(configAccount)}
        onOpenChange={(open) => {
          if (!open) setConfigAccount(null);
        }}
        onEditToken={() => {
          if (!configAccount) return;
          setEditAccount(configAccount);
          setConfigAccount(null);
          setConnectOpen(true);
        }}
        onGoToWhatsapp={() => {
          setConfigAccount(null);
          navigate('/marketing/whatsapp');
        }}
      />
      <WhatsappConnectDialog
        open={connectOpen}
        onOpenChange={(open) => {
          setConnectOpen(open);
          if (!open) setEditAccount(null);
        }}
        onConnected={reload}
        editAccount={editAccount}
      />
    </section>
  );
}
