import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { api, API_BASE } from '@/lib/api';
import { Loader2, Send, Paperclip, Music2, Smile, X, Mic, StopCircle, FileText, Phone, CheckCheck, Download, ArrowDown, Info, Edit2, Lock, PanelRight, ImageIcon, MoreVertical, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { EmojiGrid } from '@/components/EmojiGrid';
import { cn } from '@/lib/utils';
import { fetchFlotaProspectoMessages, sendFlotaWhatsappMessage, uploadFlotaImage, uploadFlotaAudio, uploadFlotaDocument, deleteFlotaWhatsappMessage } from '@/lib/flotaWhatsappApi';
import { fetchOperadores, getOperatorDisplayName, type OperadorUser } from '@/lib/flotaProspectosApi';
import type { WhatsappMessageItem } from '@/lib/whatsappApi';
import { downloadWhatsappAttachment } from '@/lib/whatsappApi';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAppStore } from '@/store';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface ChatPanelStandaloneProps {
  prospectoId: string;
  onClose: () => void;
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

function MessageAttachment({ attachment, mine, setLightboxUrl, onLightboxOpen }: {
  attachment: NonNullable<WhatsappMessageItem['attachments']>[number];
  mine: boolean;
  setLightboxUrl: (url: string) => void;
  onLightboxOpen?: (id: string, name: string) => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const src = (attachment.url ?? attachment.downloadUrl ?? attachment.proxyUrl ?? '').trim();

  if (!src) {
    return (
      <div className={cn("mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs", mine ? "bg-[#0000001a] text-[#111b21] dark:text-[#e9edef]" : "bg-[#0000000d] text-[#667781] dark:text-[#aebac1]")}>
        <FileText className="h-4 w-4 shrink-0" />
        <span className="truncate">{attachment.name || 'Archivo no disponible'}</span>
      </div>
    );
  }

  if (attachment.mediaType === 'image' || attachment.mimeType?.startsWith('image/')) {
    if (imgError) {
      return (
        <div className={cn("mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs", mine ? "bg-[#0000001a] text-[#111b21] dark:text-[#e9edef]" : "bg-[#0000000d] text-[#667781] dark:text-[#aebac1]")}>
          <ImageIcon className="h-4 w-4 shrink-0" />
          <span className="truncate">{attachment.name || 'Imagen no disponible'}</span>
        </div>
      );
    }
    return (
      <div className="relative w-full">
        <button type="button" onClick={() => { setLightboxUrl(src); onLightboxOpen?.(attachment.id, attachment.name); }} className="block w-full">
          <img src={src} alt={attachment.name} onError={() => setImgError(true)} className="mb-2 max-h-60 w-full rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity" />
        </button>
      </div>
    );
  }

  if (attachment.mediaType === 'video' || attachment.mimeType?.startsWith('video/')) {
    return <video controls preload="metadata" className="mb-2 max-h-60 w-full rounded-lg bg-black" src={src} />;
  }

  if (attachment.mediaType === 'audio' || attachment.mimeType?.startsWith('audio/')) {
    return (
      <div className={cn("mb-2 rounded-lg px-3 py-2", mine ? "bg-[#0000001a]" : "bg-[#0000000d]")}>
        <div className={cn("mb-2 flex items-center gap-2 text-xs", mine ? "text-[#111b21] dark:text-[#e9edef]" : "text-[#667781] dark:text-[#aebac1]")}>
          <Music2 className="h-4 w-4" />
          <span className="truncate">{attachment.name}</span>
        </div>
        <audio controls preload="metadata" className="w-full max-w-[240px]" src={src} />
      </div>
    );
  }

  return (
    <a href={src} rel="noreferrer" download={attachment.name}
      className={cn("mb-2 flex items-center gap-3 rounded-lg px-3 py-2 transition", mine ? "bg-[#0000001a] text-[#111b21] dark:text-[#e9edef] hover:bg-[#00000026]" : "bg-[#0000000d] text-[#111b21] dark:text-[#e9edef] hover:bg-[#00000014]")}
    >
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", mine ? "bg-white/20" : "bg-[#f0f2f5] dark:bg-[#2a3942]")}>
        <FileText className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{attachment.name}</p>
        <p className="text-xs text-[#667781] dark:text-[#aebac1]">{attachmentMetaLine(attachment.name, attachment.mimeType || '', attachment.size || 0)}</p>
      </div>
      <Download className="h-4 w-4 shrink-0 opacity-70" />
    </a>
  );
}

type PendingAttachment = {
  type: 'image' | 'audio' | 'document';
  file: File;
  previewUrl?: string;
  caption: string;
};

export default function ChatPanelStandalone({ prospectoId, onClose }: ChatPanelStandaloneProps) {
  const [messages, setMessages] = useState<WhatsappMessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [prospecto, setProspecto] = useState<{ nombreCompleto: string; celular: string; estado?: string; operador?: string } | null>(null);
  const [draft, setDraft] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const [sendingAttachment, setSendingAttachment] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxAttachment, setLightboxAttachment] = useState<{ id: string; name: string } | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [mediaPanelOpen, setMediaPanelOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const hasInitialScrolledRef = useRef(false);
  const prevLenRef = useRef(0);
  const loadingOlderRef = useRef(false);
  const msgVirtualizerRef = useRef<any>(null);
  const currentUser = useAppStore((s) => s.currentUser);
  const isOperadorRole = currentUser?.role === 'operador';
  const canAssignOperador = !isOperadorRole || !prospecto?.operador;
  const [operadores, setOperadores] = useState<OperadorUser[]>([]);

  useEffect(() => {
    fetchOperadores().then(setOperadores).catch(() => {});
  }, []);

  const ESTADOS = ['Nuevo', 'Afiliado', 'Citado', 'Seguimiento', 'Informacion', 'Sin Requisitos', 'No Responde'] as const;

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

  function formatStatus(status: string) {
    if (!status) return '';
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  }

  async function handleCambiarEstado(nuevoEstado: string) {
    try {
      await api(`/flota-prospectos/${prospectoId}`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      setProspecto((prev) => prev ? { ...prev, estado: nuevoEstado } : prev);
      toast.success(`Estado actualizado a ${formatStatus(nuevoEstado)}`);
      try { new BroadcastChannel("flota-prospectos").postMessage({ type: "refresh" }); } catch {}
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo actualizar el estado');
    }
  }

  async function handleCambiarOperador(nuevoOperador: string) {
    try {
      await api(`/flota-prospectos/${prospectoId}/operador`, {
        method: 'PATCH',
        body: JSON.stringify({ operador: nuevoOperador || null }),
      });
      setProspecto((prev) => prev ? { ...prev, operador: nuevoOperador } : prev);
      toast.success(nuevoOperador ? `Operador asignado: ${nuevoOperador}` : 'Operador removido');
      try { new BroadcastChannel("flota-prospectos").postMessage({ type: "refresh" }); } catch {}
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo asignar operador');
    }
  }

  // Load prospecto info
  useEffect(() => {
    api<Record<string, unknown>>(`/flota-prospectos/${prospectoId}`)
      .then((data) => {
        setProspecto({
          nombreCompleto: String(data.nombreCompleto || ''),
          celular: String(data.celular || data.movil || ''),
          estado: String(data.estado || ''),
          operador: String(data.operador || ''),
        });
      })
      .catch(() => {});
  }, [prospectoId]);

  // Load messages
  const loadMessages = useCallback(async () => {
    try {
      const { items, hasMore: hm } = await fetchFlotaProspectoMessages(prospectoId);
      setMessages(items);
      setHasMore(hm);
    } catch {
      toast.error('No se pudieron cargar los mensajes');
    } finally {
      setLoading(false);
    }
  }, [prospectoId]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  const loadOlderMessages = useCallback(async () => {
    if (loadingOlderRef.current || !hasMore || messages.length === 0) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const oldest = messages[0];
      const firstVisibleIndex = msgVirtualizerRef.current?.getVirtualItems()[0]?.index ?? 0;
      const result = await fetchFlotaProspectoMessages(prospectoId, 30, oldest.createdAt);
      if (result.items.length === 0) { setHasMore(false); return; }
      setMessages((prev) => [...result.items, ...prev]);
      setHasMore(result.hasMore);
      setTimeout(() => {
        msgVirtualizerRef.current?.scrollToIndex(firstVisibleIndex + result.items.length, { align: 'start' });
      }, 16);
    } catch { /* silent */ }
    finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [prospectoId, hasMore, messages]);

  // Scroll handler for loading older messages
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      if (hasMore && el.scrollTop < 80) void loadOlderMessages();
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (dist < 100) setNewMessagesCount(0);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [loadOlderMessages, hasMore]);

  // Auto-scroll on new messages
  const messageItems = useMemo(() => {
    const items: Array<{ type: 'date'; key: string; label: string } | { type: 'message'; key: string; msg: WhatsappMessageItem; mine: boolean }> = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const formatDateLabel = (date: Date) => {
      if (date.getTime() === today.getTime()) return 'Hoy';
      if (date.getTime() === yesterday.getTime()) return 'Ayer';
      return date.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
    };
    const grouped: { date: Date; msgs: WhatsappMessageItem[] }[] = [];
    let currentDate: Date | null = null;
    let currentGroup: WhatsappMessageItem[] = [];
    for (const m of messages) {
      const msgDate = new Date(m.createdAt); msgDate.setHours(0, 0, 0, 0);
      if (!currentDate || msgDate.getTime() !== currentDate.getTime()) {
        if (currentGroup.length > 0) grouped.push({ date: currentDate!, msgs: currentGroup });
        currentDate = msgDate; currentGroup = [m];
      } else { currentGroup.push(m); }
    }
    if (currentGroup.length > 0) grouped.push({ date: currentDate!, msgs: currentGroup });
    for (const g of grouped) {
      items.push({ type: 'date', key: `d-${g.date.getTime()}`, label: formatDateLabel(g.date) });
      for (const m of g.msgs) items.push({ type: 'message', key: m.id, msg: m, mine: m.direction === 'outbound' });
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

  useEffect(() => { msgVirtualizerRef.current = msgVirtualizer; }, [msgVirtualizer]);

  useEffect(() => {
    const len = messageItems.length;
    if (len === 0) return;
    if (!hasInitialScrolledRef.current) {
      hasInitialScrolledRef.current = true;
      prevLenRef.current = len;
      requestAnimationFrame(() => msgVirtualizerRef.current?.scrollToIndex(len - 1, { align: 'end' }));
      return;
    }
    if (len <= prevLenRef.current) { prevLenRef.current = len; return; }
    prevLenRef.current = len;
    const container = scrollRef.current;
    const distanceFromBottom = container ? container.scrollHeight - container.scrollTop - container.clientHeight : 0;
    if (distanceFromBottom < 200) {
      requestAnimationFrame(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; });
    } else {
      setNewMessagesCount((c) => c + 1);
    }
  }, [messageItems.length, prospectoId]);

  async function send() {
    const body = draft.trim();
    if (!body) return;
    const optimisticId = `opt:${Date.now()}`;
    setDraft('');
    const optimistic: WhatsappMessageItem = {
      id: optimisticId, direction: 'outbound', body, fromWaId: '', toWaId: prospecto?.celular ?? '',
      createdAt: new Date().toISOString(), waMessageId: null, evoInstanceName: null, waOutboundStatus: 'sent', attachments: [],
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      await sendFlotaWhatsappMessage(prospectoId, body);
    } catch (e) {
      setMessages((prev) => prev.filter((x) => x.id !== optimisticId));
      setDraft(body);
      toast.error(e instanceof Error ? e.message : 'No se pudo enviar el mensaje');
    }
  }

  function handleCancelAttachment() {
    setPendingAttachment((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  }

  async function handleSendAttachment() {
    const att = pendingAttachment;
    if (!att) return;
    setSendingAttachment(true);
    try {
      let url: string;
      if (att.type === 'image') url = await uploadFlotaImage(att.file);
      else if (att.type === 'audio') url = await uploadFlotaAudio(att.file);
      else url = await uploadFlotaDocument(att.file);

      const optimisticId = `opt:${Date.now()}`;
      const optimistic: WhatsappMessageItem = {
        id: optimisticId, direction: 'outbound', body: att.caption || '', fromWaId: '', toWaId: prospecto?.celular ?? '',
        createdAt: new Date().toISOString(), waMessageId: null, evoInstanceName: null, waOutboundStatus: 'sent',
        attachments: [{
          id: `opt-att:${Date.now()}`, name: att.file.name, mimeType: att.file.type, size: att.file.size,
          mediaType: att.type === 'image' ? 'image' as const : att.type === 'audio' ? 'audio' as const : 'document' as const, url, downloadUrl: url,
        }],
      };
      setMessages((prev) => [...prev, optimistic]);
      await sendFlotaWhatsappMessage(
        prospectoId, att.caption || '',
        att.type === 'image' ? url : undefined,
        att.type === 'audio' ? url : undefined,
        att.type === 'document' ? url : undefined,
        att.type === 'document' ? att.file.name : undefined,
        att.type === 'document' ? att.file.type : undefined,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo enviar el archivo');
    } finally {
      setSendingAttachment(false);
      handleCancelAttachment();
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];
      recordingChunksRef.current = chunks;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mimeType });
        void sendAudioBlob(blob);
      };
      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => setRecordingDuration((d) => d + 1), 1000);
    } catch { toast.error('No se pudo acceder al micrófono.'); }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
    setIsRecording(false);
    setRecordingDuration(0);
  }

  async function sendAudioBlob(blob: Blob) {
    const file = new File([blob], 'audio.mp3', { type: blob.type });
    try {
      const url = await uploadFlotaAudio(file);
      const optimistic: WhatsappMessageItem = {
        id: `opt:${Date.now()}`, direction: 'outbound', body: '', fromWaId: '', toWaId: prospecto?.celular ?? '',
        createdAt: new Date().toISOString(), waMessageId: null, evoInstanceName: null, waOutboundStatus: 'sent',
        attachments: [{ id: `opt-att:${Date.now()}`, name: 'audio.mp3', mimeType: 'audio/mpeg', size: file.size, mediaType: 'audio' as const, url, downloadUrl: url }],
      };
      setMessages((prev) => [...prev, optimistic]);
      await sendFlotaWhatsappMessage(prospectoId, '', undefined, url);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Error al enviar el audio'); }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'audio' | 'document') {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    handleCancelAttachment();
    setPendingAttachment({
      type,
      file,
      previewUrl: type === 'image' ? URL.createObjectURL(file) : undefined,
      caption: '',
    });
  }

  async function handleDeleteMessage(messageId: string, forEveryone: boolean) {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg || msg.direction !== 'outbound') return;
    if (messageId.startsWith('opt:')) {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      return;
    }
    if (!forEveryone) {
      try {
        await deleteFlotaWhatsappMessage(messageId, false);
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo eliminar el mensaje');
      }
      return;
    }
    // Delete for everyone: show placeholder
    try {
      await deleteFlotaWhatsappMessage(messageId, true);
      setMessages((prev) => prev.map((m) =>
        m.id === messageId
          ? { ...m, body: 'Este mensaje fue eliminado', attachments: [], waOutboundStatus: null }
          : m
      ));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar el mensaje');
    }
  }

  const allAttachments = useMemo(() => {
    return messages.flatMap(m => m.attachments || []).filter(a => a.url || a.downloadUrl || a.proxyUrl);
  }, [messages]);

  return (
    <div className={cn("flex h-full min-h-0", mediaPanelOpen ? "flex-row" : "flex-col")}>
      <div className={cn("flex flex-col min-h-0 flex-1", mediaPanelOpen ? "min-w-0" : "")}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#e9edef] dark:border-[#2a3942] px-4 py-2 shrink-0 bg-[#f0f2f5] dark:bg-[#1f2c33]">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00a884] text-xs font-semibold text-white shrink-0">
            {(prospecto?.nombreCompleto || '??').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[#111b21] dark:text-[#e9edef]">{prospecto?.nombreCompleto || 'Cargando...'}</p>
            <p className="truncate text-xs text-[#667781] dark:text-[#aebac1]">{prospecto?.celular || ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn('rounded-md border px-2 py-1 text-[10px] font-medium transition-colors', getTagStyle(prospecto?.estado) || 'border-input bg-background text-muted-foreground hover:bg-muted')}>
                {prospecto?.estado ? formatStatus(prospecto.estado) : 'Estado'}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {ESTADOS.map((est) => (
                <DropdownMenuItem key={est} onClick={() => handleCambiarEstado(est)} className="text-xs">
                  {formatStatus(est)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu open={canAssignOperador ? undefined : false}>
            <DropdownMenuTrigger asChild>
              <button className={cn('rounded-md border px-2 py-1 text-[10px] font-medium transition-colors', !canAssignOperador && 'cursor-not-allowed opacity-50', prospecto?.operador ? 'border-sky-500/30 bg-sky-500/10 text-sky-700' : 'border-input bg-background text-muted-foreground hover:bg-muted')} disabled={!canAssignOperador}>
                {prospecto?.operador && !canAssignOperador ? <Lock className="mr-0.5 inline-block size-2.5" /> : null}
                {getOperatorDisplayName(prospecto?.operador, operadores) || 'Op'}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {prospecto?.operador && (
                <DropdownMenuItem onClick={() => handleCambiarOperador('')} className="text-xs">Sin operador</DropdownMenuItem>
              )}
              {operadores.map((op) => (
                <DropdownMenuItem key={op.id} onClick={() => handleCambiarOperador(op.name)} className="text-xs">{op.name}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            onClick={() => setMediaPanelOpen(!mediaPanelOpen)}
            className={cn("rounded-md p-1.5 transition-colors", mediaPanelOpen ? "bg-[#e9edef] dark:bg-[#2a3942] text-[#111b21] dark:text-[#e9edef]" : "text-[#54656f] dark:text-[#aebac1] hover:bg-[#e9edef] dark:hover:bg-[#2a3942]")}
            title="Archivos del chat"
          >
            <PanelRight className="h-3.5 w-3.5" />
          </button>
          <button onClick={onClose} className="rounded-md p-1.5 text-[#54656f] dark:text-[#aebac1] hover:bg-[#e9edef] dark:hover:bg-[#2a3942]" title="Cerrar">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden bg-[#efeae2] dark:bg-[#0b141a] px-4 py-3" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23000000\' fill-opacity=\'0.03\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}>
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#667781] dark:text-[#aebac1]" /></div>
        ) : messageItems.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#667781] dark:text-[#aebac1]">No hay mensajes aún</div>
        ) : (
          <div style={{ height: msgVirtualizer.getTotalSize(), position: 'relative' }}>
            {msgVirtualizer.getVirtualItems().map((vi) => {
              const item = messageItems[vi.index];
              return (
                <div key={item.key} data-index={vi.index} ref={msgVirtualizer.measureElement}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vi.start}px)` }}
                >
                  {item.type === 'date' ? (
                    <div className="my-3 flex items-center gap-3">
                      <div className="h-px flex-1 border-t border-muted/40" />
                      <span className="text-[11px] font-medium capitalize text-[#667781] dark:text-[#aebac1]">{item.label}</span>
                      <div className="h-px flex-1 border-t border-muted/40" />
                    </div>
                  ) : (
                    <div className={cn('flex mb-1 w-full group', item.mine ? 'justify-end' : 'justify-start')}>
                      {item.mine && (
                        <div className="flex items-center mr-1 opacity-0 group-hover:opacity-100 transition-opacity self-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="rounded-full p-0.5 text-[#8696a0] dark:text-[#667781] hover:bg-[#e9edef] dark:hover:bg-[#2a3942]">
                                <MoreVertical className="size-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-40">
                              <DropdownMenuItem onClick={() => void handleDeleteMessage(item.msg.id, false)} className="text-xs gap-2 cursor-pointer">
                                <Trash2 className="size-3.5" /> Eliminar para mí
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => void handleDeleteMessage(item.msg.id, true)} className="text-xs text-red-600 gap-2 cursor-pointer">
                                <Trash2 className="size-3.5" /> Eliminar para todos
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                      <div className={cn('max-w-[85%] min-w-0 rounded-2xl px-4 py-2.5 text-sm shadow-sm', item.mine ? 'rounded-br-sm bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-[#e9edef]' : 'rounded-bl-sm bg-white dark:bg-[#1f2c33] text-[#111b21] dark:text-[#e9edef]')}>
                        {item.msg.attachments?.map((att) => (
                          <MessageAttachment key={att.id} attachment={att} mine={item.mine} setLightboxUrl={setLightboxUrl} onLightboxOpen={(id, name) => setLightboxAttachment({ id, name })} />
                        ))}
                        {item.msg.body && (!item.msg.attachments?.length || !['[Imagen]', '[Documento]', '[Video]', '[Audio]', '[Sticker]'].includes(item.msg.body.trim())) && (
                          item.msg.body === 'Este mensaje fue eliminado' ? (
                            <p className="whitespace-pre-wrap break-words text-[10px] italic text-[#8696a0] dark:text-[#667781]">{item.msg.body}</p>
                          ) : (
                            <p className="whitespace-pre-wrap break-words font-emoji">{item.msg.body}</p>
                          )
                        )}
                        <div className={cn('mt-1 flex items-center justify-end gap-1 text-[10px]', item.mine ? 'text-[#667781] dark:text-[#aebac1]' : 'text-[#667781] dark:text-[#aebac1]')}>
                          <span>{new Date(item.msg.createdAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</span>
                          {item.mine && <CheckCheck className={cn('h-3 w-3', item.msg.waOutboundStatus === 'read' ? 'text-[#53bdeb]' : 'text-[#8696a0] dark:text-[#667781]')} />}
                        </div>
                      </div>
                      {!item.mine && (
                        <div className="flex items-center ml-1 opacity-0 group-hover:opacity-100 transition-opacity self-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="rounded-full p-0.5 text-[#8696a0] dark:text-[#667781] hover:bg-[#e9edef] dark:hover:bg-[#2a3942]">
                                <MoreVertical className="size-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="min-w-40">
                              <DropdownMenuItem onClick={() => void handleDeleteMessage(item.msg.id, false)} className="text-xs gap-2 cursor-pointer">
                                <Trash2 className="size-3.5" /> Eliminar para mí
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => void handleDeleteMessage(item.msg.id, true)} className="text-xs text-red-600 gap-2 cursor-pointer">
                                <Trash2 className="size-3.5" /> Eliminar para todos
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {newMessagesCount > 0 && (
        <button onClick={() => { msgVirtualizer.scrollToIndex(messageItems.length - 1, { align: 'end' }); setNewMessagesCount(0); }}
          className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full bg-[#00a884] px-4 py-1.5 text-xs font-medium text-white shadow-lg hover:bg-[#008f72]"
        >
          <ArrowDown className="h-3.5 w-3.5" /> {newMessagesCount} nuevo{newMessagesCount !== 1 ? 's' : ''}
        </button>
      )}

      {/* Pending attachment preview */}
      {pendingAttachment ? (
        <div className="border-t border-[#e9edef] dark:border-[#2a3942] bg-[#f0f2f5] dark:bg-[#1f2c33]">
          <div className="flex items-center justify-between border-b border-[#e9edef] dark:border-[#2a3942] px-4 py-2">
            <span className="text-sm font-medium text-[#111b21] dark:text-[#e9edef]">{pendingAttachment.type === 'image' ? 'Enviar foto' : pendingAttachment.type === 'audio' ? 'Enviar audio' : 'Enviar documento'}</span>
            <button onClick={handleCancelAttachment} disabled={sendingAttachment} className="rounded-full bg-destructive p-0.5 text-white hover:bg-destructive/90"><X className="h-3 w-3" /></button>
          </div>
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-4">
            {pendingAttachment.type === 'image' && pendingAttachment.previewUrl && (
              <img src={pendingAttachment.previewUrl} alt="Preview" className="max-h-48 rounded-lg object-contain" />
            )}
            {pendingAttachment.type === 'document' && (
              <div className="flex items-center gap-3 rounded-lg bg-white dark:bg-[#2a3942] px-4 py-3">
                <FileText className="h-8 w-8 text-[#667781] dark:text-[#aebac1]" />
                <div className="min-w-0"><p className="text-sm font-medium truncate max-w-[200px] text-[#111b21] dark:text-[#e9edef]">{pendingAttachment.file.name}</p><p className="text-xs text-[#667781] dark:text-[#aebac1]">{formatBytes(pendingAttachment.file.size)}</p></div>
              </div>
            )}
            <div className="flex w-full items-end gap-2">
              <Textarea value={pendingAttachment.caption} onChange={(e) => setPendingAttachment((prev) => prev ? { ...prev, caption: e.target.value } : null)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSendAttachment(); } }}
                placeholder="Añade un mensaje..." className="min-h-[40px] max-h-28 resize-none flex-1 text-sm bg-white dark:bg-[#2a3942] text-[#111b21] dark:text-[#e9edef] border-[#e9edef] dark:border-[#2a3942]" rows={1} disabled={sendingAttachment}
              />
              <Button onClick={() => void handleSendAttachment()} disabled={sendingAttachment} className="shrink-0 bg-[#00a884] hover:bg-[#008f72] text-white">
                {sendingAttachment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="border-t border-[#e9edef] dark:border-[#2a3942] bg-[#f0f2f5] dark:bg-[#1f2c33] p-2"
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => {
            e.preventDefault(); e.stopPropagation();
            const file = e.dataTransfer.files?.[0];
            if (!file) return;
            handleCancelAttachment();
            const isImage = file.type.startsWith('image/');
            const isAudioFile = file.type.startsWith('audio/');
            setPendingAttachment({ type: isImage ? 'image' : isAudioFile ? 'audio' : 'document', file, previewUrl: isImage ? URL.createObjectURL(file) : undefined, caption: '' });
          }}
        >
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e, 'image')} />
          <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={(e) => handleFileSelect(e, 'audio')} />
          <input ref={documentInputRef} type="file" className="hidden" onChange={(e) => handleFileSelect(e, 'document')} />
          <div className="flex items-end gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9 text-[#54656f] dark:text-[#aebac1] hover:bg-[#e9edef] dark:hover:bg-[#2a3942]">
                  <Paperclip className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top">
                <DropdownMenuItem onClick={() => imageInputRef.current?.click()}>
                  <ImageIcon className="mr-2 h-4 w-4" /> Foto
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => audioInputRef.current?.click()}>
                  <Music2 className="mr-2 h-4 w-4" /> Audio
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => documentInputRef.current?.click()}>
                  <FileText className="mr-2 h-4 w-4" /> Documento
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {isRecording ? (
              <div className="flex flex-1 items-center gap-2 rounded-lg border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#2a3942] px-3 py-2">
                <div className="flex items-center gap-2 text-sm font-medium text-[#ef4444]">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[#ef4444]" /> Grabando...
                </div>
                <span className="text-sm tabular-nums text-[#667781] dark:text-[#aebac1]">{Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, '0')}</span>
                <div className="flex-1" />
                <Button type="button" size="icon" variant="ghost" className="shrink-0 text-[#ef4444] hover:text-[#dc2626]" onClick={stopRecording}>
                  <StopCircle className="h-5 w-5" />
                </Button>
              </div>
            ) : (
              <>
                <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9 text-[#54656f] dark:text-[#aebac1] hover:bg-[#e9edef] dark:hover:bg-[#2a3942]" onClick={() => void startRecording()}>
                  <Mic className="h-5 w-5" />
                </Button>
                <div className="relative">
                  <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9 text-[#54656f] dark:text-[#aebac1] hover:bg-[#e9edef] dark:hover:bg-[#2a3942]" onClick={() => setEmojiOpen(!emojiOpen)}><Smile className="h-5 w-5" /></Button>
                  {emojiOpen && (
                    <div className="absolute bottom-full right-0 mb-2 z-50 shadow-xl rounded-lg overflow-hidden" onClick={() => setEmojiOpen(false)}>
                      <div onClick={(e) => e.stopPropagation()}>
                        <EmojiGrid onSelect={(emoji) => { setDraft((prev) => prev + emoji.replace(/\uFE0F/g, '')); setEmojiOpen(false); }} />
                      </div>
                    </div>
                  )}
                </div>
                <Textarea value={draft} onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
                  placeholder="Escribe un mensaje..." className="min-h-[40px] max-h-28 resize-none flex-1 text-sm bg-white dark:bg-[#2a3942] text-[#111b21] dark:text-[#e9edef] border-[#e9edef] dark:border-[#2a3942]" rows={1}
                />
                <Button onClick={() => void send()} disabled={!draft.trim()} className="shrink-0 bg-[#00a884] hover:bg-[#008f72] text-white disabled:opacity-40">
                  <Send className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Lightbox */}
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
              if (!lightboxUrl) return;
              try {
                const res = await fetch(lightboxUrl);
                if (!res.ok) throw new Error(`Error ${res.status}`);
                const blob = await res.blob();
                const objectUrl = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = objectUrl;
                link.download = lightboxAttachment?.name || 'imagen';
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
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
    </div>

    {mediaPanelOpen && (
      <aside className="w-[280px] shrink-0 flex flex-col overflow-hidden bg-[#f0f2f5] dark:bg-[#111b21] border-l border-[#e9edef] dark:border-[#2a3942]">
        <div className="flex items-center justify-between border-b border-[#e9edef] dark:border-[#2a3942] px-4 py-3">
          <h3 className="text-sm font-semibold text-[#111b21] dark:text-[#e9edef]">Archivos</h3>
          <button onClick={() => setMediaPanelOpen(false)} className="rounded-md p-1 text-[#54656f] dark:text-[#aebac1] hover:bg-[#e9edef] dark:hover:bg-[#2a3942]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {allAttachments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ImageIcon className="mb-3 h-10 w-10 text-[#667781] dark:text-[#aebac1]/30" />
              <p className="text-sm text-[#667781] dark:text-[#aebac1]">No hay archivos</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {allAttachments.map((a) => (
                <MessageAttachment key={a.id} attachment={a} mine={false} setLightboxUrl={setLightboxUrl} onLightboxOpen={(id, name) => setLightboxAttachment({ id, name })} />
              ))}
            </div>
          )}
        </div>
      </aside>
    )}
    </div>
  );
}
