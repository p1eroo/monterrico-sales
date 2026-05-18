import { useState, useRef, useEffect, useMemo, memo } from 'react';
import {
  DndContext,
  closestCorners,
  DragOverlay,
  PointerSensor,
  useSensors,
  useSensor,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
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
  LayoutList,
  StopCircle,
  Download,
  Edit2,
  Edit,
  X,
  ImageIcon,
  GripVertical,
  MessageCircle,
  Info,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { EmojiGrid } from '@/components/EmojiGrid';
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
  fetchFlotaProspectoMessages,
  sendFlotaWhatsappMessage,
  importExcelPreview,
  uploadFlotaImage,
  type FlotaConversation,
  type FlotaExcelContact,
  type FlotaWhatsappConnectionResponse,
  type FlotaWhatsappConnection,
} from '@/lib/flotaWhatsappApi';
import { type WhatsappMessageItem, sendWhatsappMessage } from '@/lib/whatsappApi';
import * as QRCode from 'qrcode';
import * as XLSX from 'xlsx';

/* ==================== TIPOS ==================== */

const ESTADOS = ['NUEVO', 'AFILIADO', 'CITADO', 'SEGUIMIENTO', 'INFORMACION', 'SIN REQUISITOS', 'NO RESPONDE'] as const;

function formatStatus(status: string) {
  if (!status) return '';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

const tagStyles: Record<string, string> = {
  NUEVO: 'bg-slate-100 text-slate-700 border-slate-300',
  CITADO: 'bg-primary/10 text-primary border-primary/20',
  AFILIADO: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  SEGUIMIENTO: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  INFORMACION: 'bg-sky-500/10 text-sky-700 border-sky-500/20',
  'SIN REQUISITOS': 'bg-rose-500/10 text-rose-700 border-rose-500/20',
  'NO RESPONDE': 'bg-yellow-100 text-yellow-700 border-yellow-300',
};

/* ==================== MAIN ==================== */

export default function FlotaMensajes() {
  const [tab, setTab] = useState<'inbox' | 'masivo' | 'pipeline'>('inbox');
  const [connection, setConnection] = useState<FlotaWhatsappConnectionResponse | null>(null);
  const [evoModalOpen, setEvoModalOpen] = useState(false);
  const [loadingConn, setLoadingConn] = useState(true);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

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
            <button
              onClick={() => setTab('pipeline')}
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                tab === 'pipeline' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <LayoutList className="h-4 w-4" /> Pipeline
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
        isConnected ? <InboxView activeId={activeConversationId} onActiveChange={setActiveConversationId} /> : <ConnectPrompt onClick={() => setEvoModalOpen(true)} />
      ) : tab === 'masivo' ? (
        loadingConn ? <LoadingState /> :
        <MasivoView isConnected={isConnected} onConnectClick={() => setEvoModalOpen(true)} />
      ) : (
        <FlotaPipelineView onSelect={(id) => { setActiveConversationId(id); setTab('inbox'); }} />
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

function InboxView({ activeId: externalActiveId, onActiveChange }: { activeId: string | null; onActiveChange: (id: string | null) => void }) {
  const [conversations, setConversations] = useState<FlotaConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [messagesCache, setMessagesCache] = useState<Record<string, WhatsappMessageItem[]>>({});

  useEffect(() => {
    if (externalActiveId && externalActiveId !== activeId) {
      setActiveId(externalActiveId);
      onActiveChange(null);
    }
  }, [externalActiveId]);

  useEffect(() => {
    void loadConversations();
  }, []);

  async function loadConversations() {
    setLoading(true);
    try {
      const data = await fetchConversations();
      setConversations(data);
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
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  {c.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {(() => {
                        const msgDate = new Date(c.time);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const msgDay = new Date(msgDate);
                        msgDay.setHours(0, 0, 0, 0);
                        if (msgDay.getTime() === today.getTime()) {
                          return msgDate.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
                        }
                        return msgDate.toLocaleDateString('es-PE', { day: 'numeric', month: 'numeric', year: 'numeric' });
                      })()}
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
        <ChatPanel
          contactId={activeId}
          conversations={conversations}
          onContactUpdated={loadConversations}
          messagesCache={messagesCache}
          setMessagesCache={setMessagesCache}
        />
      ) : (
        <div className="flex items-center justify-center rounded-lg border border-border bg-card text-sm text-muted-foreground shadow-sm">
          Selecciona una conversación
        </div>
      )}
    </div>
  );
}

function ChatPanel({ contactId, conversations, onContactUpdated, messagesCache, setMessagesCache }: {
  contactId: string;
  conversations: FlotaConversation[];
  onContactUpdated: () => void;
  messagesCache: Record<string, WhatsappMessageItem[]>;
  setMessagesCache: React.Dispatch<React.SetStateAction<Record<string, WhatsappMessageItem[]>>>;
}) {
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const convo = conversations.find((c) => c.id === contactId);

  useEffect(() => {
    if (editModalOpen && contactId) {
      void loadProspectoDetail();
    }
  }, [editModalOpen, contactId]);

  async function loadProspectoDetail() {
    try {
      const data = await api<Record<string, unknown>>(`/flota-prospectos/${contactId}`);
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(data)) {
        if (v != null) fields[k] = String(v);
      }
      setEditData(fields);
    } catch {
      toast.error('No se pudo cargar los datos del prospecto');
      setEditModalOpen(false);
    }
  }

  useEffect(() => {
    if (!contactId) return;
    if (messagesCache[contactId]) return;
    void loadMessages();
  }, [contactId, messagesCache]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'instant' });
  }, [messagesCache[contactId]?.length]);

  async function loadMessages() {
    if (!contactId) return;
    setLoading(true);
    try {
      const items = await fetchFlotaProspectoMessages(contactId);
      setMessagesCache(prev => ({ ...prev, [contactId]: items }));
    } catch {
      toast.error('No se pudieron cargar los mensajes');
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    if (!draft.trim()) return;
    try {
      await sendFlotaWhatsappMessage(contactId, draft.trim());
      setDraft('');
      const items = await fetchFlotaProspectoMessages(contactId);
      setMessagesCache(prev => ({ ...prev, [contactId]: items }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo enviar el mensaje');
    }
  }

  const messages = messagesCache[contactId] ?? [];

  async function handleSaveProspecto() {
    if (!editData.nombreCompleto?.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    setSaving(true);
    const body: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(editData)) {
      const trimmed = v?.trim();
      if (trimmed) body[k] = trimmed;
      else if (v === '' && k === 'observaciones') body[k] = ''; // permitir vaciar observaciones
    }
    try {
      await api(`/flota-prospectos/${contactId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      toast.success('Prospecto actualizado');
      setEditModalOpen(false);
      onContactUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  }

  async function handleCambiarEstado(nuevoEstado: string) {
    if (!contactId) return;
    try {
      await api(`/flota-prospectos/${contactId}`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      toast.success(`Estado actualizado a ${formatStatus(nuevoEstado)}`);
      onContactUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo actualizar el estado');
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
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setEditModalOpen(true)}>
            <Edit2 className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                  convo?.estado && tagStyles[convo.estado]
                    ? tagStyles[convo.estado]
                    : 'border-input bg-background text-muted-foreground hover:bg-muted',
                )}
              >
                {convo?.estado ? formatStatus(convo.estado) : 'Estado'}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {ESTADOS.map((est) => (
                <DropdownMenuItem key={est} onClick={() => handleCambiarEstado(est)}>
                  {formatStatus(est)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_1px_1px,theme(colors.muted.foreground/0.08)_1px,transparent_0)] [background-size:18px_18px] px-4 py-5"
      >
        <div className="flex flex-col gap-3">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No hay mensajes aún
            </div>
          ) : (
            (() => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const yesterday = new Date(today);
              yesterday.setDate(yesterday.getDate() - 1);

              const formatDateLabel = (date: Date) => {
                if (date.getTime() === today.getTime()) return 'Hoy';
                if (date.getTime() === yesterday.getTime()) return 'Ayer';
                return date.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
              };

              const grouped: { date: Date; messages: typeof messages }[] = [];
              let currentDate: Date | null = null;
              let currentGroup: typeof messages = [];

              messages.forEach((m) => {
                const msgDate = new Date(m.createdAt);
                msgDate.setHours(0, 0, 0, 0);
                if (!currentDate || msgDate.getTime() !== currentDate.getTime()) {
                  if (currentGroup.length > 0) grouped.push({ date: currentDate!, messages: currentGroup });
                  currentDate = msgDate;
                  currentGroup = [m];
                } else {
                  currentGroup.push(m);
                }
              });
              if (currentGroup.length > 0) grouped.push({ date: currentDate!, messages: currentGroup });

              return grouped.map((group, gi) => (
                <div key={gi}>
                  <div className="my-3 flex items-center gap-3">
                    <div className="h-px flex-1 border-t border-border/40" />
                    <span className="text-[11px] font-medium capitalize text-muted-foreground">
                      {formatDateLabel(group.date)}
                    </span>
                    <div className="h-px flex-1 border-t border-border/40" />
                  </div>
                  {group.messages.map((m) => {
                    const mine = m.direction === 'outbound';
                    return (
                      <div key={m.id} className={cn('flex mb-2', mine ? 'justify-end' : 'justify-start')}>
                        <div
                          className={cn(
                            'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm',
                            mine
                              ? 'rounded-br-sm bg-primary text-primary-foreground'
                              : 'rounded-bl-sm bg-muted text-foreground',
                          )}
                        >
                          {m.attachments?.filter((a) => a.mediaType === 'image' || a.mimeType?.startsWith('image/')).map((img) => (
                            <img
                              key={img.id}
                              src={img.url ?? img.downloadUrl ?? ''}
                              alt={img.name}
                              className="mb-2 max-h-60 rounded-lg object-cover"
                            />
                          ))}
                          <p className="whitespace-pre-wrap">{m.body}</p>
                          <div className={cn('mt-1 flex items-center justify-end gap-1 text-[10px]', mine ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                            <span>{new Date(m.createdAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</span>
                            {mine && <CheckCheck className={cn('h-3 w-3', m.waOutboundStatus === 'read' ? 'text-sky-300' : '')} />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ));
            })()
          )}
        </div>
      </div>

      <div className="border-t bg-background/60 p-3">
        <div className="flex items-end gap-2">
          <Button variant="ghost" size="icon" className="shrink-0"><Paperclip className="h-5 w-5" /></Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0"><Smile className="h-5 w-5" /></Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-auto p-0 border-0">
              <EmojiGrid onSelect={(emoji) => setDraft((prev) => prev + emoji)} />
            </PopoverContent>
          </Popover>
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
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Prospecto</DialogTitle>
            <DialogDescription>
              Modifica los datos del prospecto. Solo se guardarán los campos con valor.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            <div className="space-y-1 col-span-2">
              <Label>Nombre completo *</Label>
              <Input
                value={editData.nombreCompleto ?? ''}
                onChange={(e) => setEditData((prev) => ({ ...prev, nombreCompleto: e.target.value }))}
                placeholder="Nombre completo"
              />
            </div>
            <div className="space-y-1">
              <Label>Celular</Label>
              <Input
                value={editData.celular ?? ''}
                onChange={(e) => setEditData((prev) => ({ ...prev, celular: e.target.value }))}
                placeholder="Celular"
              />
            </div>
            <div className="space-y-1">
              <Label>Móvil</Label>
              <Input
                value={editData.movil ?? ''}
                onChange={(e) => setEditData((prev) => ({ ...prev, movil: e.target.value }))}
                placeholder="Móvil"
              />
            </div>
            <div className="space-y-1">
              <Label>Edad</Label>
              <Input
                type="number"
                value={editData.edad ?? ''}
                onChange={(e) => setEditData((prev) => ({ ...prev, edad: e.target.value }))}
                placeholder="Edad"
              />
            </div>
            <div className="space-y-1">
              <Label>Distrito</Label>
              <Input
                value={editData.distrito ?? ''}
                onChange={(e) => setEditData((prev) => ({ ...prev, distrito: e.target.value }))}
                placeholder="Distrito"
              />
            </div>
            <div className="space-y-1">
              <Label>Operador</Label>
              <Input
                value={editData.operador ?? ''}
                onChange={(e) => setEditData((prev) => ({ ...prev, operador: e.target.value }))}
                placeholder="Operador"
              />
            </div>
            <div className="space-y-1">
              <Label>Modalidad</Label>
              <Input
                value={editData.modalidad ?? ''}
                onChange={(e) => setEditData((prev) => ({ ...prev, modalidad: e.target.value }))}
                placeholder="Modalidad"
              />
            </div>
            <div className="space-y-1">
              <Label>Red Social</Label>
              <Input
                value={editData.redSocial ?? ''}
                onChange={(e) => setEditData((prev) => ({ ...prev, redSocial: e.target.value }))}
                placeholder="Red social"
              />
            </div>
            <div className="space-y-1">
              <Label>Año vehículo</Label>
              <Input
                type="number"
                value={editData.anioVehiculo ?? ''}
                onChange={(e) => setEditData((prev) => ({ ...prev, anioVehiculo: e.target.value }))}
                placeholder="Año del vehículo"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Observaciones</Label>
              <Textarea
                value={editData.observaciones ?? ''}
                onChange={(e) => setEditData((prev) => ({ ...prev, observaciones: e.target.value }))}
                placeholder="Observaciones"
                className="min-h-[80px] resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveProspecto} disabled={saving || !editData.nombreCompleto?.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
  const [source, setSource] = useState<'crm' | 'excel' | null>(null);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
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

  const displayedContacts = source === 'excel' ? excelContacts : source === 'crm' ? contacts : [];
  const selected = source === 'crm'
    ? contacts.filter((c) => selectedIds.has(c.id!))
    : source === 'excel'
    ? excelContacts.filter((c) => selectedIds.has(c.phone))
    : [];
  const previewContact = selected[0] ?? displayedContacts[0];
  const filtered = source === 'excel'
    ? excelContacts.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search))
    : source === 'crm'
    ? contacts.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : [];

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

  function effectiveContactsToSend(): Array<{ contactId: string | undefined; flotaProspectoId: string | undefined; name: string; phone: string }> {
    if (source === 'crm') {
      return (contacts as FlotaConversation[])
        .filter((c) => selectedIds.has(c.id!))
        .map((c) => ({ contactId: c.id ?? undefined, flotaProspectoId: c.id ?? undefined, name: c.name, phone: c.phone }));
    }
    return (excelContacts as FlotaExcelContact[])
      .filter((c) => selectedIds.has(c.phone))
      .map((c) => ({ contactId: c.contactId ?? undefined, flotaProspectoId: undefined, name: c.name, phone: c.phone }));
  }

  async function handleSend() {
    if (!isConnected) {
      onConnectClick();
      return;
    }
    const targets = effectiveContactsToSend();
    if (targets.length === 0) {
      toast.error(source === null ? 'Selecciona una fuente primero.' : source === 'excel' ? 'Ningún contacto del Excel tiene coincidencia en el CRM.' : 'Selecciona al menos un contacto.');
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
        await sendWhatsappMessage(t.contactId, finalText, t.phone, t.name, imageUrl || undefined, t.flotaProspectoId);
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
        const errorMsg = e instanceof Error ? e.message : 'Error';
        console.error(`[FlotaBulk] Falló envío a ${t.name} (${t.phone}):`, errorMsg);
        results.push({ name: t.name, phone: t.phone, ok: false, error: errorMsg });
      }

      if (i < targets.length - 1 && !cancelRef.current) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    const sent = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;
    const failedResults = results.filter((r) => !r.ok);

    if (cancelRef.current) {
      toast.success(`Envío cancelado. Enviado: ${sent} · Pendientes: ${targets.length - results.length}`);
    } else {
      toast.success(`Envío completado. Enviado: ${sent} · Fallidos: ${failed}`);
    }

    if (failedResults.length > 0) {
      console.error('[FlotaBulk] Fallidos:', failedResults);
      const firstError = failedResults[0]!.error;
      toast.error(`Primer fallo: ${firstError}`, { duration: 10000 });
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
                  {source === 'crm' ? 'Contactos desde las conversaciones de WhatsApp' : source === 'excel' ? 'Importa contactos desde un archivo Excel' : ''}
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
              {source === 'excel' && excelContacts.length > 0 ? (
                <>
                  <div className="flex items-center justify-between border-b p-4">
                    <div>
                      <h3 className="font-semibold">Contactos importados</h3>
                      <p className="text-xs text-muted-foreground">{selectedIds.size} de {excelContacts.length} seleccionados</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set(excelContacts.map((c) => c.phone)))}>
                        Seleccionar todos
                      </Button>
                      {selectedIds.size > 0 && (
                        <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
                          Limpiar
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="border-b px-4 py-3">
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar por nombre o teléfono..."
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader className="bg-muted/50 sticky top-0">
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={
                                excelContacts.length > 0 &&
                                excelContacts.every((c) => selectedIds.has(c.phone))
                              }
                              onCheckedChange={() => {
                                const allSelected = excelContacts.every((c) => selectedIds.has(c.phone));
                                if (allSelected) {
                                  setSelectedIds(new Set());
                                } else {
                                  setSelectedIds(new Set(excelContacts.map((c) => c.phone)));
                                }
                              }}
                            />
                          </TableHead>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Teléfono</TableHead>
                          <TableHead>CRM</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(filtered as FlotaExcelContact[]).length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="py-12 text-center text-sm text-muted-foreground">
                              Sin resultados
                            </TableCell>
                          </TableRow>
                        ) : (
                          (filtered as FlotaExcelContact[]).map((c) => {
                            const on = selectedIds.has(c.phone);
                            return (
                              <TableRow key={c.phone} className={cn(on && 'bg-primary/5')}>
                                <TableCell>
                                  <Checkbox
                                    checked={on}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setSelectedIds((prev) => new Set([...prev, c.phone]));
                                      } else {
                                        setSelectedIds((prev) => {
                                          const n = new Set(prev);
                                          n.delete(c.phone);
                                          return n;
                                        });
                                      }
                                    }}
                                  />
                                </TableCell>
                                <TableCell className="font-medium">{c.name}</TableCell>
                                <TableCell>{c.phone}</TableCell>
                                <TableCell>
                                  {c.contactId ? (
                                    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">Coincide</span>
                                  ) : (
                                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">Sin CRM</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : source === 'excel' ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <FileSpreadsheet className="mb-3 h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Importa un archivo Excel para ver los contactos</p>
                </div>
              ) : (
                <>
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
                </>
              )}
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

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">Mensaje</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7"><Smile className="h-4 w-4" /></Button>
                    </PopoverTrigger>
                    <PopoverContent side="bottom" align="end" className="w-auto p-0 border-0">
                      <EmojiGrid onSelect={(emoji) => setMessage((prev) => prev + emoji)} />
                    </PopoverContent>
                  </Popover>
                </div>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Escribe tu mensaje. Usa {{nombre}} para personalizar."
                  className="min-h-[120px] resize-none font-mono text-sm"
                />
                <p className="text-[11px] text-muted-foreground">{message.length} caracteres</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Adjuntar imagen (opcional)</label>
                {imagePreview ? (
                  <div className="relative w-40">
                    <img src={imagePreview} alt="Preview" className="h-32 w-32 rounded-lg object-cover border" />
                    <button
                      onClick={() => { setImageFile(null); setImagePreview(null); setImageUrl(null); }}
                      className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploadingImage}
                  >
                    {uploadingImage ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Subiendo...
                      </>
                    ) : (
                      <>
                        <ImageIcon className="mr-2 h-4 w-4" />
                        Seleccionar imagen
                      </>
                    )}
                  </Button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setImageFile(file);
                    setImagePreview(URL.createObjectURL(file));
                    setUploadingImage(true);
                    try {
                      const url = await uploadFlotaImage(file);
                      setImageUrl(url);
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : 'Error subiendo imagen';
                      toast.error(msg);
                      setImageFile(null);
                      setImagePreview(null);
                    } finally {
                      setUploadingImage(false);
                    }
                  }}
                />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold">Vista previa</h3>
              <div className="rounded-2xl bg-card p-4 text-sm text-card-foreground shadow-inner">
                {message.trim() || imagePreview ? (
                  <div className="rounded-2xl rounded-bl-sm bg-emerald-600/90 p-3 text-white">
                    {imagePreview && <img src={imagePreview} alt="Adjunto" className="mb-2 max-h-48 rounded-lg object-cover" />}
                    <p className="whitespace-pre-wrap">{preview(message)}</p>
                    <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-white/80">
                      <span>ahora</span>
                      <CheckCheck className="h-3 w-3" />
                    </div>
                  </div>
                ) : (
                  <p className="py-8 text-center text-muted-foreground">Sin contenido</p>
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

            <Button
              size="lg"
              className="w-full"
              onClick={handleSend}
              disabled={selected.length === 0 || (!message.trim() && !imageUrl)}
            >
              <Send className="mr-2 h-4 w-4" />
              Enviar
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

/* ==================== PIPELINE ==================== */

const ESTADOS_PIPELINE = [
  'Nuevo',
  'Informacion',
  'Citado',
  'Seguimiento',
  'Sin Requisitos',
  'No Responde',
  'Afiliado',
];

const estadoColorMap: Record<string, string> = {
  'Nuevo': 'bg-gray-100 text-gray-700',
  'Informacion': 'bg-cyan-100 text-cyan-700',
  'Citado': 'bg-blue-100 text-blue-700',
  'Seguimiento': 'bg-green-100 text-green-700',
  'Sin Requisitos': 'bg-red-100 text-red-700',
  'No Responde': 'bg-yellow-100 text-yellow-700',
  'Afiliado': 'bg-purple-100 text-purple-700',
};

const ESTADO_LABELS: Record<string, string> = {
  'Nuevo': 'Nuevo',
  'Informacion': 'Info',
  'Citado': 'Citado',
  'Seguimiento': 'Seguimiento',
  'Sin Requisitos': 'Sin Requisitos',
  'No Responde': 'No Responde',
  'Afiliado': 'Afiliado',
};

const ACCENT_COLORS: Record<string, string> = {
  'Nuevo': '#6b7280',
  'Informacion': '#0891b2',
  'Citado': '#2563eb',
  'Seguimiento': '#16a34a',
  'Sin Requisitos': '#dc2626',
  'No Responde': '#ca8a04',
  'Afiliado': '#9333ea',
};

function FlotaPipelineView({ onSelect }: { onSelect: (contactId: string) => void }) {
  const [conversations, setConversations] = useState<FlotaConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    void loadConversations();
  }, []);

  async function loadConversations() {
    setLoading(true);
    try {
      const data = await fetchConversations();
      setConversations(data);
    } catch {
      toast.error('No se pudieron cargar los prospectos');
    } finally {
      setLoading(false);
    }
  }

  const grouped = useMemo(() => {
    const map: Record<string, FlotaConversation[]> = {};
    for (const s of ESTADOS_PIPELINE) map[s] = [];
    for (const c of conversations) {
      const estado = c.estado;
      if (estado && map[estado]) {
        map[estado].push(c);
      } else {
        map['Nuevo'].push(c);
      }
    }
    return map;
  }, [conversations]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;
    const nuevoEstado = over.id as string;
    if (!ESTADOS_PIPELINE.includes(nuevoEstado)) return;
    const contactId = active.id as string;
    const convo = conversations.find((c) => c.id === contactId);
    if (!convo || convo.estado === nuevoEstado) return;
    const idx = conversations.findIndex((c) => c.id === contactId);
    setConversations((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], estado: nuevoEstado };
      return next;
    });
    try {
      await api(`/flota-prospectos/${contactId}`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      toast.success('Estado actualizado');
    } catch {
      setConversations((prev) => {
        const next = [...prev];
        const i = next.findIndex((c) => c.id === contactId);
        if (i >= 0) next[i] = { ...next[i], estado: convo.estado };
        return next;
      });
      toast.error('No se pudo actualizar el estado');
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const activeConvo = activeId ? conversations.find((c) => c.id === activeId) : null;

  if (loading) return <LoadingState />;

  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Pipeline de Prospectos Flota</h2>
          <p className="text-sm text-muted-foreground">{conversations.length} prospectos</p>
        </div>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="scrollbar-thin flex gap-3 overflow-x-auto px-3 pb-3 pt-2" style={{ minHeight: 'calc(100vh - 14rem)' }}>
          {ESTADOS_PIPELINE.map((estado) => (
            <FlotaKanbanColumn
              key={estado}
              estado={estado}
              conversations={grouped[estado]}
              onSelect={onSelect}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeConvo ? (
            <div className="w-[280px] rotate-2 shadow-xl border-primary/40 rounded-lg bg-card border p-3">
              <p className="truncate text-sm font-semibold">{activeConvo.name}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{activeConvo.phone}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

interface FlotaKanbanColumnProps {
  estado: string;
  conversations: FlotaConversation[];
  onSelect: (contactId: string) => void;
}

const FlotaKanbanColumn = memo(function FlotaKanbanColumn({ estado, conversations, onSelect }: FlotaKanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id: estado });
  const accentColor = ACCENT_COLORS[estado] ?? '#6b7280';

  return (
    <div className="flex h-full min-w-[280px] max-w-[300px] shrink-0 flex-col rounded-lg border bg-muted/20">
      <div className="h-1 rounded-t-lg" style={{ backgroundColor: accentColor }} />
      <div className="flex items-center justify-between border-x border-t px-3.5 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{ESTADO_LABELS[estado] ?? estado}</h3>
          <Badge variant="secondary" className="text-xs font-bold">{conversations.length}</Badge>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto border-x border-b border-dashed border-transparent p-2"
        style={{ '--drop-active-bg': 'rgba(59,130,246,0.05)' } as React.CSSProperties}
      >
        {conversations.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-muted-foreground/20 py-8 text-xs text-muted-foreground">
            Sin prospectos
          </div>
        ) : (
          conversations.map((c) => (
            <FlotaPipelineCard key={c.id} conversation={c} onSelect={onSelect} />
          ))
        )}
      </div>
    </div>
  );
});

interface FlotaPipelineCardProps {
  conversation: FlotaConversation;
  onSelect: (contactId: string) => void;
}

const FlotaPipelineCard = memo(function FlotaPipelineCard({ conversation: c, onSelect }: FlotaPipelineCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: c.id });

  const style: React.CSSProperties | undefined = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative select-none rounded-lg border border-border bg-card p-3.5 shadow-sm',
        'transition-[box-shadow,border-color] duration-150',
        'hover:border-primary/30 dark:hover:shadow-lg',
        isDragging && 'opacity-40',
      )}
    >
      <div {...listeners} {...attributes} className="absolute left-2 top-2 cursor-grab text-muted-foreground opacity-0 transition-opacity group-hover:opacity-60">
        <GripVertical className="size-4" />
      </div>
      <button
        type="button"
        onClick={() => onSelect(c.id)}
        className="ml-5 block w-full truncate text-left text-sm font-semibold text-foreground hover:underline hover:text-primary"
      >
        {c.name}
      </button>
      <div className="mt-2 space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Phone className="size-3 shrink-0" />
          <span className="truncate">{c.phone}</span>
        </div>
        {c.preview && (
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <MessageCircle className="size-3 mt-0.5 shrink-0" />
            <span className="line-clamp-2 break-words">{c.preview}</span>
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onSelect(c.id); }}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-100 px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-200"
        >
          <MessageCircle className="size-3.5" />
          WhatsApp
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onSelect(c.id); }}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Ver detalle"
        >
          <Info className="size-4" />
        </button>
      </div>
    </div>
  );
});

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
