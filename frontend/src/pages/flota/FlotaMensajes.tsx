import { useState, useRef, useEffect } from 'react';
import {
  Inbox,
  Send,
  Search,
  Phone,
  Video,
  MoreVertical,
  Paperclip,
  Smile,
  CheckCheck,
  ArrowLeft,
  ArrowRight,
  Users,
  MessageSquare,
  CheckCircle2,
  FileSpreadsheet,
  Database,
  Save,
  Plus,
  Loader2,
  QrCode,
  Unplug,
  RefreshCw,
  Smartphone,
  Play,
  SendHorizonal,
  Radio,
  Upload,
  StopCircle,
  Download,
  Edit2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  fetchSharedConnection,
  connectSharedWhatsapp,
  disconnectSharedWhatsapp,
  sendSharedTestMessage,
  fetchConversations,
  importExcelPreview,
  type FlotaConversation,
  type FlotaExcelContact,
  type FlotaWhatsappConnectionResponse,
  type FlotaWhatsappConnection,
} from '@/lib/flotaWhatsappApi';
import { fetchWhatsappMessages, sendWhatsappMessage, type WhatsappMessageItem } from '@/lib/whatsappApi';
import * as QRCode from 'qrcode';
import * as XLSX from 'xlsx';

/* ==================== TIPOS ==================== */

const tagStyles: Record<string, string> = {
  CITADO: 'bg-primary/10 text-primary border-primary/20',
  AFILIADO: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  SEGUIMIENTO: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  INFORMACION: 'bg-sky-500/10 text-sky-700 border-sky-500/20',
  'SIN REQUISITOS': 'bg-rose-500/10 text-rose-700 border-rose-500/20',
};

const templates = [
  { id: 't1', label: 'Bienvenida', text: 'Hola {{nombre}} 👋 Bienvenido a Taxi Monterrico. Estamos felices de tenerte con nosotros.' },
  { id: 't2', label: 'Recordatorio de cita', text: 'Hola {{nombre}}, te recordamos tu cita programada. Te esperamos en nuestra oficina.' },
  { id: 't3', label: 'Seguimiento', text: 'Hola {{nombre}}, queríamos saber si tienes alguna duda sobre {{empresa}}. Estamos para ayudarte.' },
  { id: 't4', label: 'Afiliación completada', text: '¡Felicidades {{nombre}}! Tu afiliación se completó correctamente. Bienvenido a la flota.' },
];

/* ==================== MAIN ==================== */

export default function FlotaMensajes() {
  const [tab, setTab] = useState<'inbox' | 'masivo'>('inbox');
  const [connection, setConnection] = useState<FlotaWhatsappConnectionResponse | null>(null);
  const [evoModalOpen, setEvoModalOpen] = useState(false);
  const [loadingConn, setLoadingConn] = useState(true);

  const instance = connection?.instance ?? null;
  const isConnected = instance?.isConnected ?? false;

  async function loadConnection(silent = false) {
    if (!silent) setLoadingConn(true);
    try {
      const next = await fetchSharedConnection();
      setConnection(next);
    } catch {
      if (!silent) toast.error('No se pudo cargar el estado de la conexión');
    } finally {
      if (!silent) setLoadingConn(false);
    }
  }

  useEffect(() => { void loadConnection(); }, []);

  useEffect(() => {
    if (!instance || instance.isConnected) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void loadConnection(true);
    }, 5000);
    return () => window.clearInterval(id);
  }, [instance?.isConnected, instance?.qrCode, instance?.qrText]);

  useEffect(() => {
    if (instance?.isConnected) setEvoModalOpen(false);
  }, [instance?.isConnected]);

  return (
    <div className="space-y-6">
      <PageHeader title="Mensajes" description="Chat WhatsApp · Evolution GO">
        <div className="inline-flex items-center gap-2">
          <div className="inline-flex rounded-lg border bg-card p-1 shadow-sm">
            <button
              onClick={() => setTab('inbox')}
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                tab === 'inbox' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Inbox className="h-4 w-4" /> Inbox
            </button>
            <button
              onClick={() => setTab('masivo')}
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                tab === 'masivo' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Send className="h-4 w-4" /> Masivo
            </button>
          </div>
          <button
            onClick={() => setEvoModalOpen(true)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
              isConnected
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20'
                : 'border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20',
            )}
          >
            {loadingConn ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Radio className={cn('h-3.5 w-3.5', isConnected ? 'fill-emerald-500 text-emerald-500' : 'fill-destructive text-destructive')} />
            )}
            EvoGO
          </button>
        </div>
      </PageHeader>

      <EvoGoModal
        open={evoModalOpen}
        onOpenChange={setEvoModalOpen}
        connection={connection}
        loading={loadingConn}
        onRefresh={() => loadConnection(false)}
        onConnect={async () => {
          try {
            const next = await connectSharedWhatsapp();
            setConnection(next);
            if (!next.instance?.isConnected) {
              toast.success('QR generado. Escanea con WhatsApp para conectar.');
            } else {
              toast.success('WhatsApp ya está conectado');
            }
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'No se pudo conectar');
          }
        }}
        onDisconnect={async () => {
          try {
            const next = await disconnectSharedWhatsapp();
            setConnection(next);
            toast.success('WhatsApp desconectado');
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'No se pudo desconectar');
          }
        }}
      />

      {tab === 'inbox' ? (
        loadingConn ? <LoadingState /> :
        isConnected ? <InboxView /> : <ConnectPrompt onClick={() => setEvoModalOpen(true)} />
      ) : loadingConn ? (
        <LoadingState />
      ) : (
        <MasivoView isConnected={isConnected} onConnectClick={() => setEvoModalOpen(true)} />
      )}
    </div>
  );
}

/* ==================== EVOGO MODAL ==================== */

function EvoGoModal({
  open,
  onOpenChange,
  connection,
  loading,
  onRefresh,
  onConnect,
  onDisconnect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  connection: FlotaWhatsappConnectionResponse | null;
  loading: boolean;
  onRefresh: () => void;
  onConnect: () => Promise<void>;
  onDisconnect: () => Promise<void>;
}) {
  const instance = connection?.instance ?? null;
  const canManage = connection?.canManage ?? false;
  const isConnected = instance?.isConnected ?? false;
  const [busy, setBusy] = useState<string | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testNumber, setTestNumber] = useState('');
  const [testMessage, setTestMessage] = useState('Hola, este es un mensaje de prueba desde el CRM.');

  useEffect(() => {
    const raw = instance?.qrText?.trim();
    if (!raw) {
      setQrPreview(instance?.qrCode?.startsWith('data:image/') ? instance.qrCode : null);
      return;
    }
    QRCode.toDataURL(raw, { margin: 1, width: 260 })
      .then((dataUrl: string) => setQrPreview(dataUrl))
      .catch(() => setQrPreview(null));
  }, [instance?.qrCode, instance?.qrText]);

  async function handleConnect() {
    setBusy('connect');
    await onConnect();
    setBusy(null);
  }

  async function handleDisconnect() {
    setBusy('disconnect');
    await onDisconnect();
    setBusy(null);
  }

  async function handleTest() {
    const number = testNumber.trim();
    const text = testMessage.trim();
    if (!number || !text) {
      toast.error('Ingresa el número y el mensaje de prueba');
      return;
    }
    setBusy('test');
    try {
      await sendSharedTestMessage({ number, text });
      setTestModalOpen(false);
      toast.success('Mensaje de prueba enviado');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al enviar');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pr-8">
            <DialogTitle className="flex items-center gap-2">
              <Radio className={cn('h-5 w-5', isConnected ? 'fill-emerald-500 text-emerald-500' : 'fill-destructive text-destructive')} />
              Evolution GO — Flota
            </DialogTitle>
            <DialogDescription>
              {isConnected
                ? `WhatsApp compartido conectado: ${instance?.instanceName || 'Flota'}`
                : 'Escanea el QR para conectar el WhatsApp compartido de Flota'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {loading ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
                Cargando conexión...
              </div>
            ) : isConnected ? (
              <div className="flex min-h-[160px] flex-col items-center justify-center gap-4 text-center">
                <CheckCircle2 className="h-16 w-16 text-[#13944C]" />
                <p className="font-medium text-[#13944C]">Conectado</p>
              </div>
            ) : (
              <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border bg-muted/20 p-4 text-center">
                {qrPreview ? (
                  <>
                    <img
                      src={qrPreview}
                      alt="QR de WhatsApp Flota"
                      className="w-full max-w-[260px] rounded-lg bg-white p-3"
                    />
                    {instance?.qrGeneratedAt && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Generado: {new Date(instance.qrGeneratedAt).toLocaleString('es-PE')}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <Smartphone className="h-10 w-10 text-muted-foreground" />
                    <p className="font-medium">Genera el QR para conectar</p>
                    <p className="text-sm text-muted-foreground">Presiona "Conectar" para generar el código QR</p>
                  </div>
                )}
              </div>
            )}

            {!isConnected && qrPreview && (
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="text-sm font-medium">Cómo conectarlo</p>
                <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm text-muted-foreground">
                  <li>Abre WhatsApp en tu celular.</li>
                  <li>Entra a dispositivos vinculados.</li>
                  <li>Selecciona conectar un dispositivo.</li>
                  <li>Escanea el código QR de arriba.</li>
                  <li>Cuando se conecte, el modal se cerrará automáticamente.</li>
                </ol>
              </div>
            )}

            {instance?.lastError && (
              <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {instance.lastError}
              </p>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              {isConnected ? (
                <Button variant="outline" onClick={handleDisconnect} disabled={busy !== null}>
                  {busy === 'disconnect' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
                  Desconectar
                </Button>
              ) : (
                <Button
                  className="bg-[#13944C] hover:bg-[#0f7a3d]"
                  onClick={handleConnect}
                  disabled={!canManage || busy !== null}
                >
                  {busy === 'connect' ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                  {instance ? 'Regenerar QR' : 'Conectar WhatsApp'}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setTestModalOpen(true)}
                disabled={!isConnected || busy !== null}
              >
                <Play className="h-4 w-4" /> Test
              </Button>
            </div>

            {!isConnected && qrPreview && (
              <Button variant="outline" className="w-full" onClick={handleConnect} disabled={busy !== null}>
                <RefreshCw className="h-4 w-4" /> Actualizar QR
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={testModalOpen} onOpenChange={setTestModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="pr-8">
            <DialogTitle>Enviar mensaje de prueba</DialogTitle>
            <DialogDescription>Instancia: {instance?.instanceName || 'Flota'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">Número de WhatsApp</p>
              <Input
                value={testNumber}
                onChange={(e) => setTestNumber(e.target.value)}
                placeholder="51987654321"
                disabled={busy !== null}
              />
              <p className="mt-2 text-xs text-muted-foreground">Con código de país, sin `+` ni espacios.</p>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Mensaje</p>
              <Textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Hola, este es un mensaje de prueba..."
                rows={4}
                disabled={busy !== null}
              />
            </div>
            <Button
              className="w-full bg-[#13944C] hover:bg-[#0f7a3d]"
              onClick={handleTest}
              disabled={busy !== null}
            >
              {busy === 'test' ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
              Enviar mensaje
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ==================== CONNECT PROMPT ==================== */

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Cargando conexión...</p>
    </div>
  );
}

function ConnectPrompt({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-24 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <Unplug className="h-10 w-10 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">WhatsApp no conectado</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Conecta el WhatsApp compartido de Flota para ver y responder mensajes desde el CRM.
        </p>
      </div>
      <Button onClick={onClick} className="bg-[#13944C] hover:bg-[#0f7a3d]">
        <QrCode className="mr-2 h-4 w-4" />
        Conectar vía EvoGO
      </Button>
    </div>
  );
}

/* ==================== INBOX ==================== */

function InboxView() {
  const [conversations, setConversations] = useState<FlotaConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadConversations();
  }, []);

  async function loadConversations() {
    setLoading(true);
    try {
      const data = await fetchConversations();
      setConversations(data);
      if (data.length > 0 && !activeId) setActiveId(data[0].id);
    } catch {
      toast.error('No se pudieron cargar las conversaciones');
    } finally {
      setLoading(false);
    }
  }

  const filtered = conversations.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase()) || c.phone.includes(query),
  );

  return (
    <div className="grid h-[calc(100vh-11rem)] grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
      <aside className="flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar conversación..."
              className="pl-9"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              {query ? 'Sin resultados' : 'No hay conversaciones aún'}
            </div>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={cn(
                  'flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-muted/60',
                  activeId === c.id && 'bg-primary/5',
                )}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                  {c.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-semibold text-foreground">{c.name}</p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(c.time).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{c.preview}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">{c.phone}</span>
                    {c.unread > 0 && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                        {c.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {activeId ? (
        <ChatPanel contactId={activeId} conversations={conversations} onContactUpdated={loadConversations} />
      ) : (
        <div className="flex items-center justify-center rounded-lg border border-border bg-card text-sm text-muted-foreground shadow-sm">
          Selecciona una conversación
        </div>
      )}
    </div>
  );
}

function ChatPanel({ contactId, conversations, onContactUpdated }: { contactId: string; conversations: FlotaConversation[]; onContactUpdated: () => void }) {
  const [messages, setMessages] = useState<WhatsappMessageItem[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const convo = conversations.find((c) => c.id === contactId);

  useEffect(() => {
    if (editModalOpen) {
      setEditName(convo?.name ?? '');
    }
  }, [editModalOpen, convo?.name]);

  useEffect(() => {
    void loadMessages();
  }, [contactId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function loadMessages() {
    setLoading(true);
    try {
      const items = await fetchWhatsappMessages(contactId);
      setMessages(items);
    } catch {
      toast.error('No se pudieron cargar los mensajes');
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    if (!draft.trim()) return;
    try {
      await sendWhatsappMessage(contactId, draft.trim());
      setDraft('');
      await loadMessages();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo enviar el mensaje');
    }
  }

  async function handleSaveName() {
    if (!editName.trim()) return;
    setSavingName(true);
    try {
      await api(`/contacts/${contactId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editName.trim() }),
      });
      toast.success('Nombre actualizado');
      setEditModalOpen(false);
      onContactUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo actualizar el nombre');
    } finally {
      setSavingName(false);
    }
  }

  return (
    <section className="flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
            {convo?.name.slice(0, 2).toUpperCase() ?? '??'}
          </div>
          <div>
            <p className="font-semibold leading-tight">{convo?.name ?? 'Desconocido'}</p>
            <p className="text-xs text-muted-foreground">{convo?.phone ?? ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon"><Phone className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon"><Video className="h-4 w-4" /></Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditModalOpen(true)}>
                <Edit2 className="mr-2 h-4 w-4" /> Editar contacto
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_1px_1px,theme(colors.muted.foreground/0.08)_1px,transparent_0)] [background-size:18px_18px] px-6 py-5"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No hay mensajes aún
            </div>
          ) : (
            messages.map((m) => {
              const mine = m.direction === 'outbound';
              return (
                <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm',
                      mine
                        ? 'rounded-br-sm bg-primary text-primary-foreground'
                        : 'rounded-bl-sm bg-muted text-foreground',
                    )}
                  >
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    <div className={cn('mt-1 flex items-center justify-end gap-1 text-[10px]', mine ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                      <span>{new Date(m.createdAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</span>
                      {mine && <CheckCheck className={cn('h-3 w-3', m.waOutboundStatus === 'read' ? 'text-sky-300' : '')} />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="border-t bg-background/60 p-3">
        <div className="flex items-end gap-2">
          <Button variant="ghost" size="icon" className="shrink-0"><Paperclip className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon" className="shrink-0"><Smile className="h-5 w-5" /></Button>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Escribe un mensaje..."
            className="min-h-[44px] max-h-32 resize-none"
            rows={1}
          />
          <Button onClick={() => void send()} disabled={!draft.trim()} className="shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Contacto</DialogTitle>
            <DialogDescription>
              Modifica el nombre de este contacto. Se actualizará en el CRM.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input 
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nombre del contacto"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleSaveName();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveName} disabled={savingName || !editName.trim()}>
              {savingName && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* ==================== MASIVO ==================== */

function MasivoView({ isConnected, onConnectClick }: { isConnected: boolean; onConnectClick: () => void }) {
  const [contacts, setContacts] = useState<FlotaConversation[]>([]);
  const [excelContacts, setExcelContacts] = useState<FlotaExcelContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [importingExcel, setImportingExcel] = useState(false);
  const [step, setStep] = useState(1);
  const [campaignName, setCampaignName] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [source, setSource] = useState<'crm' | 'excel'>('crm');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{
    total: number;
    sent: number;
    failed: number;
    currentName: string;
    currentIndex: number;
    nextDelay: number;
  } | null>(null);
  const cancelRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const BULK_DELAYS = [35000, 45000, 55000, 65000];

  useEffect(() => {
    void loadContacts();
  }, []);

  async function loadContacts() {
    setLoadingContacts(true);
    try {
      const data = await fetchConversations();
      setContacts(data);
    } catch {
      toast.error('No se pudieron cargar los contactos');
    } finally {
      setLoadingContacts(false);
    }
  }

  async function handleExcelFile(file: File) {
    setImportingExcel(true);
    try {
      const result = await importExcelPreview(file);
      setExcelContacts(result.items);
      setSelectedIds(new Set());
      toast.success(`${result.total} contactos importados del Excel`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al importar el Excel');
    } finally {
      setImportingExcel(false);
    }
  }

  function downloadTemplate() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([['nombre', 'telefono'], ['Juan Pérez', '51987654321'], ['María García', '51912345678']]);
    XLSX.utils.book_append_sheet(wb, ws, 'Contactos');
    XLSX.writeFile(wb, 'plantilla-whatsapp.xlsx');
  }

  const displayedContacts = source === 'excel' ? excelContacts : contacts;
  const selected = displayedContacts.filter((c) => selectedIds.has(c.phone));
  const previewContact = selected[0] ?? displayedContacts[0];
  const filtered = source === 'excel'
    ? excelContacts.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search))
    : contacts.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  function toggle(phone: string) {
    setSelectedIds((s) => {
      const n = new Set(s);
      if (n.has(phone)) n.delete(phone);
      else n.add(phone);
      return n;
    });
  }

  function preview(text: string) {
    const name = previewContact?.name ?? '';
    const phoneVal = 'phone' in previewContact ? (previewContact as any).phone ?? '' : '';
    return text
      .replaceAll('{{nombre}}', name)
      .replaceAll('{{empresa}}', '')
      .replaceAll('{{celular}}', phoneVal);
  }

  function effectiveContactsToSend(): Array<{ contactId: string | undefined; name: string; phone: string }> {
    if (source === 'crm') {
      return (contacts as FlotaConversation[])
        .filter((c) => selectedIds.has(c.id!))
        .map((c) => ({ contactId: c.id ?? undefined, name: c.name, phone: c.phone }));
    }
    return (excelContacts as FlotaExcelContact[])
      .filter((c) => selectedIds.has(c.phone))
      .map((c) => ({ contactId: c.contactId ?? undefined, name: c.name, phone: c.phone }));
  }

  async function handleSend() {
    if (!isConnected) {
      onConnectClick();
      return;
    }
    const targets = effectiveContactsToSend();
    if (targets.length === 0) {
      toast.error(source === 'excel' ? 'Ningún contacto del Excel tiene coincidencia en el CRM.' : 'Selecciona al menos un contacto.');
      return;
    }

    const personalized = (t: string) =>
      t
        .replaceAll('{{nombre}}', targets[0]?.name ?? '')
        .replaceAll('{{empresa}}', '')
        .replaceAll('{{celular}}', targets[0]?.phone ?? '');

    const textToSend = personalized(message.trim()) || message.trim();

    cancelRef.current = false;
    setSending(true);
    setBulkProgress({ total: targets.length, sent: 0, failed: 0, currentName: '', currentIndex: 0, nextDelay: BULK_DELAYS[0]! });

    const results: Array<{ name: string; phone: string; ok: boolean; error?: string }> = [];

    for (let i = 0; i < targets.length; i++) {
      if (cancelRef.current) break;

      const t = targets[i]!;
      const delayMs = BULK_DELAYS[i % BULK_DELAYS.length]!;
      const personalizedMsg = message.trim()
        .replaceAll('{{nombre}}', t.name)
        .replaceAll('{{empresa}}', '')
        .replaceAll('{{celular}}', t.phone);
      const finalText = personalizedMsg || textToSend;

      setBulkProgress({
        total: targets.length,
        sent: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
        currentName: t.name,
        currentIndex: i,
        nextDelay: delayMs,
      });

      try {
        await sendWhatsappMessage(t.contactId, finalText, t.phone, t.name);
        results.push({ name: t.name, phone: t.phone, ok: true });
        setBulkProgress({
          total: targets.length,
          sent: results.filter((r) => r.ok).length,
          failed: results.filter((r) => !r.ok).length,
          currentName: t.name,
          currentIndex: i + 1,
          nextDelay: BULK_DELAYS[(i + 1) % BULK_DELAYS.length]!,
        });
      } catch (e) {
        results.push({ name: t.name, phone: t.phone, ok: false, error: e instanceof Error ? e.message : 'Error' });
      }

      if (i < targets.length - 1 && !cancelRef.current) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    const sent = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;

    if (cancelRef.current) {
      toast.success(`Envío cancelado. Enviado: ${sent} · Pendientes: ${targets.length - results.length}`);
    } else {
      toast.success(`Envío completado. Enviado: ${sent} · Fallidos: ${failed}`);
    }

    setBulkProgress(null);
    setSending(false);
    setSelectedIds(new Set());
    setStep(1);
  }

  function cancelBulkSend() {
    cancelRef.current = true;
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-24 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <Unplug className="h-10 w-10 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">WhatsApp no conectado</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Conecta el WhatsApp compartido para enviar campañas masivas.
          </p>
        </div>
        <Button onClick={onConnectClick} className="bg-[#13944C] hover:bg-[#0f7a3d]">
          <QrCode className="mr-2 h-4 w-4" />
          Conectar vía EvoGO
        </Button>
      </div>
    );
  }


  return (
    <Card>
      <div className="border-b px-6 py-4">
        <p className="text-sm text-muted-foreground">Crear campaña masiva · Paso {step} de 3: {step === 1 ? 'Audiencia' : step === 2 ? 'Mensaje' : 'Revisión'}</p>
        <Stepper step={step} />
      </div>

      <div className="p-6">
        {step === 1 && (
          <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
            <div className="space-y-5">
              <div>
                <h3 className="font-semibold">Seleccionar audiencia</h3>
                <p className="text-xs text-muted-foreground">
                  {source === 'crm' ? 'Contactos desde las conversaciones de WhatsApp' : 'Importa contactos desde un archivo Excel'}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Nombre de la campaña</label>
                <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Ej: Masivo WhatsApp - Prospectos" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Fuente</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { setSource('crm'); setSelectedIds(new Set()); }}
                    className={cn(
                      'flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                      source === 'crm' ? 'border-primary bg-primary/5 text-primary' : 'border-input hover:bg-muted',
                    )}
                  >
                    <Database className="h-4 w-4" /> CRM
                  </button>
                  <button
                    onClick={() => setSource('excel')}
                    className={cn(
                      'flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                      source === 'excel' ? 'border-primary bg-primary/5 text-primary' : 'border-input hover:bg-muted',
                    )}
                  >
                    <FileSpreadsheet className="h-4 w-4" /> Excel (.xlsx)
                  </button>
                </div>
                {source === 'excel' && (
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Columnas: <b>nombre</b> y <b>telefono</b> (o celular, phone).
                  </p>
                )}
              </div>

              {source === 'excel' ? (
                <div className="space-y-3">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleExcelFile(file);
                    }}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={importingExcel}
                    className={cn(
                      'flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 px-4 py-10 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary',
                      importingExcel && 'opacity-60',
                    )}
                  >
                    {importingExcel ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Upload className="h-5 w-5" />
                    )}
                    {importingExcel ? 'Importando...' : excelContacts.length > 0 ? `${excelContacts.length} contactos importados · Clic para cambiar archivo` : 'Clic para seleccionar archivo .xlsx'}
                  </button>

                  <button
                    onClick={downloadTemplate}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Descargar plantilla
                  </button>

                  {excelContacts.length > 0 && (
                    <>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">Buscar contacto</label>
                        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o teléfono..." />
                      </div>

                      <div className="rounded-lg border bg-muted/40 p-4">
                        <p className="text-xs font-medium text-muted-foreground">Contactos importados</p>
                        <p className="mt-1 text-3xl font-bold text-primary">{excelContacts.length}</p>
                        <Button
                          className="mt-3 w-full"
                          onClick={() => setSelectedIds(new Set(excelContacts.map((c) => c.phone)))}
                        >
                          <Plus className="mr-1 h-4 w-4" /> Seleccionar todos
                        </Button>
                      </div>

                      <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border p-2">
                        {filtered.length === 0 ? (
                          <p className="py-8 text-center text-sm text-muted-foreground">Sin resultados</p>
                        ) : (
                          (filtered as FlotaExcelContact[]).map((c) => {
                            const on = selectedIds.has(c.phone);
                            return (
                              <button
                                key={c.phone}
                                onClick={() => toggle(c.phone)}
                                className={cn(
                                  'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors',
                                  on ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
                                )}
                              >
                                <div className="text-left">
                                  <span>{c.name}</span>
                                  <p className="text-[11px] text-muted-foreground">
                                    {c.phone}
                                    {c.contactId ? '' : ' · Sin coincidencia en CRM'}
                                  </p>
                                </div>
                                {on ? <CheckCircle2 className="h-4 w-4" /> : <Plus className="h-4 w-4 text-muted-foreground" />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Buscar contacto</label>
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o teléfono..." />
                  </div>

                  <div className="rounded-lg border bg-muted/40 p-4">
                    <p className="text-xs font-medium text-muted-foreground">Contactos disponibles</p>
                    <p className="mt-1 text-3xl font-bold text-primary">{contacts.length}</p>
                    <Button
                      className="mt-3 w-full"
                      onClick={() => setSelectedIds(new Set(contacts.map((c) => c.id!)))}
                    >
                      <Plus className="mr-1 h-4 w-4" /> Agregar todos
                    </Button>
                  </div>

                  <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border p-2">
                    {loadingContacts ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : filtered.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">Sin contactos</p>
                    ) : (
                      (filtered as FlotaConversation[]).map((c) => {
                        const on = selectedIds.has(c.id!);
                        return (
                          <button
                            key={c.id}
                            onClick={() => toggle(c.id!)}
                            className={cn(
                              'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors',
                              on ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
                            )}
                          >
                            <div className="text-left">
                              <span>{c.name}</span>
                              <p className="text-[11px] text-muted-foreground">{c.phone}</p>
                            </div>
                            {on ? <CheckCircle2 className="h-4 w-4" /> : <Plus className="h-4 w-4 text-muted-foreground" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="rounded-lg border">
              <div className="flex items-center justify-between border-b p-4">
                <div>
                  <h3 className="font-semibold">Destinatarios seleccionados</h3>
                  <p className="text-xs text-muted-foreground">{selected.length} contactos</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
                  Eliminar seleccionados
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Nombre</th>
                      <th className="px-4 py-2 text-left font-medium">Teléfono</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="px-4 py-12 text-center text-sm text-muted-foreground">
                          Selecciona contactos desde el panel izquierdo
                        </td>
                      </tr>
                    ) : (
                      selected.map((c) => (
                        <tr key={'phone' in c ? c.phone : (c as FlotaConversation).id} className="border-t">
                          <td className="px-4 py-3 font-medium">{c.name}</td>
                          <td className="px-4 py-3 text-muted-foreground">{'phone' in c ? c.phone : (c as FlotaConversation).phone}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="space-y-5">
              <div>
                <h3 className="font-semibold">Mensaje WhatsApp</h3>
                <p className="text-xs text-muted-foreground">
                  Variables: <code className="rounded bg-muted px-1">{'{{nombre}}'}</code>,{' '}
                  <code className="rounded bg-muted px-1">{'{{celular}}'}</code>
                </p>
              </div>

              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Phone className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">WhatsApp</p>
                  <p className="text-xs text-muted-foreground">Envío masivo vía Evolution GO</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Plantillas</label>
                <div className="flex flex-wrap gap-2">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setMessage(t.text)}
                      className="rounded-md border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Mensaje</label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Escribe tu mensaje. Usa {{nombre}} para personalizar."
                  className="min-h-[160px] resize-none font-mono text-sm"
                />
                <p className="text-[11px] text-muted-foreground">{message.length} caracteres</p>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold">Vista previa</h3>
              <div className="rounded-2xl bg-slate-900 p-4 text-sm text-slate-100 shadow-inner">
                {message.trim() ? (
                  <div className="rounded-2xl rounded-bl-sm bg-emerald-600/90 p-3 text-white">
                    <p className="whitespace-pre-wrap">{preview(message)}</p>
                    <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-white/80">
                      <span>ahora</span>
                      <CheckCheck className="h-3 w-3" />
                    </div>
                  </div>
                ) : (
                  <p className="py-8 text-center text-slate-400">Sin contenido</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Vista previa con datos de: <b>{previewContact?.name}</b>
              </p>
            </div>
          </div>
        )}

        {step === 3 && !bulkProgress && (
          <div className="mx-auto max-w-2xl space-y-5">
            <div>
              <h3 className="font-semibold">Resumen del envío masivo</h3>
              <p className="text-xs text-muted-foreground">Revisa los detalles antes de enviar</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <SummaryCard label="Destinatarios" value={String(selected.length)} icon={<Users className="h-4 w-4" />} />
              <SummaryCard label="Canal" value="WhatsApp · Evolution GO" icon={<MessageSquare className="h-4 w-4" />} />
              <SummaryCard label="Nombre campaña" value={campaignName || 'Sin nombre'} icon={<Send className="h-4 w-4" />} />
              <SummaryCard label="Enviado por" value="Flota" icon={<CheckCircle2 className="h-4 w-4" />} />
            </div>

            <div className="rounded-lg border p-4">
              <p className="text-xs font-medium text-muted-foreground">Vista previa del mensaje</p>
              <p className="mt-2 whitespace-pre-wrap text-sm">{message ? preview(message) : '—'}</p>
            </div>

            <Button
              size="lg"
              className="w-full"
              onClick={handleSend}
              disabled={selected.length === 0 || !message.trim()}
            >
              <Send className="mr-2 h-4 w-4" />
              Enviar campaña masiva
            </Button>
          </div>
        )}

        {step === 3 && bulkProgress && (
          <div className="mx-auto max-w-2xl space-y-5">
            <div>
              <h3 className="font-semibold">Enviando campaña masiva</h3>
              <p className="text-xs text-muted-foreground">
                No cierres esta pestaña hasta que termine
              </p>
            </div>

            <div className="rounded-lg border bg-muted/30 p-5 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progreso</span>
                <span className="font-semibold">{bulkProgress.sent + bulkProgress.failed} de {bulkProgress.total}</span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${((bulkProgress.sent + bulkProgress.failed) / bulkProgress.total) * 100}%` }}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3 text-center text-sm">
                <div className="rounded-lg bg-background/50 p-3">
                  <p className="text-xs text-muted-foreground">Enviados</p>
                  <p className="mt-1 text-lg font-bold text-emerald-600">{bulkProgress.sent}</p>
                </div>
                <div className="rounded-lg bg-background/50 p-3">
                  <p className="text-xs text-muted-foreground">Fallidos</p>
                  <p className="mt-1 text-lg font-bold text-destructive">{bulkProgress.failed}</p>
                </div>
                <div className="rounded-lg bg-background/50 p-3">
                  <p className="text-xs text-muted-foreground">Pendientes</p>
                  <p className="mt-1 text-lg font-bold text-muted-foreground">
                    {bulkProgress.total - bulkProgress.sent - bulkProgress.failed}
                  </p>
                </div>
              </div>

              {bulkProgress.currentName && (
                <div className="rounded-lg bg-background/50 p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Enviando a</span>
                    <span className="font-medium">{bulkProgress.currentName}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Siguiente envío en</span>
                    <span className="font-medium tabular-nums">~{(bulkProgress.nextDelay / 1000).toFixed(0)}s</span>
                  </div>
                </div>
              )}

              <Button
                variant="outline"
                className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={cancelBulkSend}
              >
                <StopCircle className="mr-2 h-4 w-4" />
                Cancelar envío
              </Button>
            </div>
          </div>
        )}
      </div>

      {!bulkProgress && (
        <div className="flex items-center justify-between border-t bg-muted/30 px-6 py-4">
          <Button variant="outline" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Anterior
          </Button>
          {step < 3 ? (
            <Button onClick={() => setStep((s) => Math.min(3, s + 1))} disabled={step === 1 && selectedIds.size === 0}>
              Siguiente <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button variant="outline" onClick={() => { setStep(1); setCampaignName(''); setMessage(''); setSelectedIds(new Set()); }}>
              Nueva campaña
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

function Stepper({ step }: { step: number }) {
  const steps = [
    { n: 1, label: 'Audiencia', icon: Users },
    { n: 2, label: 'Mensaje', icon: MessageSquare },
    { n: 3, label: 'Revisión', icon: CheckCircle2 },
  ];
  return (
    <div className="mt-4 flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(step / 3) * 100}%` }} />
      </div>
      <div className="flex items-center gap-2">
        {steps.map((s) => {
          const Icon = s.icon;
          const active = step === s.n;
          const done = step > s.n;
          return (
            <div
              key={s.n}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                active ? 'bg-primary text-primary-foreground' : done ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {s.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icon} {label}
      </div>
      <p className="mt-2 text-base font-semibold">{value}</p>
    </div>
  );
}
