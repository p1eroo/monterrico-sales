import { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useVirtualizer } from '@tanstack/react-virtual';
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
  ArrowDown,
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
  Pause,
  Edit2,
  Edit,
  X,
  ImageIcon,
  GripVertical,
  MessageCircle,
  Info,
  FileText,
  ExternalLink,
  Music2,
  Mic,
  MicOff,
  PanelRight,
  Lock,
  Link2,
  Calendar,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { api, API_BASE } from '@/lib/api';
import { useAppStore } from '@/store';
import { usePermissions } from '@/hooks/usePermissions';
import { Pagination } from '@/components/shared/Pagination';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { EmojiGrid } from '@/components/EmojiGrid';
import QRCode from 'qrcode';
import BotFlowBuilder from '@/modules/flota/bot-flow/BotFlowBuilder';
import AutomationLayout from '@/modules/flota/bot-flow/AutomationLayout';
import * as XLSX from 'xlsx';
import type { WhatsappSocketPayload, WhatsappMessageItem } from '@/lib/whatsappApi';
import { downloadWhatsappAttachment } from '@/lib/whatsappApi';
import type { OperadorUser } from '@/lib/flotaProspectosApi';
import {
  fetchOperadores,
  getOperatorDisplayName,
  flotaProspectoCreate,
  flotaProspectosList,
  flotaLlamadaCreate,
} from '@/lib/flotaProspectosApi';
import { getConductorTelefonos } from '@/lib/flotaConductoresApi';
import {
  fetchSharedConnection,
  connectSharedWhatsapp,
  disconnectSharedWhatsapp,
  sendSharedTestMessage,
  fetchConversations,
  markConversationAsRead,
  fetchMasivoProspectos,
  fetchFlotaProspectoMessages,
  sendFlotaWhatsappMessage,
  uploadFlotaImage,
  uploadFlotaAudio,
  uploadFlotaDocument,
  importExcelPreview,
  sendFlotaBulk,
  getFlotaBulkProgress,
  cancelFlotaBulk,
  pauseFlotaBulk,
  resumeFlotaBulk,
  fetchFlotaInstances,
  createFlotaInstance,
  connectFlotaInstance,
  disconnectFlotaInstance,
  deleteFlotaInstance,
  updateFlotaInstanceFlags,
  listFlotaBulkCampaigns,
  type FlotaExcelContact,
  type FlotaConversation,
  type FlotaWhatsappConnectionResponse,
  type FlotaInstanceDetail,
  type FlotaBulkCampaign,
  type FlotaBulkProgress,
} from '@/lib/flotaWhatsappApi';
import FlotaCalendario from '@/pages/flota/FlotaCalendario';

/* ==================== TIPOS ==================== */

const ESTADOS = ['Nuevo', 'Afiliado', 'Citado', 'Seguimiento', 'Informacion', 'Sin Requisitos', 'No Responde'] as const;

function formatStatus(status: string) {
  if (!status) return '';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

const tagStyles: Record<string, string> = {
  Nuevo: 'bg-slate-100 text-slate-700 border-slate-300',
  Citado: 'bg-primary/10 text-primary border-primary/20',
  Afiliado: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  Seguimiento: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  Informacion: 'bg-sky-500/10 text-sky-700 border-sky-500/20',
  'Sin Requisitos': 'bg-rose-500/10 text-rose-700 border-rose-500/20',
  'No Responde': 'bg-yellow-100 text-yellow-700 border-yellow-300',
};

function getTagStyle(estado: string | undefined): string | undefined {
  if (!estado) return undefined;
  const key = Object.keys(tagStyles).find((k) => k.toLowerCase() === estado.toLowerCase());
  return key ? tagStyles[key] : undefined;
}

function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function attachmentTypeLabel(name: string, mimeType: string): string {
  const mime = mimeType.trim().toLowerCase();
  const ext = name.includes('.') ? name.split('.').pop()?.trim().toUpperCase() || '' : '';
  if (mime.includes('pdf') || ext === 'PDF') return 'PDF';
  if (mime.includes('wordprocessingml') || ext === 'DOCX') return 'DOCX';
  if (mime === 'application/msword' || ext === 'DOC') return 'DOC';
  if (mime.includes('spreadsheetml') || ext === 'XLSX') return 'XLSX';
  if (mime.includes('excel') || ext === 'XLS') return 'XLS';
  if (mime.includes('presentationml') || ext === 'PPTX') return 'PPTX';
  if (mime.includes('powerpoint') || ext === 'PPT') return 'PPT';
  if (mime.startsWith('text/plain') || ext === 'TXT') return 'TXT';
  if (mime.includes('csv') || ext === 'CSV') return 'CSV';
  if (mime.includes('zip') || ext === 'ZIP') return 'ZIP';
  if (mime.includes('rar') || ext === 'RAR') return 'RAR';
  if (ext) return ext;
  return 'Documento';
}

function attachmentMetaLine(name: string, mimeType: string, size: number): string {
  const parts = [attachmentTypeLabel(name, mimeType)];
  const prettySize = formatBytes(size);
  if (prettySize) parts.push(prettySize);
  return parts.join(' · ');
}

function MessageAttachment({
  attachment,
  mine,
  setLightboxUrl,
  setLightboxAttachment,
}: {
  attachment: NonNullable<WhatsappMessageItem['attachments']>[number];
  mine: boolean;
  setLightboxUrl: (url: string) => void;
  setLightboxAttachment?: (info: { id: string; name: string }) => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const src = (attachment.url ?? attachment.downloadUrl ?? attachment.proxyUrl ?? '').trim();

  if (!src) {
    return (
      <div className={cn("mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs", mine ? "bg-black/10 text-primary-foreground/80" : "bg-black/5 text-muted-foreground")}>
        <FileText className="h-4 w-4 shrink-0" />
        <span className="truncate">{attachment.name || 'Archivo no disponible'}</span>
      </div>
    );
  }

  async function downloadImage() {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadWhatsappAttachment({ id: attachment.id, name: attachment.name, url: src });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al descargar');
    } finally {
      setDownloading(false);
    }
  }

  if (attachment.mediaType === 'image' || attachment.mimeType?.startsWith('image/')) {
    return (
      <div className="relative w-full">
        <button type="button" onClick={() => { setLightboxUrl(src); setLightboxAttachment?.({ id: attachment.id, name: attachment.name }); }} className="block w-full">
          <img
            src={src}
            alt={attachment.name}
            className="mb-2 max-h-60 w-full rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
          />
        </button>
        <button
          type="button"
          onClick={downloadImage}
          className="absolute top-2 right-2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70 transition-colors"
          title="Descargar imagen"
        >
          {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        </button>
      </div>
    );
  }

  if (attachment.mediaType === 'video' || attachment.mimeType?.startsWith('video/')) {
    return (
      <video controls preload="metadata" className="mb-2 max-h-60 w-full rounded-lg bg-black" src={src} />
    );
  }

  if (attachment.mediaType === 'audio' || attachment.mimeType?.startsWith('audio/')) {
    return (
      <div className={cn("mb-2 rounded-lg px-3 py-2", mine ? "bg-black/10" : "bg-black/5")}>
        <div className={cn("mb-2 flex items-center gap-2 text-xs", mine ? "text-primary-foreground/80" : "text-muted-foreground")}>
          <Music2 className="h-4 w-4" />
          <span className="truncate">{attachment.name}</span>
        </div>
        <audio controls preload="metadata" className="w-full max-w-[240px]" src={src} />
      </div>
    );
  }

  const Icon = attachment.mediaType === 'document' ? FileText : FileText;

  async function onDownloadClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadWhatsappAttachment({ id: attachment.id, name: attachment.name, url: src });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al descargar');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <a
      href={src}
      rel="noreferrer"
      download={attachment.name}
      onClick={onDownloadClick}
      className={cn("mb-2 flex items-center gap-3 rounded-lg px-3 py-2 transition", mine ? "bg-black/10 text-primary-foreground hover:bg-black/20" : "bg-black/5 text-foreground hover:bg-black/10")}
    >
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", mine ? "bg-white/20" : "bg-background")}>
        <Icon className={cn("h-5 w-5", mine ? "text-primary-foreground" : "text-muted-foreground")} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{attachment.name}</p>
        <p className={cn("text-xs", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
          {attachmentMetaLine(attachment.name, attachment.mimeType || '', attachment.size || 0)}
        </p>
      </div>
      {downloading ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin opacity-70" />
      ) : attachment.downloadUrl ? (
        <Download className="h-4 w-4 shrink-0 opacity-70" />
      ) : (
        <ExternalLink className="h-4 w-4 shrink-0 opacity-70" />
      )}
    </a>
  );
}

/* ==================== MAIN ==================== */

export default function FlotaMensajes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<'inbox' | 'masivo' | 'pipeline' | 'automatizacion' | 'conexiones' | 'calendario'>(
    () => {
      const t = searchParams.get('tab');
      if (t === 'inbox' || t === 'masivo' || t === 'pipeline' || t === 'automatizacion' || t === 'conexiones') return t;
      return 'inbox';
    },
  );
  const [connection, setConnection] = useState<FlotaWhatsappConnectionResponse | null>(null);
  const [evoModalOpen, setEvoModalOpen] = useState(false);
  const [loadingConn, setLoadingConn] = useState(true);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    () => searchParams.get('chat') || null,
);
  const pipelineSelect = useCallback((id: string) => {
    setActiveConversationId(id);
    setTab('inbox');
  }, []);

  const handleActiveChange = useCallback((id: string | null) => {
    setActiveConversationId(id);
    if (id) {
      setSearchParams({ chat: id }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }, [setSearchParams]);

  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    }, { replace: true });
  }, [tab, setSearchParams]);

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

  // Multi-instance state
  const [connectingInstance, setConnectingInstance] = useState<FlotaInstanceDetail | null>(null);
  const [conexionesReloadTick, setConexionesReloadTick] = useState(0);
  const [flotaInstances, setFlotaInstances] = useState<FlotaInstanceDetail[]>([]);

  const inboxConnected = useMemo(
    () => flotaInstances.some((i) => i.useForInbox && i.isConnected),
    [flotaInstances],
  );
  const masivoConnected = useMemo(
    () => flotaInstances.some((i) => i.useForMasivo && i.isConnected),
    [flotaInstances],
  );
  const anyFlotaConnected = useMemo(
    () => flotaInstances.some((i) => i.isConnected),
    [flotaInstances],
  );

  useEffect(() => {
    fetchFlotaInstances().then(setFlotaInstances).catch(() => {});
    const interval = setInterval(() => {
      fetchFlotaInstances().then(setFlotaInstances).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, [conexionesReloadTick]);

  const tabStatusConnected = useMemo(() => {
    if (tab === 'inbox') return inboxConnected;
    if (tab === 'masivo') return masivoConnected;
    return isConnected || anyFlotaConnected;
  }, [tab, inboxConnected, masivoConnected, isConnected, anyFlotaConnected]);

  const handleConnectInstance = useCallback(async (id: string) => {
    const { instance: updated } = await connectFlotaInstance(id);
    setConnectingInstance(updated);
  }, []);

  const handleDisconnectInstance = useCallback(async (id: string) => {
    await disconnectFlotaInstance(id);
    setConnectingInstance(null);
    setEvoModalOpen(false);
    setConexionesReloadTick((t) => t + 1);
    toast.success('Instancia desconectada');
  }, []);

  const handleCloseInstanceModal = useCallback(() => {
    setConnectingInstance(null);
    setConexionesReloadTick((t) => t + 1);
  }, []);

  return (
    <div className="flex flex-col h-svh w-full overflow-hidden">
      {/* Full-width header */}
      <header className="flex items-center gap-3 border-b border-sidebar-border/80 h-14 shrink-0 px-4 bg-sidebar text-sidebar-foreground">
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center rounded-md border border-primary-foreground/30 px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-foreground/10 transition-colors"
        >
          Volver
        </button>
        <div className="flex-1" />
        <div className="[&_button]:text-sidebar-foreground [&_button:hover]:bg-sidebar-accent [&_button:hover]:text-sidebar-accent-foreground [&_button]:size-9 [&_svg]:size-5">
          <ThemeToggle />
        </div>
        <button
          onClick={() => setEvoModalOpen(true)}
          className={cn(
            'flex flex-col items-center justify-center rounded-md border px-4 py-1 text-xs leading-tight transition-colors',
            tabStatusConnected
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
              : 'border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20',
          )}
        >
          <span className="font-medium">{instance?.displayLineId || instance?.instanceName || 'WhatsApp'}</span>
          <span className="opacity-70">{tabStatusConnected ? 'Conectado' : 'Desconectado'}</span>
        </button>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left icon sidebar */}
        <aside className="flex flex-col items-center gap-3 border-r border-muted bg-card px-1.5 py-4 w-[54px] shrink-0">
          <TooltipProvider>
          {([
            { key: 'inbox', icon: Inbox, label: 'Inbox' },
            { key: 'calendario', icon: Calendar, label: 'Calendario' },
            { key: 'masivo', icon: Send, label: 'Masivo' },
            { key: 'pipeline', icon: LayoutList, label: 'Pipeline' },
            { key: 'conexiones', icon: Link2, label: 'Conexiones' },
            { key: 'automatizacion', icon: null, label: 'Automatización', customIcon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>' },
          ] as const).map((item) => {
            const Icon = item.icon;
            return (
                <Tooltip key={item.key}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => { setTab(item.key as any); setSearchParams({ tab: item.key }, { replace: true }); }}
                      className={cn(
                        'flex items-center justify-center rounded-lg w-9 h-9 transition-colors',
                        tab === item.key ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      {Icon ? <Icon className="h-4 w-4" /> : <span dangerouslySetInnerHTML={{ __html: item.customIcon || '' }} />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
            );
          })}
          </TooltipProvider>
          <div className="flex-1" />
        </aside>

        {/* Main content */}
        <div className="flex flex-col flex-1 min-w-0 bg-card">
          <div className="flex flex-col min-h-0 flex-1">
            {tab === 'inbox' ? (
              loadingConn ? <LoadingState /> :
              <InboxView activeId={activeConversationId} onActiveChange={handleActiveChange} isConnected={isConnected} />
            ) : tab === 'masivo' ? (
              loadingConn ? <LoadingState /> :
              <div className="flex flex-col min-h-0 flex-1">
                <MasivoView isConnected={isConnected} masivoConnected={masivoConnected} onConnectClick={() => setEvoModalOpen(true)} />
              </div>
            ) : tab === 'pipeline' ? (
              <FlotaPipelineView onSelect={pipelineSelect} />
            ) : tab === 'conexiones' ? (
              <ConexionesView onConnectInstance={(inst) => setConnectingInstance(inst)} key={conexionesReloadTick} />
            ) : tab === 'calendario' ? (
              <div className="flex-1 min-h-0 overflow-auto p-4">
                <FlotaCalendario />
              </div>
            ) : (
              <AutomationLayout />
            )}
          </div>
        </div>
      </div>

      <EvoGoModal
        open={evoModalOpen || !!connectingInstance}
        onOpenChange={(v) => { if (!v) { setEvoModalOpen(false); handleCloseInstanceModal(); } }}
        connection={connection}
        loading={loadingConn}
        onRefresh={() => loadConnection(false)}
        instanceOverride={connectingInstance}
        onConnectInstance={handleConnectInstance}
        onDisconnectInstance={handleDisconnectInstance}
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
  instanceOverride,
  onConnectInstance,
  onDisconnectInstance,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  connection: FlotaWhatsappConnectionResponse | null;
  loading: boolean;
  onRefresh: () => void;
  onConnect: () => Promise<void>;
  onDisconnect: () => Promise<void>;
  instanceOverride?: FlotaInstanceDetail | null;
  onConnectInstance?: (id: string) => Promise<void>;
  onDisconnectInstance?: (id: string) => Promise<void>;
}) {
  const instance = instanceOverride ?? connection?.instance ?? null;
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
    if (instanceOverride && onConnectInstance) {
      await onConnectInstance(instanceOverride.id);
    } else {
      await onConnect();
    }
    setBusy(null);
  }

  async function handleDisconnect() {
    setBusy('disconnect');
    if (instanceOverride && onDisconnectInstance) {
      await onDisconnectInstance(instanceOverride.id);
    } else {
      await onDisconnect();
    }
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
              {instanceOverride ? `Conexión: ${instanceOverride.instanceName}` : 'Evolution GO — Flota'}
            </DialogTitle>
            <DialogDescription>
              {isConnected
                ? `${instance?.instanceName || 'WhatsApp'} conectado`
                : instanceOverride
                  ? `Escaneá el QR para conectar ${instanceOverride.instanceName}`
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

const ConversationItem = memo(({
  conversation,
  isActive,
  index,
  start,
  measureElement,
  onClick,
  conductorCodigosInbox,
}: {
  conversation: FlotaConversation;
  isActive: boolean;
  index: number;
  start: number;
  measureElement: (element: HTMLElement | null) => void;
  onClick: (id: string) => void;
  conductorCodigosInbox: Record<string, string>;
}) => {
  const dateStr = useMemo(() => {
    if (!conversation.time) return '';
    const msgDate = new Date(conversation.time);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const msgDay = new Date(msgDate.getFullYear(), msgDate.getMonth(), msgDate.getDate());
    const diffDays = Math.floor((today.getTime() - msgDay.getTime()) / 86400000);
    if (diffDays === 0) {
      return msgDate.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays === 1) {
      return 'Ayer';
    }
    if (diffDays < 7) {
      return msgDate.toLocaleDateString('es-PE', { weekday: 'short' });
    }
    return msgDate.toLocaleDateString('es-PE', { day: 'numeric', month: 'numeric' });
  }, [conversation.time]);

  return (
    <div
      data-index={index}
      ref={measureElement}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        transform: `translateY(${start}px)`,
      }}
    >
      <button
        onClick={() => onClick(conversation.id)}
        className="flex w-full items-start text-left transition-colors px-3 py-[5px] group"
      >
        <div className={cn(
          'flex w-full items-start gap-3 rounded-lg px-3 py-1 transition-colors',
          'group-hover:bg-accent group-hover:shadow-sm',
          isActive && 'bg-accent shadow-sm',
        )}>
        <div className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary',
          conversation.unread > 0 && 'bg-primary text-primary-foreground',
        )}>
          {conversation.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className={cn('truncate text-sm text-foreground', conversation.unread > 0 && 'font-semibold')}>{conversation.name}</p>
            <span className="shrink-0 text-xs text-muted-foreground">
              {dateStr}
            </span>
          </div>
          <p className={cn('mt-0.5 line-clamp-1 text-sm', conversation.unread > 0 ? 'font-medium text-foreground' : 'text-muted-foreground')}>{conversation.preview}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              {conversation.phone}
              {(() => {
                const codigo = getConductorCodigo(conversation.phone, conductorCodigosInbox);
                return codigo ? <span className="text-emerald-600 font-medium"> [{codigo}]</span> : null;
              })()}
            </span>
            {conversation.unread > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                {conversation.unread}
              </span>
            )}
            <span className="flex-1" />
            {conversation.llamadaCount != null && conversation.llamadaCount > 0 && (
              <span className="shrink-0 flex items-center gap-0.5 text-[10px] text-blue-600 dark:text-blue-400">
                <Phone className="h-3 w-3" />
                {conversation.llamadaCount}
              </span>
            )}
            {conversation.lastSender && conversation.lastSender !== conversation.name && (
              <span className="truncate text-[11px] font-medium text-emerald-600/70 shrink-0 max-w-[140px]">
                {conversation.lastSender?.split(' ')[0]}
              </span>
            )}
          </div>
        </div>
        </div>
      </button>
    </div>
  );
});

ConversationItem.displayName = 'ConversationItem';

/* ==================== INBOX ==================== */

function InboxView({ activeId: externalActiveId, onActiveChange, isConnected }: {
  activeId: string | null;
  onActiveChange: (id: string | null) => void;
  isConnected: boolean;
}) {
  const [conversations, setConversations] = useState<FlotaConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [messagesCache, setMessagesCache] = useState<Record<string, WhatsappMessageItem[]>>({});
  const [filter, setFilter] = useState<'all' | 'unread' | 'groups'>('all');
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [creatingChat, setCreatingChat] = useState(false);
  const [conductorCodigosInbox, setConductorCodigosInbox] = useState<Record<string, string>>({});
  const firstLoad = useRef(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef(activeId);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    if (activeId) {
      void markConversationAsRead(activeId);
      setConversations(prev => prev.map(c =>
        c.id === activeId ? { ...c, unread: 0 } : c
      ));
    }
  }, [activeId]);

  useEffect(() => {
    if (externalActiveId && externalActiveId !== activeId) {
      setActiveId(externalActiveId);
      onActiveChange(null);
    }
  }, [externalActiveId]);

  useEffect(() => {
    void loadConversations();
  }, []);

  useEffect(() => {
    getConductorTelefonos().then((r) => setConductorCodigosInbox(r.codigoByTelefono)).catch(() => {});
  }, []);

  /** Socket.IO unificado: actualizar sidebar + mensajes del chat activo en tiempo real */
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) return;
    const socket = io(`${API_BASE}/whatsapp`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      void loadConversations();
    });

    socket.on('connect_error', (_err: Error) => {
      // socket connection error
    });

    socket.on('disconnect', (_reason: string) => {
      // socket disconnected
    });

    socket.on('reconnect_attempt', (_attempt: number) => {
      // socket reconnecting
    });

    socket.on('whatsapp', (payload: WhatsappSocketPayload) => {
      const currentActiveId = activeIdRef.current;

      // --- Update sidebar for active contact ---
      if (payload.contactId === currentActiveId) {
        if (payload.type === 'message') {
          setMessagesCache((prev) => {
            const existing = prev[payload.contactId] ?? [];
            const rest = existing.filter((x) => x.id !== (payload as any).item?.id && !x.id.startsWith('opt:'));
            const next = [...rest, (payload as any).item].filter(Boolean);
            next.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            return { ...prev, [payload.contactId]: next };
          });
          const now = new Date().toISOString();
          const body = (payload as any).item?.body ?? '';
          const dir = (payload as any).item?.direction ?? 'inbound';
          const senderName = (payload as any).item?.senderName ?? (payload as any).item?.fromName ?? '';
          setConversations(prev => prev.map(c =>
            c.id === payload.contactId
              ? { ...c, preview: String(body).slice(0, 100), time: now, direction: dir, unread: 0, lastSender: senderName || c.lastSender }
              : c
          ).sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()));
          if (dir === 'inbound') {
            markConversationAsRead(payload.contactId).catch(() => {});
          }
        } else if (payload.type === 'status') {
          setMessagesCache((prev) => {
            const existing = prev[payload.contactId] ?? [];
            const updated = existing.map((m) =>
              m.id === payload.id
                ? { ...m, waOutboundStatus: payload.waOutboundStatus }
                : m,
            );
            return { ...prev, [payload.contactId]: updated };
          });
        }
        return;
      }

      // --- Update sidebar for non-active contacts ---
      if (payload.type === 'message') {
        const now = new Date().toISOString();
        const body = (payload as any).item?.body ?? '';
        const direction = (payload as any).item?.direction || 'inbound';
        const senderName = (payload as any).item?.senderName ?? (payload as any).item?.fromName ?? '';
        setConversations(prev => {
          const exists = prev.some(c => c.id === payload.contactId);
          if (!exists) {
            void loadConversations();
            return prev;
          }
          return prev.map(c =>
            c.id === payload.contactId
              ? { ...c, preview: body.slice(0, 100), time: now, lastDirection: direction, unread: direction === 'inbound' ? c.unread + 1 : c.unread, lastSender: senderName || c.lastSender }
              : c
          ).sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
        });
      }
    });

    const onVis = () => {
      if (document.visibilityState === 'visible') void loadConversations();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      socketRef.current = null;
      socket.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  async function loadConversations() {
    if (firstLoad.current) {
      setLoading(true);
    }
    try {
      const data = await fetchConversations();
      setConversations(prev => {
        if (firstLoad.current) return data;
        const prevMap = new Map(prev.map(c => [c.id, c]));
        for (const d of data) {
          const existing = prevMap.get(d.id);
          if (existing) {
            prevMap.set(d.id, {
              ...existing,
              name: d.name,
              phone: d.phone,
              preview: d.preview,
              direction: d.direction,
              estado: d.estado,
              operador: d.operador,
              time: d.time > existing.time ? d.time : existing.time,
            });
          } else {
            prevMap.set(d.id, d);
          }
        }
        const merged = Array.from(prevMap.values());
        merged.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
        return merged;
      });
    } catch {
      if (firstLoad.current) {
        toast.error('No se pudieron cargar las conversaciones');
      }
    } finally {
      if (firstLoad.current) {
        setLoading(false);
        firstLoad.current = false;
      }
    }
  }

  async function handleNewChat() {
    const phone = newPhone.trim();
    const name = newName.trim() || phone;
    if (!phone) return;

    const cleanPhone = (p: string) => p.replace(/\D/g, '').slice(-9);

    const existing = conversations.find((c) => cleanPhone(c.phone) === cleanPhone(phone));
    if (existing) {
      setNewChatOpen(false);
      setNewPhone('');
      setNewName('');
      setActiveId(existing.id);
      return;
    }

    setCreatingChat(true);
    try {
      const created = await flotaProspectoCreate({ nombreCompleto: name, celular: phone });
      toast.success('Contacto creado');
      setNewChatOpen(false);
      setNewPhone('');
      setNewName('');
      await loadConversations();
      setActiveId(created.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear el contacto');
    } finally {
      setCreatingChat(false);
    }
  }

  const queryLower = useMemo(() => query.toLowerCase(), [query]);

  const filtered = useMemo(() => conversations
    .filter((c) => {
      if (filter === 'unread') return c.unread > 0;
      if (filter === 'groups') return c.phone.includes('@g.us');
      return true;
    })
    .filter((c) =>
      c.name.toLowerCase().includes(queryLower) || c.phone.includes(query),
    ), [conversations, filter, query, queryLower]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 72,
    overscan: 8,
  });

  function handleMarkRead(id: string) {
    setConversations(prev => prev.map(c =>
      c.id === id ? { ...c, unread: 0 } : c
    ));
  }

  return (
    <div className="flex flex-col h-full">
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[420px_minmax(0,1fr)]">
      <aside className="flex flex-col overflow-hidden bg-card border-r border-muted">
        <div className="border-b border-muted px-3 pb-1 pt-3">
          <div className="flex gap-1">
            {([
              ['all', 'Todos'],
              ['unread', 'No leídos'],
              ['groups', 'Grupos'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  filter === key
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="border-b border-muted px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar conversación..."
                className="pl-9"
              />
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground" onClick={() => setNewChatOpen(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto pt-1.5">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              {query ? 'Sin resultados' : 'No hay conversaciones aún'}
            </div>
          ) : (
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
              {virtualizer.getVirtualItems().map((vi) => {
                const c = filtered[vi.index];
                return (
                  <ConversationItem
                    key={c.id}
                    conversation={c}
                    isActive={activeId === c.id}
                    index={vi.index}
                    start={vi.start}
                    measureElement={virtualizer.measureElement}
                    onClick={setActiveId}
                    conductorCodigosInbox={conductorCodigosInbox}
                  />
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {activeId ? (
        <ChatPanel
          key={activeId}
          contactId={activeId}
          conversations={conversations}
          onContactUpdated={loadConversations}
          onMarkRead={handleMarkRead}
          messagesCache={messagesCache}
          setMessagesCache={setMessagesCache}
        />
      ) : (
        <div className="flex h-full items-center justify-center bg-card text-sm text-muted-foreground">
          Selecciona una conversación
        </div>
      )}

      <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nuevo mensaje</DialogTitle>
            <DialogDescription>Ingresa el número y nombre del contacto</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-phone">Número de WhatsApp</Label>
              <Input
                id="new-phone"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="51987654321"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">Con código de país, sin + ni espacios</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-name">Nombre</Label>
              <Input
                id="new-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nombre del contacto"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewChatOpen(false)} disabled={creatingChat}>Cancelar</Button>
            <Button onClick={handleNewChat} disabled={!newPhone.trim() || creatingChat}>
              {creatingChat ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Iniciar chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  </div>
  );
}

type PendingAttachment = {
  type: 'image' | 'audio' | 'document';
  file: File;
  previewUrl?: string;
  caption: string;
};

function ChatPanel({ contactId, conversations, onContactUpdated, onMarkRead, messagesCache, setMessagesCache }: {
  contactId: string;
  conversations: FlotaConversation[];
  onContactUpdated: () => void;
  onMarkRead: (id: string) => void;
  messagesCache: Record<string, WhatsappMessageItem[]>;
  setMessagesCache: React.Dispatch<React.SetStateAction<Record<string, WhatsappMessageItem[]>>>;
}) {
  const navigate = useNavigate();
  const [draft, setDraft] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const [sendingAttachment, setSendingAttachment] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [citadoDialogOpen, setCitadoDialogOpen] = useState(false);
  const [citadoDate, setCitadoDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxAttachment, setLightboxAttachment] = useState<{ id: string; name: string } | null>(null);
  const [mediaPanelOpen, setMediaPanelOpen] = useState(false);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [llamadaModalOpen, setLlamadaModalOpen] = useState(false);
  const [llamadaProspecto, setLlamadaProspecto] = useState<{ id: string; nombre: string } | null>(null);
  const [llamadaFecha, setLlamadaFecha] = useState('');
  const [llamadaHora, setLlamadaHora] = useState('');
  const [llamadaNotas, setLlamadaNotas] = useState('');
  const [llamadaSaving, setLlamadaSaving] = useState(false);
  const originalObsRef = useRef('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const convo = conversations.find((c) => c.id === contactId);
  const currentUser = useAppStore((s) => s.currentUser);
  const isOperadorRole = currentUser?.role === 'operador';
  const canAssignOperador = !isOperadorRole || !convo?.operador;
  const [prospectoData, setProspectoData] = useState<{ name: string; phone: string } | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const loadingOlderRef = useRef(false);
  const msgVirtualizerRef = useRef<any>(null);

  useEffect(() => {
    if (!contactId || convo) {
      setProspectoData(null);
      return;
    }
    api<Record<string, unknown>>(`/flota-prospectos/${contactId}`)
      .then((data) => {
        setProspectoData({
          name: String(data.nombreCompleto || ''),
          phone: String(data.celular || data.movil || ''),
        });
      })
      .catch(() => setProspectoData(null));
  }, [contactId, !!convo]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [operadores, setOperadores] = useState<OperadorUser[]>([]);

  useEffect(() => {
    fetchOperadores().then((users) => setOperadores(users)).catch(() => {});
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const isAudioFile = file.type.startsWith('audio/');
    pendingAttachmentCleanup();
    const att: PendingAttachment = {
      type: isImage ? 'image' : isAudioFile ? 'audio' : 'document',
      file,
      previewUrl: isImage ? URL.createObjectURL(file) : undefined,
      caption: '',
    };
    setPendingAttachment(att);
  }

  function pendingAttachmentCleanup() {
    setPendingAttachment((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  }

  function handleCancelAttachment() {
    pendingAttachmentCleanup();
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];
      recordingChunksRef.current = chunks;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mimeType });
        void sendAudioBlob(blob);
      };
      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch {
      toast.error('No se pudo acceder al micrófono. Permití el acceso e intentá de nuevo.');
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder?.state === 'recording') recorder.stop();
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
    setIsRecording(false);
    setRecordingDuration(0);
  }

  async function sendAudioBlob(blob: Blob) {
    const file = new File([blob], 'audio.mp3', { type: blob.type });
    try {
      const url = await uploadFlotaAudio(file);
      const optimisticId = `opt:${Date.now()}`;
      const optimistic: WhatsappMessageItem = {
        id: optimisticId,
        direction: 'outbound',
        body: '',
        fromWaId: '',
        toWaId: convo?.phone ?? '',
        createdAt: new Date().toISOString(),
        waMessageId: null,
        evoInstanceName: null,
        waOutboundStatus: 'sent',
        attachments: [{
          id: `opt-att:${Date.now()}`,
          name: 'audio.mp3',
          mimeType: 'audio/mpeg',
          size: file.size,
          mediaType: 'audio' as const,
          url,
          downloadUrl: url,
        }],
      };
      setMessagesCache((prev) => {
        const existing = prev[contactId] ?? [];
        return { ...prev, [contactId]: [...existing, optimistic] };
      });
      await sendFlotaWhatsappMessage(contactId, '', undefined, url);
      markConversationAsRead(contactId).catch(() => {});
      onMarkRead(contactId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al enviar el audio');
    }
  }

  useEffect(() => {
    if (editModalOpen && contactId) {
      void loadProspectoDetail();
    }
  }, [editModalOpen, contactId]);

  async function loadProspectoDetail() {
    try {
      const data = await api<Record<string, unknown>>(`/flota-prospectos/${contactId}`);
      const originalObs = String(data.observaciones || '');
      originalObsRef.current = originalObs;
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(data)) {
        if (v == null) continue;
        if (k === 'observaciones') {
          const entries = originalObs.split('\n---\n');
          fields[k] = entries[0].replace(/^\[.+?\]\s*/, '');
        } else {
          fields[k] = String(v);
        }
      }
      if (fields.operador) {
        fields.operador = getOperatorDisplayName(fields.operador, operadores);
      }
      setEditData(fields);
    } catch {
      toast.error('No se pudo cargar los datos del prospecto');
      setEditModalOpen(false);
    }
  }

  const loadMessages = useCallback(async (): Promise<number> => {
    if (!contactId) return 0;
    try {
      const { items, hasMore } = await fetchFlotaProspectoMessages(contactId);
      setMessagesCache(prev => {
        const existing = prev[contactId] ?? [];
        const existingIds = new Set(items.map(i => i.id));
        const deduped = existing.filter(i => !existingIds.has(i.id) && !i.id.startsWith('opt:'));
        const merged = [...deduped, ...items];
        merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        return { ...prev, [contactId]: merged };
      });
      setHasMore(hasMore);
      return items.length;
    } catch {
      toast.error('No se pudieron cargar los mensajes');
      return 0;
    }
  }, [contactId, setMessagesCache]);

  /** Carga inicial de mensajes al abrir una conversación */
  useEffect(() => {
    if (!contactId) return;
    void loadMessages();
  }, [contactId, loadMessages]);

  // Ref to avoid stale closure on messagesCache inside the scroll handler
  const messagesCacheRef = useRef(messagesCache);
  useEffect(() => { messagesCacheRef.current = messagesCache; }, [messagesCache]);

  const loadOlderMessages = useCallback(async () => {
    if (!contactId || loadingOlderRef.current || !hasMore) return;
    const current = messagesCacheRef.current[contactId] ?? [];
    if (current.length === 0) return;
    const oldest = current[0];
    if (!oldest) return;

    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const result = await fetchFlotaProspectoMessages(contactId, 30, oldest.createdAt);
      if (result.items.length === 0) {
        setHasMore(false);
        return;
      }
      const firstVisibleIndex = msgVirtualizerRef.current?.getVirtualItems()[0]?.index ?? 0;
      const insertedCount = result.items.length;

      setMessagesCache(prev => {
        const existing = prev[contactId] ?? [];
        return { ...prev, [contactId]: [...result.items, ...existing] };
      });
      setHasMore(result.hasMore);

      setTimeout(() => {
        msgVirtualizerRef.current?.scrollToIndex(firstVisibleIndex + insertedCount, { align: 'start' });
      }, 16);
    } catch {
      /* silently fail */
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [contactId, hasMore, setMessagesCache]);

  // Unified scroll handler: load older msgs on top + reset new-msg badge on bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      if (hasMore && el.scrollTop < 80) {
        void loadOlderMessages();
      }
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (dist < 100) setNewMessagesCount(0);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [loadOlderMessages, hasMore]);

  async function send() {
    const body = draft.trim();
    if (!body) return;
    const optimisticId = `opt:${Date.now()}`;
    setDraft('');
    const optimistic: WhatsappMessageItem = {
      id: optimisticId,
      direction: 'outbound',
      body,
      fromWaId: '',
      toWaId: convo?.phone ?? '',
      createdAt: new Date().toISOString(),
      waMessageId: null,
      evoInstanceName: null,
      waOutboundStatus: 'sent',
      attachments: [],
    };
    setMessagesCache((prev) => {
      const existing = prev[contactId] ?? [];
      return { ...prev, [contactId]: [...existing, optimistic] };
    });
    try {
      await sendFlotaWhatsappMessage(contactId, body);
    } catch (e) {
      setMessagesCache((prev) => {
        const existing = prev[contactId] ?? [];
        return { ...prev, [contactId]: existing.filter((x) => x.id !== optimisticId) };
      });
      setDraft(body);
      toast.error(e instanceof Error ? e.message : 'No se pudo enviar el mensaje');
      return;
    }
    markConversationAsRead(contactId).catch(() => {});
    onMarkRead(contactId);
  }

  async function handleSendAttachment() {
    const att = pendingAttachment;
    if (!att) return;
    const caption = att.caption.trim();
    setSendingAttachment(true);
    try {
      let url: string;
      if (att.type === 'image') {
        url = await uploadFlotaImage(att.file);
      } else if (att.type === 'audio') {
        url = await uploadFlotaAudio(att.file);
      } else {
        url = await uploadFlotaDocument(att.file);
      }
      const optimisticId = `opt:${Date.now()}`;
      const optimistic: WhatsappMessageItem = {
        id: optimisticId,
        direction: 'outbound',
        body: caption || '',
        fromWaId: '',
        toWaId: convo?.phone ?? '',
        createdAt: new Date().toISOString(),
        waMessageId: null,
        evoInstanceName: null,
        waOutboundStatus: 'sent',
        attachments: [{
          id: `opt-att:${Date.now()}`,
          name: att.file.name,
          mimeType: att.file.type,
          size: att.file.size,
          mediaType: att.type === 'image' ? 'image' as const : att.type === 'audio' ? 'audio' as const : 'document' as const,
          url,
          downloadUrl: url,
        }],
      };
      setMessagesCache((prev) => {
        const existing = prev[contactId] ?? [];
        return { ...prev, [contactId]: [...existing, optimistic] };
      });
      await sendFlotaWhatsappMessage(
        contactId,
        caption || '',
        att.type === 'image' ? url : undefined,
        att.type === 'audio' ? url : undefined,
        att.type === 'document' ? url : undefined,
        att.type === 'document' ? att.file.name : undefined,
        att.type === 'document' ? att.file.type : undefined,
      );
      markConversationAsRead(contactId).catch(() => {});
      onMarkRead(contactId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo enviar el archivo');
    } finally {
      setSendingAttachment(false);
      pendingAttachmentCleanup();
    }
  }

  const messages = messagesCache[contactId] ?? [];

  const messageItems = useMemo(() => {
    const items: Array<{ type: 'date'; key: string; label: string } | { type: 'message'; key: string; msg: WhatsappMessageItem; mine: boolean }> = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const formatDateLabel = (date: Date) => {
      if (date.getTime() === today.getTime()) return 'Hoy';
      if (date.getTime() === yesterday.getTime()) return 'Ayer';
      return date.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
    };

    const grouped: { date: Date; msgs: WhatsappMessageItem[] }[] = [];
    let currentDate: Date | null = null;
    let currentGroup: WhatsappMessageItem[] = [];

    for (const m of messages) {
      const msgDate = new Date(m.createdAt);
      msgDate.setHours(0, 0, 0, 0);
      if (!currentDate || msgDate.getTime() !== currentDate.getTime()) {
        if (currentGroup.length > 0) grouped.push({ date: currentDate!, msgs: currentGroup });
        currentDate = msgDate;
        currentGroup = [m];
      } else {
        currentGroup.push(m);
      }
    }
    if (currentGroup.length > 0) grouped.push({ date: currentDate!, msgs: currentGroup });

    for (const g of grouped) {
      items.push({ type: 'date', key: `d-${g.date.getTime()}`, label: formatDateLabel(g.date) });
      for (const m of g.msgs) {
        items.push({ type: 'message', key: m.id, msg: m, mine: m.direction === 'outbound' });
      }
    }
    return items;
  }, [messages]);

  const msgVirtualizer = useVirtualizer({
    count: messageItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 60,
    measureElement: (el) => el.getBoundingClientRect().height,
    overscan: 5,
  });

  useEffect(() => {
    msgVirtualizerRef.current = msgVirtualizer;
  }, [msgVirtualizer]);

  const hasInitialScrolledRef = useRef(false);
  const prevLenRef = useRef(0);
  const [newMessagesCount, setNewMessagesCount] = useState(0);

  useEffect(() => {
    hasInitialScrolledRef.current = false;
    prevLenRef.current = 0;
    setNewMessagesCount(0);
  }, [contactId]);

  useEffect(() => {
    const len = messageItems.length;
    if (len === 0) return;
    const container = scrollRef.current;

    if (!hasInitialScrolledRef.current) {
      // First load: scroll to bottom via virtualizer (avoids race with measured sizes)
      hasInitialScrolledRef.current = true;
      prevLenRef.current = len;
      requestAnimationFrame(() => {
        msgVirtualizerRef.current?.scrollToIndex(len - 1, { align: 'end' });
      });
      return;
    }

    // Only react to genuinely new messages (not reloads of the same batch)
    if (len <= prevLenRef.current) {
      prevLenRef.current = len;
      return;
    }
    prevLenRef.current = len;

    const distanceFromBottom = container
      ? container.scrollHeight - container.scrollTop - container.clientHeight
      : 0;

    if (distanceFromBottom < 200) {
      requestAnimationFrame(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      });
    } else {
      setNewMessagesCount((c) => c + 1);
    }
  }, [messageItems.length, contactId]);

  async function handleSaveProspecto() {
    if (!editData.nombreCompleto?.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    setSaving(true);
    const body: Record<string, unknown> = {};
    const allowedFields = ['nombreCompleto', 'celular', 'movil', 'edad', 'distrito', 'modalidad', 'redSocial', 'anioVehiculo', 'observaciones', 'estado'];
    for (const k of allowedFields) {
      const v = editData[k];
      if (k === 'edad' || k === 'anioVehiculo') {
        const num = parseInt(v, 10);
        if (!isNaN(num)) body[k] = num;
      } else if (k === 'esDuplicado') {
        body[k] = v === 'true' ? true : v === 'false' ? false : undefined;
      } else if (k === 'observaciones') {
        const currentLatest = originalObsRef.current.split('\n---\n')[0].replace(/^(?:\[.+?\]\s*)+/, '');
        if (v?.trim() && v.trim() !== currentLatest) {
          const dateStr = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });
          body[k] = `[${dateStr}] ${v.trim()}\n---\n${originalObsRef.current}`;
        } else {
          body[k] = originalObsRef.current || v?.trim() || null;
        }
      } else if (v?.trim()) {
        body[k] = v.trim();
      }
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
    if (nuevoEstado === 'Citado') {
      setCitadoDate(editData.fechaCita ? editData.fechaCita.split('T')[0] : '');
      setCitadoDialogOpen(true);
      return;
    }
    try {
      await api(`/flota-prospectos/${contactId}`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      toast.success(`Estado actualizado a ${formatStatus(nuevoEstado)}`);
      onContactUpdated();
      try { new BroadcastChannel("flota-prospectos").postMessage({ type: "refresh" }); } catch {}
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo actualizar el estado');
    }
  }

  async function handleCambiarOperador(nuevoOperador: string) {
    if (!contactId) return;
    try {
      await api(`/flota-prospectos/${contactId}/operador`, {
        method: 'PATCH',
        body: JSON.stringify({ operador: nuevoOperador || null }),
      });
      toast.success(nuevoOperador ? `Operador asignado: ${nuevoOperador}` : 'Operador removido');
      onContactUpdated();
      try { new BroadcastChannel("flota-prospectos").postMessage({ type: "refresh" }); } catch {}
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo asignar operador');
    }
  }

  return (
    <div className="flex h-full min-h-0 min-w-0">
      <section className={cn("flex flex-col flex-1 min-w-0 overflow-hidden bg-card relative transition-all", mediaPanelOpen ? "hidden xl:flex" : "")}>
        <div className="flex items-center justify-between border-b border-muted px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
              {(convo?.name || prospectoData?.name || '??').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold leading-tight">{convo?.name || prospectoData?.name || 'Desconocido'}</p>
              <p className="truncate text-xs text-muted-foreground">
                {convo?.phone || prospectoData?.phone || ''}
                {convo?.llamadaCount != null && convo.llamadaCount > 0 && (
                  <span className="ml-2 inline-flex items-center gap-0.5 text-[10px]">
                    <Phone className="h-2.5 w-2.5" />
                    {convo.llamadaCount}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => {
              if (!contactId) return;
              const now = new Date();
              setLlamadaProspecto({ id: contactId, nombre: convo?.name || prospectoData?.name || '' });
              setLlamadaFecha(now.toISOString().split('T')[0]);
              setLlamadaHora(now.toTimeString().split(' ')[0].substring(0, 5));
              setLlamadaNotas('');
              setLlamadaModalOpen(true);
            }}>
              <Phone className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate(`/flota/prospectos/${contactId}`)}>
              <Info className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setEditModalOpen(true)}>
              <Edit2 className="h-4 w-4" />
            </Button>
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                  getTagStyle(convo?.estado)
                    ? getTagStyle(convo?.estado)
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
          <DropdownMenu open={canAssignOperador ? undefined : false}>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                  !canAssignOperador && 'cursor-not-allowed opacity-50',
                  convo?.operador
                    ? 'border-sky-500/30 bg-sky-500/10 text-sky-700 hover:bg-sky-500/20'
                    : 'border-input bg-background text-muted-foreground hover:bg-muted',
                )}
                disabled={!canAssignOperador}
              >
                {convo?.operador && !canAssignOperador ? (
                  <Lock className="mr-1 inline-block size-3" />
                ) : null}
                {getOperatorDisplayName(convo?.operador, operadores) || 'Operador'}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {convo?.operador && (
                <DropdownMenuItem onClick={() => handleCambiarOperador('')}>
                  Sin operador
                </DropdownMenuItem>
              )}
              {operadores.map((op) => (
                <DropdownMenuItem key={op.id} onClick={() => handleCambiarOperador(op.name)}>
                  {op.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
            <Button variant="ghost" size="icon" onClick={() => setMediaPanelOpen(!mediaPanelOpen)} className={mediaPanelOpen ? 'bg-muted' : ''}>
              <PanelRight className="h-4 w-4" />
            </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden bg-[radial-gradient(circle_at_1px_1px,theme(colors.muted.foreground/0.08)_1px,transparent_0)] [background-size:18px_18px] px-4 py-5"
      >
        {messageItems.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No hay mensajes aún
          </div>
        ) : (
          <div style={{ height: msgVirtualizer.getTotalSize(), position: 'relative' }}>
            {msgVirtualizer.getVirtualItems().map((vi) => {
              const item = messageItems[vi.index];
              return (
                <div
                  key={item.key}
                  data-index={vi.index}
                  ref={msgVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${vi.start}px)`,
                  }}
                >
                  {item.type === 'date' ? (
                    <div className="my-3 flex items-center gap-3">
                      <div className="h-px flex-1 border-t border-muted/40" />
                      <span className="text-[11px] font-medium capitalize text-muted-foreground">
                        {item.label}
                      </span>
                      <div className="h-px flex-1 border-t border-muted/40" />
                    </div>
                  ) : (
                    <div className={cn('flex mb-2 w-full', item.mine ? 'justify-end' : 'justify-start')}>
                      <div
                        className={cn(
                          'max-w-[85%] min-w-0 rounded-2xl px-4 py-2.5 text-sm shadow-sm',
                          item.mine
                            ? 'rounded-br-sm bg-primary text-primary-foreground'
                            : 'rounded-bl-sm bg-muted text-foreground',
                        )}
                      >
                        {item.msg.attachments?.map((attachment) => (
                          <MessageAttachment
                            key={attachment.id}
                            attachment={attachment}
                            mine={item.mine}
                            setLightboxUrl={setLightboxUrl}
                          />
                        ))}
                        {item.msg.body && (!item.msg.attachments?.length || !['[Imagen]', '[Documento]', '[Video]', '[Audio]'].includes(item.msg.body.trim())) && (
                          <p className="whitespace-pre-wrap break-words">{item.msg.body}</p>
                        )}
                        <div className={cn('mt-1 flex items-center justify-end gap-1 text-[10px]', item.mine ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                          <span>{new Date(item.msg.createdAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</span>
                          {item.mine && <CheckCheck className={cn('h-3 w-3', item.msg.waOutboundStatus === 'read' ? 'text-sky-300' : '')} />}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {newMessagesCount > 0 && (
        <button
          onClick={() => {
            msgVirtualizer.scrollToIndex(messageItems.length - 1, { align: 'end' });
            setNewMessagesCount(0);
          }}
          className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground shadow-lg transition-all hover:bg-primary/90"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          {newMessagesCount} {newMessagesCount === 1 ? 'nuevo' : 'nuevos'}
          <ArrowDown className="h-3.5 w-3.5" />
        </button>
      )}

      {pendingAttachment ? (
        <div className="border-t border-muted bg-background/60">
          <div className="flex items-center justify-between border-b border-muted/50 px-4 py-2">
            <span className="text-sm font-medium">
              {pendingAttachment.type === 'image' ? 'Enviar foto' : pendingAttachment.type === 'audio' ? 'Enviar audio' : 'Enviar documento'}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCancelAttachment} disabled={sendingAttachment}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-4">
            {pendingAttachment.type === 'image' && pendingAttachment.previewUrl && (
              <img src={pendingAttachment.previewUrl} alt="Preview" className="max-h-64 rounded-lg object-contain" />
            )}
            {pendingAttachment.type === 'audio' && (
              <div className="flex items-center gap-3 rounded-lg bg-muted/30 px-4 py-3">
                <Music2 className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{pendingAttachment.file.name}</span>
              </div>
            )}
            {pendingAttachment.type === 'document' && (
              <div className="flex items-center gap-3 rounded-lg bg-muted/30 px-4 py-3">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate max-w-[300px]">{pendingAttachment.file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(pendingAttachment.file.size)}</p>
                </div>
              </div>
            )}
            <div className="flex w-full items-end gap-2">
              <Textarea
                value={pendingAttachment.caption}
                onChange={(e) => setPendingAttachment((prev) => prev ? { ...prev, caption: e.target.value } : null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSendAttachment();
                  }
                }}
                placeholder="Añade un mensaje..."
                className="min-h-[44px] max-h-32 resize-none flex-1"
                rows={1}
                disabled={sendingAttachment}
              />
              <Button onClick={() => void handleSendAttachment()} disabled={sendingAttachment} className="shrink-0">
                {sendingAttachment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      ) : (
      <div
        className="border-t border-muted bg-background/60 p-3"
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const file = e.dataTransfer.files?.[0];
          if (!file) return;
          handleCancelAttachment();
          const isImage = file.type.startsWith('image/');
          const isAudioFile = file.type.startsWith('audio/');
          setPendingAttachment({
            type: isImage ? 'image' : isAudioFile ? 'audio' : 'document',
            file,
            previewUrl: isImage ? URL.createObjectURL(file) : undefined,
            caption: '',
          });
        }}
      >
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
        />
        <div className="flex items-end gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <Paperclip className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top">
              <DropdownMenuItem onClick={() => imageInputRef.current?.click()}>
                <ImageIcon className="mr-2 h-4 w-4" /> Foto
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { if (fileInputRef.current) { fileInputRef.current.accept = 'audio/*'; fileInputRef.current.click(); fileInputRef.current.accept = ''; } }}>
                <Music2 className="mr-2 h-4 w-4" /> Audio
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <FileText className="mr-2 h-4 w-4" /> Documento
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {isRecording ? (
            <div className="flex flex-1 items-center gap-2 rounded-lg border bg-destructive/5 px-3 py-2">
              <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
                Grabando...
              </div>
              <span className="text-sm tabular-nums text-muted-foreground">
                {Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, '0')}
              </span>
              <div className="flex-1" />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="shrink-0 text-destructive hover:text-destructive"
                onClick={stopRecording}
              >
                <StopCircle className="h-5 w-5" />
              </Button>
            </div>
          ) : (
            <>
              <Button variant="ghost" size="icon" className="shrink-0" onClick={() => void startRecording()}>
                <Mic className="h-5 w-5" />
              </Button>
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
              </>
              )}
            </div>
          </div>
        )}

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
              <Select
                value={editData.operador || '__none__'}
                onValueChange={(v) => setEditData((prev) => ({ ...prev, operador: v === '__none__' ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin operador" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin operador</SelectItem>
                  {operadores.map((op) => (
                    <SelectItem key={op.id} value={op.name}>
                      {op.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      <Dialog open={!!lightboxUrl} onOpenChange={() => { setLightboxUrl(null); setLightboxAttachment(null); }}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 border-0 bg-black/95">
          <button
            type="button"
            onClick={() => { setLightboxUrl(null); setLightboxAttachment(null); }}
            className="absolute right-3 top-3 z-10 rounded-full bg-white/10 p-1.5 text-white hover:bg-white/20 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!lightboxAttachment) return;
              try {
                await downloadWhatsappAttachment({
                  id: lightboxAttachment.id,
                  name: lightboxAttachment.name,
                  url: lightboxUrl ?? undefined,
                });
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Error al descargar');
              }
            }}
            className="absolute right-12 top-3 z-10 rounded-full bg-white/10 p-1.5 text-white hover:bg-white/20 transition-colors"
            title="Descargar imagen"
          >
            <Download className="h-5 w-5" />
          </button>
          {lightboxUrl && (
            <img
              src={lightboxUrl}
              alt="Vista ampliada"
              className="max-h-[85vh] w-full object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
      </section>

      {mediaPanelOpen && (
        <aside className="w-full xl:w-[320px] shrink-0 flex flex-col overflow-hidden bg-card animate-in slide-in-from-right-4">
          <div className="flex items-center justify-between border-b border-muted px-5 py-[13px]">
            <h3 className="text-sm font-semibold">Archivos del chat</h3>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMediaPanelOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto bg-muted/20 p-4">
             {(() => {
                const allAttachments = messages.flatMap(m => m.attachments || []).filter(a => a.url || a.downloadUrl || a.proxyUrl);
                if (allAttachments.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <ImageIcon className="mb-3 h-10 w-10 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">No hay archivos en este chat</p>
                    </div>
                  );
                }
                return (
                  <div className="flex flex-col gap-2">
                    {allAttachments.map(a => (
                       <MessageAttachment key={a.id} attachment={a} mine={false} setLightboxUrl={setLightboxUrl} />
                    ))}
                  </div>
                );
             })()}
          </div>
        </aside>
      )}

      <Dialog open={citadoDialogOpen} onOpenChange={setCitadoDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Programar cita</DialogTitle>
            <DialogDescription>Ingresa la fecha de la cita para este prospecto.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="date"
              value={citadoDate}
              onChange={(e) => setCitadoDate(e.target.value)}
              className="w-full"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCitadoDialogOpen(false)}>Cancelar</Button>
            <Button onClick={async () => {
              if (!citadoDate) { toast.error('Selecciona una fecha'); return; }
              try {
                await api(`/flota-prospectos/${contactId}`, {
                  method: 'PATCH',
                  body: JSON.stringify({ estado: 'Citado', fechaCita: citadoDate }),
                });
                toast.success('Cita programada');
                setCitadoDialogOpen(false);
                onContactUpdated();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Error al guardar');
              }
            }} disabled={!citadoDate}>
              Guardar cita
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={llamadaModalOpen} onOpenChange={(open) => { if (!open) setLlamadaModalOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar llamada</DialogTitle>
            <DialogDescription>
              {llamadaProspecto?.nombre ? `Prospecto: ${llamadaProspecto.nombre}` : 'Fecha y hora de la llamada'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Fecha</label>
                <Input
                  type="date"
                  value={llamadaFecha}
                  onChange={(e) => setLlamadaFecha(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Hora</label>
                <Input
                  type="time"
                  value={llamadaHora}
                  onChange={(e) => setLlamadaHora(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Notas / Comentarios</label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Comentarios sobre la llamada..."
                value={llamadaNotas}
                onChange={(e) => setLlamadaNotas(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLlamadaModalOpen(false)} disabled={llamadaSaving}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (!llamadaProspecto) return;
                setLlamadaSaving(true);
                try {
                  const fechaHora = `${llamadaFecha}T${llamadaHora}:00`;
                  await flotaLlamadaCreate(llamadaProspecto.id, {
                    notas: llamadaNotas.trim() || null,
                    createdAt: new Date(fechaHora).toISOString(),
                  });
                  toast.success('Llamada registrada');
                  setLlamadaModalOpen(false);
                } catch {
                  toast.error('No se pudo registrar la llamada');
                } finally {
                  setLlamadaSaving(false);
                }
              }}
              disabled={!llamadaNotas.trim() || llamadaSaving}
            >
              {llamadaSaving ? <Loader2 className="size-4 animate-spin" /> : <Phone className="size-4" />}
              {llamadaSaving ? 'Guardando...' : 'Registrar llamada'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ==================== MASIVO ==================== */

function MasivoView({ isConnected, masivoConnected = false, onConnectClick }: { isConnected: boolean; masivoConnected?: boolean; onConnectClick: () => void }) {
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
  const [estadoFilter, setEstadoFilter] = useState<string>('');
  const [selectedPage, setSelectedPage] = useState(1);
  const SELECTED_PAGE_SIZE = 50;
  const [sending, setSending] = useState(false);
  const [masivoSubTab, setMasivoSubTab] = useState<'history' | 'new'>('history');
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
    paused: boolean;
  } | null>(null);
  const cancelRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bulkJobIdRef = useRef<string | null>(null);
  const bulkSocketRef = useRef<ReturnType<typeof io> | null>(null);
  const masivoExcelScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedIds(new Set());
    void loadContacts();
  }, []);

  useEffect(() => {
    setSelectedIds(new Set());
    void loadContacts();
  }, [estadoFilter]);

  // Check for pending bulk job on mount
  useEffect(() => {
    const saved = localStorage.getItem('flotaBulkJobId');
    if (!saved) return;
    getFlotaBulkProgress(saved).then((p) => {
      if (p && !p.finished && !p.cancelled) {
        connectBulkSocket(saved, p);
      } else {
        localStorage.removeItem('flotaBulkJobId');
      }
    }).catch(() => localStorage.removeItem('flotaBulkJobId'));
    return () => {
      bulkSocketRef.current?.disconnect();
    };
  }, []);

  async function loadContacts() {
    setLoadingContacts(true);
    try {
      const data = await fetchMasivoProspectos(undefined, estadoFilter || undefined);
      const mapped: FlotaConversation[] = data.map((p) => ({
        id: p.id,
        name: p.nombreCompleto,
        phone: p.celular ?? p.movil ?? '',
        preview: '',
        time: new Date().toISOString(),
        direction: 'outbound',
        unread: 0,
        estado: p.estado ?? undefined,
      }));
      setContacts(mapped);
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

  const masivoExcelVirtualizer = useVirtualizer({
    count: source === 'excel' ? (filtered as FlotaExcelContact[]).length : 0,
    getScrollElement: () => masivoExcelScrollRef.current,
    estimateSize: () => 48,
    overscan: 5,
  });

  const selectedPageCount = Math.ceil(selected.length / SELECTED_PAGE_SIZE);
  const safePage = Math.max(1, selectedPageCount <= 0 ? 1 : selectedPage > selectedPageCount ? selectedPageCount : selectedPage);
  const paginatedSelected = selected.slice((safePage - 1) * SELECTED_PAGE_SIZE, safePage * SELECTED_PAGE_SIZE);

  // Reset page when source changes or page exceeds available pages
  useEffect(() => {
    setSelectedPage(1);
  }, [source]);
  
  useEffect(() => {
    if (selectedPage > selectedPageCount && selectedPageCount > 0) {
      setSelectedPage(selectedPageCount);
    }
  }, [selectedPageCount, selectedPage]);

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

  function connectBulkSocket(jobId: string, existing?: { total: number; sent: number; failed: number; currentName: string; currentIndex: number; nextDelay: number; paused: boolean }) {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    if (existing) {
      setSending(true);
      setBulkProgress({
        total: existing.total,
        sent: existing.sent,
        failed: existing.failed,
        currentName: existing.currentName,
        currentIndex: existing.currentIndex,
        nextDelay: existing.nextDelay,
        paused: existing.paused,
      });
    }
    const socket = io(`${API_BASE}/whatsapp`, { auth: { token }, transports: ['websocket', 'polling'] });
    socket.emit('join-bulk', { jobId });
    socket.on('flota-bulk-progress', (p: { total: number; sent: number; failed: number; currentName: string; currentIndex: number; nextDelay: number; finished: boolean; cancelled: boolean; paused: boolean }) => {
      setBulkProgress({
        total: p.total,
        sent: p.sent,
        failed: p.failed,
        currentName: p.currentName,
        currentIndex: p.currentIndex,
        nextDelay: p.nextDelay,
        paused: p.paused,
      });
      if (p.finished || p.cancelled) {
        setSending(false);
        socket.disconnect();
        localStorage.removeItem('flotaBulkJobId');
        if (p.cancelled) {
          toast.success(`Envío cancelado. Enviado: ${p.sent} · Fallidos: ${p.failed}`);
        } else {
          toast.success(`Envío completado. Enviado: ${p.sent} · Fallidos: ${p.failed}`);
        }
        setSelectedIds(new Set());
        setStep(1);
        setMasivoSubTab('history');
      }
    });
    bulkSocketRef.current = socket;
    bulkJobIdRef.current = jobId;
  }

  async function handleSend() {
    if (!isConnected && !masivoConnected) {
      onConnectClick();
      return;
    }
    const targets = effectiveContactsToSend();
    if (targets.length === 0) {
      toast.error(source === null ? 'Selecciona una fuente primero.' : source === 'excel' ? 'Ningún contacto del Excel tiene coincidencia en el CRM.' : 'Selecciona al menos un contacto.');
      return;
    }
    const prospectoIds: string[] = [];
    for (const t of targets) {
      const id = t.contactId || t.flotaProspectoId;
      if (id) prospectoIds.push(id);
    }
    if (prospectoIds.length === 0) {
      toast.error('Ninguno de los contactos seleccionados tiene un prospecto asignado en el sistema.');
      return;
    }

    setSending(true);
    setBulkProgress({ total: prospectoIds.length, sent: 0, failed: 0, currentName: '', currentIndex: 0, nextDelay: 0, paused: false });

    try {
      const { jobId } = await sendFlotaBulk({ prospectoIds, text: message.trim(), imageUrl: imageUrl || undefined });
      localStorage.setItem('flotaBulkJobId', jobId);
      connectBulkSocket(jobId);
      toast.success(`Envío masivo de ${prospectoIds.length} mensajes iniciado en segundo plano`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al iniciar el envío');
      setSending(false);
      setBulkProgress(null);
    }
  }

  function cancelBulkSend() {
    const jobId = bulkJobIdRef.current;
    if (jobId) {
      cancelFlotaBulk(jobId).catch(() => {});
    }
    bulkSocketRef.current?.disconnect();
    setSending(false);
    setBulkProgress(null);
    localStorage.removeItem('flotaBulkJobId');
  }

  if (!isConnected && !masivoConnected) {
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
    <div className="flex flex-col flex-1 min-h-0">
      {masivoSubTab === 'new' ? (<>
      <div className="flex items-center justify-center border-b border-muted px-6 py-3 shrink-0 text-xs font-medium">
        {[
          { n: 1, label: 'Audiencia', icon: Users },
          { n: 2, label: 'Mensaje', icon: MessageSquare },
          { n: 3, label: 'Revisión', icon: CheckCircle2 },
        ].map((s) => {
          const Icon = s.icon;
          const active = step === s.n;
          const done = step > s.n;
          return (
            <div key={s.n} className="flex items-center gap-2">
              <div
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  active ? 'bg-primary text-primary-foreground' : done ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {s.label}
              </div>
              {s.n < 3 && (
                <div className={cn(
                  'h-px w-8',
                  done ? 'bg-primary/40' : 'bg-border',
                )} />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {step === 1 && (
          <div className="grid lg:grid-cols-[400px_1fr] min-h-full">
            <div className="space-y-5 border-r border-muted p-6">
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
              ) : source === 'crm' ? (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Filtrar por estado</label>
                    <div className="flex flex-wrap gap-1">
                      <button
                        onClick={() => setEstadoFilter('')}
                        className={cn(
                          'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                          !estadoFilter
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                      >
                        Todos
                      </button>
                      {ESTADOS.map((est) => (
                        <button
                          key={est}
                          onClick={() => setEstadoFilter(estadoFilter === est ? '' : est)}
                          className={cn(
                            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                            estadoFilter === est
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                            getTagStyle(est) && estadoFilter !== est ? getTagStyle(est) : '',
                          )}
                        >
                          {formatStatus(est)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border bg-muted/40 p-4">
                    <p className="text-xs font-medium text-muted-foreground">Contactos disponibles</p>
                    <p className="mt-1 text-3xl font-bold text-primary">{contacts.length}</p>
                    <Button
                      className="mt-3 w-full"
                      onClick={() => setSelectedIds(new Set(contacts.map((c) => c.id!)))}
                      disabled={contacts.length === 0}
                    >
                      <Plus className="mr-1 h-4 w-4" /> Agregar todos ({contacts.length})
                    </Button>
                  </div>
                </>
              ) : null}
            </div>

            <div className="flex flex-col min-h-0 p-6">
              {source === 'excel' && excelContacts.length > 0 ? (
                <>
                  <div className="flex items-center justify-between border-b border-muted p-4">
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
                  <div className="border-b border-muted px-4 py-3">
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar por nombre o teléfono..."
                      className="h-8 text-xs"
                    />
                  </div>
                  <div ref={masivoExcelScrollRef} className="max-h-96 overflow-y-auto rounded-lg border">
                    <div className="bg-muted/50 sticky top-0 z-10 flex items-center border-b border-muted px-4 h-10 text-xs font-medium text-muted-foreground">
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
                      <span className="ml-3 flex-1">Nombre</span>
                      <span className="flex-1">Teléfono</span>
                      <span className="flex-1">CRM</span>
                    </div>
                    {filtered.length === 0 ? (
                      <div className="py-12 text-center text-sm text-muted-foreground">
                        Sin resultados
                      </div>
                    ) : (
                      <div style={{ height: masivoExcelVirtualizer.getTotalSize(), position: 'relative' }}>
                        {masivoExcelVirtualizer.getVirtualItems().map((vi) => {
                          const c = (filtered as FlotaExcelContact[])[vi.index]!;
                          const on = selectedIds.has(c.phone);
                          return (
                            <div
                              key={c.phone}
                              style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vi.start}px)` }}
                              className={cn('flex items-center border-b px-4 h-12 text-sm hover:bg-muted/50', on && 'bg-primary/5')}
                            >
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
                              <span className="ml-3 flex-1 font-medium truncate">{c.name}</span>
                              <span className="flex-1 truncate">{c.phone}</span>
                              <span className="flex-1">
                                {c.contactId ? (
                                  <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">Coincide</span>
                                ) : (
                                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">Sin CRM</span>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              ) : source === 'excel' ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <FileSpreadsheet className="mb-3 h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Importa un archivo Excel para ver los contactos</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between border-b border-muted p-4 shrink-0">
                    <div>
                      <h3 className="font-semibold">Destinatarios seleccionados</h3>
                      <p className="text-xs text-muted-foreground">{selected.length} contactos</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => { setSelectedIds(new Set()); setSelectedPage(1); }}>
                      Eliminar seleccionados
                    </Button>
                  </div>
                  <div className="flex-1 min-h-0 overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-xs text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium">Nombre</th>
                          <th className="px-4 py-2 text-left font-medium">Teléfono</th>
                          {source === 'crm' && <th className="px-4 py-2 text-left font-medium">Estado</th>}
                        </tr>
                      </thead>
                      <tbody key={`${source}-${selectedIds.size}`}>
                        {selected.length === 0 ? (
                          <tr>
                            <td colSpan={source === 'crm' ? 3 : 2} className="px-4 py-12 text-center text-sm text-muted-foreground">
                              Selecciona contactos desde el panel izquierdo
                            </td>
                          </tr>
                        ) : (
                          paginatedSelected.map((c) => {
                            const isCrm = source === 'crm';
                            const convo = c as FlotaConversation;
                            const excelC = c as FlotaExcelContact;
                            return (
                              <tr key={isCrm ? convo.id : excelC.phone} className="border-t">
                                <td className="px-4 py-3 font-medium">{c.name}</td>
                                <td className="px-4 py-3 text-muted-foreground">{isCrm ? convo.phone : excelC.phone}</td>
                                {isCrm && (
                                  <td className="px-4 py-3">
                                    {convo.estado && (
                                      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', getTagStyle(convo.estado))}>
                                        {formatStatus(convo.estado)}
                                      </span>
                                    )}
                                  </td>
                                )}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  {selectedPageCount > 1 && (
                    <div className="flex items-center justify-between border-t border-muted px-4 py-2 text-xs text-muted-foreground shrink-0">
                      <span>
                        {(selectedPage - 1) * SELECTED_PAGE_SIZE + 1}–{Math.min(selectedPage * SELECTED_PAGE_SIZE, selected.length)} de {selected.length}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={selectedPage <= 1}
                          onClick={() => setSelectedPage((p) => Math.max(1, p - 1))}
                        >
                          <ArrowLeft className="h-3 w-3" />
                        </Button>
                        <span className="px-2 font-medium">{selectedPage} / {selectedPageCount}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={selectedPage >= selectedPageCount}
                          onClick={() => setSelectedPage((p) => Math.min(selectedPageCount, p + 1))}
                        >
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px] p-6">
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
          <div className="grid gap-0 lg:grid-cols-[1fr_580px] min-h-full"> 
            <div className="flex flex-col border-r border-muted p-6">
              <div className="space-y-5 flex-1 mx-auto max-w-xl w-full">
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
            </div>

            <div className="flex items-center justify-center p-6">
              <div className="space-y-3 max-w-sm w-full">
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
          </div>
        )}

        {step === 3 && bulkProgress && (
          <div className="mx-auto max-w-2xl space-y-5 p-6">
            <div>
              <h3 className="font-semibold">
                {bulkProgress.paused ? 'Envío masivo pausado' : 'Enviando campaña masiva'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {bulkProgress.paused ? 'Reanuda para continuar.' : 'No cierres esta pestaña hasta que termine'}
              </p>
            </div>

            <div className="rounded-lg border bg-muted/30 p-5 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progreso</span>
                <span className="font-semibold">{bulkProgress.sent + bulkProgress.failed} de {bulkProgress.total}</span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    bulkProgress.paused ? 'bg-amber-500' : 'bg-primary',
                  )}
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

              <div className="flex gap-2">
                {bulkProgress.paused ? (
                  <Button
                    variant="outline"
                    className="flex-1 border-emerald-500/30 text-emerald-700 hover:bg-emerald-50"
                    onClick={() => {
                      const jobId = bulkJobIdRef.current;
                      if (jobId) {
                        resumeFlotaBulk(jobId).catch(() => {});
                        setBulkProgress((prev) => prev ? { ...prev, paused: false } : null);
                        toast.success('Envío reanudado');
                      }
                    }}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Reanudar envío
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="flex-1 border-amber-500/30 text-amber-700 hover:bg-amber-50"
                    onClick={() => {
                      const jobId = bulkJobIdRef.current;
                      if (jobId) {
                        pauseFlotaBulk(jobId).catch(() => {});
                        setBulkProgress((prev) => prev ? { ...prev, paused: true } : null);
                        toast.success('Envío pausado');
                      }
                    }}
                  >
                    <Pause className="mr-2 h-4 w-4" />
                    Pausar envío
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                  onClick={cancelBulkSend}
                >
                  <StopCircle className="mr-2 h-4 w-4" />
                  Cancelar envío
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {!bulkProgress && (
        <div className="flex items-center justify-between border-t border-muted bg-muted/30 px-6 py-4 shrink-0">
          <Button variant="outline" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Anterior
          </Button>
          {step < 3 ? (
            <Button onClick={() => setStep((s) => Math.min(3, s + 1))} disabled={step === 1 && selectedIds.size === 0}>
              Siguiente <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button variant="outline" onClick={() => { setStep(1); setCampaignName(''); setMessage(''); setSelectedIds(new Set()); setMasivoSubTab('history'); }}>
              Nueva campaña
            </Button>
          )}
        </div>
      )}
      </>) : (
        <MasivoHistoryView onCreateNew={() => setMasivoSubTab('new')} />
      )}
    </div>
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

/* ==================== CONEXIONES ==================== */

function ConexionesView({ onConnectInstance }: { onConnectInstance?: (inst: FlotaInstanceDetail) => void }) {
  const [instancias, setInstancias] = useState<FlotaInstanceDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newInstancia, setNewInstancia] = useState({ nombre: '', token: '' });
  const [inboxId, setInboxId] = useState<string | null>(null);
  const [masivoIds, setMasivoIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchFlotaInstances();
      setInstancias(data);
      setInboxId(data.find((i) => i.useForInbox)?.id ?? null);
      setMasivoIds(new Set(data.filter((i) => i.useForMasivo).map((i) => i.id)));
    } catch { toast.error('No se pudieron cargar las conexiones'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const handleCreate = useCallback(async () => {
    if (!newInstancia.nombre.trim()) return;
    setCreating(true);
    try {
      await createFlotaInstance(newInstancia.nombre.trim(), newInstancia.token.trim() || undefined);
      toast.success('Instancia creada');
      setCreateModalOpen(false);
      setNewInstancia({ nombre: '', token: '' });
      setLoading(true);
      setInstancias(await fetchFlotaInstances());
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Error al crear'); }
    finally { setCreating(false); setLoading(false); }
  }, [newInstancia]);

  const handleConnect = useCallback((inst: FlotaInstanceDetail) => onConnectInstance?.(inst), [onConnectInstance]);

  const handleDisconnect = useCallback(async (id: string) => {
    setBusyId(id);
    try {
      await disconnectFlotaInstance(id);
      toast.success('Instancia desconectada');
      setLoading(true);
      setInstancias(await fetchFlotaInstances());
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Error al desconectar'); }
    finally { setBusyId(null); setLoading(false); }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!window.confirm('¿Eliminar esta instancia definitivamente?')) return;
    setBusyId(id);
    try {
      await deleteFlotaInstance(id);
      toast.success('Instancia eliminada');
      setLoading(true);
      setInstancias(await fetchFlotaInstances());
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Error al eliminar'); }
    finally { setBusyId(null); setLoading(false); }
  }, []);

  return (
    <div className="flex flex-col h-full p-6 overflow-y-auto scrollbar-thin">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Conexiones WhatsApp</h2>
          <p className="text-sm text-muted-foreground mt-1">Gestioná las líneas de WhatsApp conectadas</p>
        </div>
        <Button className="gap-1.5" onClick={() => setCreateModalOpen(true)}>
          <Plus className="size-4" /> Agregar conexión
        </Button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center flex-1"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Nombre</th>
              <th className="px-4 py-3 text-left font-medium">Número</th>
              <th className="px-4 py-3 text-left font-medium">Estado</th>
              <th className="px-4 py-3 text-center font-medium">Inbox</th><th className="px-4 py-3 text-center font-medium">Masivo</th>
              <th className="px-4 py-3 text-left font-medium">Último error</th><th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {instancias.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">No hay conexiones</td></tr>
            ) : instancias.map((inst) => {
              const sl = inst.isConnected ? 'connected' : inst.status === 'qr_ready' ? 'qr_ready' : 'disconnected';
              const ib = busyId === inst.id;
              return (
                <tr key={inst.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{inst.instanceName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{inst.displayLineId || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                      sl === 'connected' ? 'bg-emerald-100 text-emerald-700' : sl === 'qr_ready' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700')}>
                      <span className={cn('size-1.5 rounded-full', sl === 'connected' ? 'bg-emerald-500' : sl === 'qr_ready' ? 'bg-amber-500' : 'bg-red-500')} />
                      {inst.isConnected ? 'Conectado' : inst.status === 'qr_ready' ? 'QR pendiente' : 'Desconectado'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="radio" name="inbox-selection" checked={inboxId === inst.id}
                      onClick={() => {
                        const nv = inboxId === inst.id ? null : inst.id;
                        setInboxId(nv);
                        updateFlotaInstanceFlags(inst.id, { useForInbox: !!nv }).then(() => toast.success(nv ? 'Inbox asignado' : 'Inbox desasignado')).catch(() => toast.error('Error'));
                      }}
                      readOnly className="size-4 accent-primary" disabled={!inst.isConnected} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="checkbox" checked={masivoIds.has(inst.id)} disabled={!inst.isConnected}
                      onChange={() => {
                        setMasivoIds((p) => { const n = new Set(p); n.has(inst.id) ? n.delete(inst.id) : n.add(inst.id); return n; });
                        updateFlotaInstanceFlags(inst.id, { useForMasivo: !masivoIds.has(inst.id) }).then(() => toast.success(!masivoIds.has(inst.id) ? 'Agregado a masivo' : 'Quitado de masivo')).catch(() => toast.error('Error'));
                      }}
                      className="size-4 accent-primary rounded" />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{inst.lastError || '—'}</td>
                  <td className="px-4 py-3 text-right space-x-1">
                    {inst.isConnected
                      ? <button className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 px-2 py-1" disabled={ib} onClick={() => handleDisconnect(inst.id)}>{ib ? '...' : 'Desconectar'}</button>
                      : <button className="text-xs text-emerald-600 hover:text-emerald-700 font-medium disabled:opacity-50 px-2 py-1" disabled={ib} onClick={() => handleConnect(inst)}>{ib ? '...' : 'Conectar'}</button>}
                    <button className="text-xs text-destructive hover:text-destructive/80 disabled:opacity-50 px-2 py-1" disabled={ib} onClick={() => handleDelete(inst.id)}>Eliminar</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
      <Dialog open={createModalOpen} onOpenChange={(o) => { setCreateModalOpen(o); if (!o) setNewInstancia({ nombre: '', token: '' }); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pr-8">
            <DialogTitle className="flex items-center gap-2"><Link2 className="h-5 w-5 text-primary" /> Agregar conexión</DialogTitle>
            <DialogDescription>Creá una nueva instancia de WhatsApp en Evolution GO</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inst-nombre">Nombre de instancia</Label>
              <Input id="inst-nombre" value={newInstancia.nombre} onChange={(e) => setNewInstancia((p) => ({ ...p, nombre: e.target.value }))} placeholder="Ej: crm-flota-2" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inst-token">Token de API (opcional)</Label>
              <Input id="inst-token" value={newInstancia.token} onChange={(e) => setNewInstancia((p) => ({ ...p, token: e.target.value }))} placeholder="Ej: abc123def456" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateModalOpen(false); setNewInstancia({ nombre: '', token: '' }); }}>Cancelar</Button>
            <Button disabled={!newInstancia.nombre.trim() || creating} onClick={() => void handleCreate()}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
              {creating ? 'Creando...' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ==================== MASIVO HISTORY ==================== */

function MasivoHistoryView({ onCreateNew }: { onCreateNew?: () => void }) {
  const [campaigns, setCampaigns] = useState<FlotaBulkCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 15;

  useEffect(() => {
    setLoading(true);
    listFlotaBulkCampaigns(page, PAGE_SIZE).then((r) => { setCampaigns(r.items); setTotal(r.total); }).catch(() => toast.error('Error')).finally(() => setLoading(false));
  }, [page]);

  const tp = Math.ceil(total / PAGE_SIZE);
  return (
    <div className="flex flex-col h-full p-6 overflow-y-auto scrollbar-thin">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Campañas masivas</h2>
          <p className="text-sm text-muted-foreground mt-1">{total > 0 ? `${total} campaña(s) realizadas` : 'Historial de envíos masivos'}</p>
        </div>
        <Button className="gap-1.5" onClick={onCreateNew}><Plus className="size-4" /> Nueva campaña</Button>
      </div>
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Nombre</th><th className="px-4 py-3 text-left font-medium">Estado</th>
              <th className="px-4 py-3 text-center font-medium">Total</th><th className="px-4 py-3 text-center font-medium">Enviados</th>
              <th className="px-4 py-3 text-center font-medium">Fallidos</th><th className="px-4 py-3 text-left font-medium">Creado por</th><th className="px-4 py-3 text-left font-medium">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center"><Loader2 className="size-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
            ) : campaigns.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">No hay campañas aún</td></tr>
            ) : campaigns.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3">
                  <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                    c.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : c.status === 'sending' ? 'bg-blue-100 text-blue-700' : c.status === 'cancelled' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700')}>
                    {c.status === 'sent' ? 'Enviada' : c.status === 'sending' ? 'Enviando' : c.status === 'cancelled' ? 'Cancelada' : 'Fallida'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center tabular-nums">{c.total}</td>
                <td className="px-4 py-3 text-center tabular-nums text-emerald-600">{c.sent}</td>
                <td className="px-4 py-3 text-center tabular-nums text-red-600">{c.failed}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.createdByName}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(c.createdAt).toLocaleDateString('es-PE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {tp > 1 && <Pagination page={page} totalPages={tp} onPageChange={setPage} totalItems={total} pageSize={PAGE_SIZE} />}
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

const PIPELINE_VIRTUAL_MIN_CARDS = 16;
const PIPELINE_CARD_ESTIMATE_PX = 130;
const PIPELINE_CARD_GAP_PX = 8;

function FlotaPipelineView({ onSelect }: { onSelect: (contactId: string) => void }) {
  const [conversations, setConversations] = useState<FlotaConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [operadorFilter, setOperadorFilter] = useState('all');
  const [operadores, setOperadores] = useState<OperadorUser[]>([]);
  const [conductorCodigos, setConductorCodigos] = useState<Record<string, string>>({});

  const { hasPermission } = usePermissions();
  const currentUser = useAppStore((s) => s.currentUser);
  const hasVerTodos = hasPermission('flota_prospectos.ver_todos');

  useEffect(() => {
    void loadConversations();
    fetchOperadores().then(setOperadores).catch(() => {});
    getConductorTelefonos().then((r) => setConductorCodigos(r.codigoByTelefono)).catch(() => {});
  }, []);

  async function loadConversations() {
    setLoading(true);
    try {
      const [convs, prospectosRes] = await Promise.all([
        fetchConversations(),
        flotaProspectosList({ limit: 10000 }),
      ]);
      let convsFiltered = convs;
      if (!hasVerTodos) {
        convsFiltered = convs.filter(
          (c) => !c.operador || c.operador === currentUser?.name,
        );
      }
      const convoMap = new Map(convsFiltered.map((c) => [c.id, c]));
      const prospectos: FlotaConversation[] = prospectosRes.data
        .filter((p) => !convoMap.has(p.id))
        .map((p) => ({
          id: p.id,
          name: p.nombreCompleto || 'Sin nombre',
          phone: p.celular || p.movil || '',
          preview: '',
          time: p.createdAt,
          direction: 'inbound' as const,
          unread: 0,
          estado: p.estado || 'Nuevo',
          operador: p.operador ?? undefined,
        }));
      setConversations([...convsFiltered, ...prospectos]);
    } catch {
      toast.error('No se pudieron cargar los prospectos');
    } finally {
      setLoading(false);
    }
  }

  const filterOperadores = useMemo(() => {
    if (hasVerTodos) return operadores;
    return operadores.filter((op) => op.name === currentUser?.name);
  }, [hasVerTodos, operadores, currentUser?.name]);

  const filteredConversations = useMemo(() => {
    let list = conversations;
    if (searchTerm.trim()) {
      const s = searchTerm.trim().toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(s) || c.phone.includes(s));
    }
    if (operadorFilter === '__unassigned__') {
      list = list.filter((c) => !c.operador);
    } else if (operadorFilter !== 'all') {
      list = list.filter((c) => getOperatorDisplayName(c.operador, operadores) === operadorFilter);
    }
    return list.map((c) => ({
      ...c,
      operador: c.operador ? getOperatorDisplayName(c.operador, operadores) : c.operador,
    }));
  }, [conversations, searchTerm, operadorFilter, operadores]);

  const grouped = useMemo(() => {
    const map: Record<string, FlotaConversation[]> = {};
    for (const s of ESTADOS_PIPELINE) map[s] = [];
    for (const c of filteredConversations) {
      const estado = c.estado;
      if (estado) {
        const key = ESTADOS_PIPELINE.find((k) => k.toLowerCase() === estado.toLowerCase());
        if (key) {
          map[key].push(c);
          continue;
        }
      }
      map['Nuevo'].push(c);
    }
    return map;
  }, [filteredConversations]);

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
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const activeConvo = activeId ? conversations.find((c) => c.id === activeId) : null;

  if (loading) return <LoadingState />;

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <div className="px-4 py-3 shrink-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">Pipeline de Prospectos Flota</h2>
          <p className="text-sm text-muted-foreground">{filteredConversations.length} de {conversations.length} prospectos</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar nombre o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 w-56 pl-8 text-xs"
            />
          </div>
          <Select value={operadorFilter} onValueChange={(v) => setOperadorFilter(v)}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="Operador" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {filterOperadores.map((op) => (
                <SelectItem key={op.id} value={op.name}>{op.name}</SelectItem>
              ))}
              <SelectItem value="__unassigned__">Sin asignar</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="scrollbar-thin flex min-h-0 flex-1 gap-3 overflow-x-auto px-3 pb-3 pt-2">
          {ESTADOS_PIPELINE.map((estado) => (
            <FlotaKanbanColumn
              key={estado}
              estado={estado}
              conversations={grouped[estado]}
              onSelect={onSelect}
              conductorCodigos={conductorCodigos}
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
  conductorCodigos: Record<string, string>;
}

const FlotaKanbanColumn = memo(function FlotaKanbanColumn({ estado, conversations, onSelect, conductorCodigos }: FlotaKanbanColumnProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { setNodeRef } = useDroppable({ id: estado });
  const accentColor = ACCENT_COLORS[estado] ?? '#6b7280';

  const setScrollAndDropRef = useCallback(
    (node: HTMLDivElement | null) => {
      scrollRef.current = node;
      setNodeRef(node);
    },
    [setNodeRef],
  );

  const useVirtual = conversations.length >= PIPELINE_VIRTUAL_MIN_CARDS;

  const virtualizer = useVirtualizer({
    count: useVirtual ? conversations.length : 0,
    enabled: useVirtual,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => PIPELINE_CARD_ESTIMATE_PX,
    gap: PIPELINE_CARD_GAP_PX,
    overscan: 8,
  });

  return (
    <div className="flex h-full min-w-[280px] max-w-[300px] shrink-0 flex-col rounded-lg border bg-muted/20">
      <div className="h-1 rounded-t-lg" style={{ backgroundColor: accentColor }} />
      <div className="flex items-center justify-between border-x border-t border-muted px-3.5 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{ESTADO_LABELS[estado] ?? estado}</h3>
          <Badge variant="secondary" className="text-xs font-bold">{conversations.length}</Badge>
        </div>
      </div>
      <div
        ref={setScrollAndDropRef}
        className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto border-x border-b border-dashed border-transparent p-2"
        style={{ '--drop-active-bg': 'rgba(59,130,246,0.05)' } as React.CSSProperties}
      >
        {conversations.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-muted-foreground/20 py-8 text-xs text-muted-foreground">
            Sin prospectos
          </div>
        ) : useVirtual ? (
          <div className="relative w-full flex flex-col" style={{ height: virtualizer.getTotalSize(), gap: PIPELINE_CARD_GAP_PX }}>
            {virtualizer.getVirtualItems().map((v) => {
              const c = conversations[v.index]!;
              return (
                <div
                  key={c.id}
                  data-index={v.index}
                  ref={virtualizer.measureElement}
                  className="absolute left-0 top-0 w-full"
                  style={{ transform: `translateY(${v.start}px)` }}
                >
                  <FlotaPipelineCard conversation={c} onSelect={onSelect} conductorCodigos={conductorCodigos} />
                </div>
              );
            })}
          </div>
        ) : (
          conversations.map((c) => (
            <FlotaPipelineCard key={c.id} conversation={c} onSelect={onSelect} conductorCodigos={conductorCodigos} />
          ))
        )}
      </div>
    </div>
  );
});

interface FlotaPipelineCardProps {
  conversation: FlotaConversation;
  onSelect: (contactId: string) => void;
  conductorCodigos: Record<string, string>;
}

function getConductorCodigo(phone: string, codigos: Record<string, string>): string | null {
  if (!phone) return null;
  const normalized = phone.replace(/\D/g, '').replace(/^51/, '');
  return codigos[normalized] ?? null;
}

const FlotaPipelineCard = memo(function FlotaPipelineCard({ conversation: c, onSelect, conductorCodigos }: FlotaPipelineCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: c.id });

  const style: React.CSSProperties | undefined = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative select-none rounded-lg border border-muted bg-card p-3.5 shadow-sm',
        'transition-[box-shadow,border-color] duration-150',
        'hover:border-primary/30 dark:hover:shadow-lg',
        isDragging ? 'opacity-40 transition-none' : '',
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
        {(() => {
          const codigo = getConductorCodigo(c.phone, conductorCodigos);
          if (!codigo) return null;
          return <span className="block text-[10px] text-emerald-600 font-medium truncate ml-5">{codigo}</span>;
        })()}
        {c.operador && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="size-3 shrink-0" />
            <span className="truncate">{c.operador}</span>
          </div>
        )}
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
