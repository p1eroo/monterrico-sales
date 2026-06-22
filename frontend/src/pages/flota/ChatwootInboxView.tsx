import { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import { io } from 'socket.io-client';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Inbox,
  Send,
  Search,
  Phone,
  MoreVertical,
  Paperclip,
  Smile,
  CheckCheck,
  Users,
  MessageSquare,
  Loader2,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  X,
  FileText,
  Music2,
  ImageIcon,
  CheckCircle2,
  PanelRight,
  Dot,
  Download,
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit2,
  Upload,
  Play,
  Pause,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { API_BASE } from '@/lib/api';
import { EmojiGrid } from '@/components/EmojiGrid';
import type {
  ChatwootConversation,
  ChatwootMessage,
  ChatwootContact,
  ChatwootAttachment,
} from '@/lib/chatwootApi';
import { CHATWOOT_MESSAGE_TYPE } from '@/lib/chatwootApi';
import {
  fetchConversations,
  fetchMessages,
  sendMessage,
  updateConversation,
  updateContact,
  fetchConversation,
  fetchAgents,
  markConversationAsRead,
  uploadAttachment,
  type ChatwootAgent,
} from '@/lib/chatwootApi';
import { fetchOperadores, getOperatorDisplayName, flotaProspectosByPhone, flotaProspectoCreate, type OperadorUser, type FlotaProspectoDetalle } from '@/lib/flotaProspectosApi';
import { getConductorTelefonos } from '@/lib/flotaConductoresApi';
import { api } from '@/lib/api';

/* ==================== CHATWOOT INBOX VIEW ==================== */

export default function ChatwootInboxView() {
  const [conversations, setConversations] = useState<ChatwootConversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [messagesCache, setMessagesCache] = useState<Record<number, ChatwootMessage[]>>({});
  const [filter, setFilter] = useState<'all' | 'unread' | 'open' | 'resolved'>('all');
  const [conductorCodesAll, setConductorCodesAll] = useState<Record<string, string>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef(activeId);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    getConductorTelefonos().then((r) => setConductorCodesAll(r.codigoByTelefono)).catch(() => {});
  }, []);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    if (activeId) {
      markConversationAsRead(activeId).catch(() => {});
    }
  }, [activeId]);

  useEffect(() => {
    void loadConversations();
  }, []);

  /** Socket.IO para tiempo real */
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) return;
    const socket = io(`${API_BASE}/chatwoot`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Socket /chatwoot conectado, id:', socket.id);
      // Probar que el socket funciona con ping/pong
      socket.emit('ping', (response: unknown) => {
        console.log('🏓 Ping response:', response);
      });
      void loadConversations();
    });

    socket.on('connect_error', (err: Error) => {
      console.error('❌ Socket /chatwoot error:', err.message);
    });

    socket.on('chatwoot', (payload: { event: string; conversationId?: number; data?: { conversationId?: number } }) => {
      const convId = payload.conversationId ?? payload.data?.conversationId;
      console.log('📩 Socket /chatwoot recibió:', payload.event, 'conv:', convId);
      if (!convId) return;
      payload.conversationId = convId;
      const currentActiveId = activeIdRef.current;

      if (payload.event === 'message_created') {
        const msgData = (payload.data as any)?.message;
        if (!msgData) return;

        // Solo agregar mensajes entrantes (del contacto). Los salientes (nuestros)
        // ya se manejan con el mensaje optimista + loadMessages.
        const normalizedMsg = normalizeMsg(msgData as ChatwootMessage);
        if (normalizedMsg.message_type !== CHATWOOT_MESSAGE_TYPE.OUTGOING) {
          if (payload.conversationId === currentActiveId) {
            setMessagesCache((prev) => {
              const existing = prev[payload.conversationId!] ?? [];
              if (existing.some((m) => m.id === normalizedMsg.id)) return prev;
              return { ...prev, [payload.conversationId!]: [...existing, normalizedMsg] };
            });
          }
        }
        // Marcar como leído si estamos en el chat (solo para entrantes)
        if (payload.conversationId === currentActiveId) {
          markConversationAsRead(payload.conversationId).catch(() => {});
        }

        // Actualizar el listado de conversaciones optimistamente
        const listNorm = normalizeMsg(msgData as ChatwootMessage);
        setConversations((prev) => {
          const existing = prev.find((c) => c.id === payload.conversationId);
          if (!existing) return prev;
          const body = String(msgData.content || '').slice(0, 100);
          const isOutgoing = listNorm.message_type === CHATWOOT_MESSAGE_TYPE.OUTGOING;
          return prev.map((c) =>
            c.id === payload.conversationId
                  ? {
                      ...c,
                      preview: body,
                      direction: isOutgoing ? 'outbound' : 'inbound',
                      last_activity_at: Math.floor(Date.now() / 1000),
                      unread_count: payload.conversationId === currentActiveId ? 0 : (c.unread_count ?? 0) + 1,
                      messages: [{ ...msgData }],
                    }
              : c,
          ).sort((a, b) => (b.last_activity_at || 0) - (a.last_activity_at || 0));
        });
      } else if (payload.event === 'conversation_created' || payload.event === 'conversation_updated' || payload.event === 'conversation_status_changed') {
        void loadConversations();
      }
    });

    return () => {
      socketRef.current = null;
      socket.disconnect();
    };
  }, []);

  async function loadConversations() {
    try {
      // Primera página: mostrar inmediatamente
      const page1 = await fetchConversations({ page: 1 });
      let allItems = [...page1];
      allItems.sort((a, b) => b.last_activity_at - a.last_activity_at);
      setConversations(allItems);
      setLoading(false);

      // Background: cargar páginas restantes
      let page = 2;
      let lastCount = page1.length;
      while (lastCount >= 25) {
        const items = await fetchConversations({ page });
        if (items.length === 0) break;
        allItems = [...allItems, ...items];
        allItems.sort((a, b) => b.last_activity_at - a.last_activity_at);
        setConversations([...allItems]);
        lastCount = items.length;
        page++;
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  const queryLower = useMemo(() => query.toLowerCase(), [query]);

  const filtered = useMemo(() =>
    conversations
      .filter((c) => {
        if (filter === 'unread') return (c.unread_count ?? 0) > 0;
        if (filter === 'open') return c.status === 'open';
        if (filter === 'resolved') return c.status === 'resolved';
        return true;
      })
      .filter((c) =>
        c.meta.sender.name.toLowerCase().includes(queryLower) ||
        c.meta.sender.phone_number?.includes(query),
      ),
    [conversations, filter, query, queryLower, conversations.length],
  );

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 64,
    overscan: 8,
  });

  const handleSelectConversation = useCallback((id: number) => {
    setActiveId(id);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="flex flex-col overflow-hidden min-w-0 bg-card border-r border-muted">
          <div className="border-b border-muted px-3 pb-1 pt-3">
            <div className="flex gap-1">
              {([
                ['all', 'Todos'],
                ['unread', 'No leídos'],
                ['open', 'Abiertos'],
                ['resolved', 'Resueltos'],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key as typeof filter)}
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
          <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto scrollbar-thin pt-1.5">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                {query ? 'Sin resultados' : 'No hay conversaciones'}
              </div>
            ) : (
              <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                {virtualizer.getVirtualItems().map((vi) => {
                  const c = filtered[vi.index];
                  return (
                     <ChatwootConversationItem
                          key={c.id}
                          conversation={c}
                          isActive={activeId === c.id}
                          index={vi.index}
                          start={vi.start}
                          measureElement={virtualizer.measureElement}
                          onClick={handleSelectConversation}
                          conductorCodes={conductorCodesAll}
                        />
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {activeId ? (
          <ChatwootChatPanel
            key={activeId}
            conversationId={activeId}
            conversations={conversations}
            onConversationsUpdated={setConversations}
            messagesCache={messagesCache}
            setMessagesCache={setMessagesCache}
            conductorCodes={conductorCodesAll}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-card text-sm text-muted-foreground">
            <div className="text-center space-y-2">
              <Inbox className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <p>Selecciona una conversación</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ==================== LINK RENDERER ==================== */

const URL_REGEX = /(https?:\/\/[^\s<]+)/g;

const MSG_TYPE_MAP: Record<string, number> = {
  incoming: 0,
  outgoing: 1,
  activity: 2,
};

function normalizeMsg(m: ChatwootMessage): ChatwootMessage {
  const t = m.message_type;
  const numType = typeof t === 'string' ? (MSG_TYPE_MAP[t] ?? 2) : t;
  // Mapear status de Chatwoot a waOutboundStatus para mostrar check azul
  const waOutboundStatus = numType === 1 ? (m.status || 'sent') : undefined;
  return { ...m, message_type: numType, waOutboundStatus };
}

/** Chatwoot puede devolver timestamps en segundos (10 dígitos), milisegundos (13+) o ISO string. */
function normalizeTs(ts: number | string | undefined | null): number {
  if (!ts) return Date.now();
  if (typeof ts === 'string') return new Date(ts).getTime();
  return ts > 1e12 ? ts : ts * 1000;
}

function KeyboardNavigation({ onPrev, onNext, onClose }: { onPrev: (() => void) | null; onNext: (() => void) | null; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && onPrev) onPrev();
      if (e.key === 'ArrowRight' && onNext) onNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onPrev, onNext, onClose]);
  return null;
}

async function downloadImage(url: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = 'imagen';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {}
}

function renderLinks(text: string) {
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) => {
    if (URL_REGEX.test(part)) {
      URL_REGEX.lastIndex = 0; // reset regex state
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-medium text-sky-400 hover:text-sky-300"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

/* ==================== AVATAR ==================== */

/* ==================== ESTADOS FLOTA ==================== */

const ESTADOS_FLOTA = ['Nuevo', 'Afiliado', 'Citado', 'Seguimiento', 'Informacion', 'Sin Requisitos', 'No Responde'] as const;

function formatEstado(status: string) {
  if (!status) return '';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

const estadoTagStyles: Record<string, string> = {
  Nuevo: 'bg-slate-100 text-slate-700 border-slate-300',
  Citado: 'bg-primary/10 text-primary border-primary/20',
  Afiliado: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  Seguimiento: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  Informacion: 'bg-sky-500/10 text-sky-700 border-sky-500/20',
  'Sin Requisitos': 'bg-rose-500/10 text-rose-700 border-rose-500/20',
  'No Responde': 'bg-yellow-100 text-yellow-700 border-yellow-300',
};

function getEstadoStyle(estado: string | undefined): string | undefined {
  if (!estado) return undefined;
  const key = Object.keys(estadoTagStyles).find((k) => k.toLowerCase() === estado.toLowerCase());
  return key ? estadoTagStyles[key] : undefined;
}

/* ==================== AVATAR ==================== */

function ChatwootAvatar({ name, thumbnail }: { name: string; thumbnail?: string }) {
  const [imgError, setImgError] = useState(false);
  const thumbUrl = thumbnail
    ? `${API_BASE}/api/chatwoot/content?url=${encodeURIComponent(thumbnail)}`
    : null;

  if (thumbUrl && !imgError) {
    return (
      <img
        src={thumbUrl}
        alt=""
        className="h-full w-full object-cover"
        onError={() => setImgError(true)}
      />
    );
  }

  return <span>{name.slice(0, 2).toUpperCase()}</span>;
}

/* ==================== CONVERSATION ITEM ==================== */

const ChatwootConversationItem = memo(({
  conversation,
  isActive,
  index,
  start,
  measureElement,
  onClick,
  conductorCodes,
}: {
  conversation: ChatwootConversation;
  isActive: boolean;
  index: number;
  start: number;
  measureElement: (element: HTMLElement | null) => void;
  onClick: (id: number) => void;
  conductorCodes?: Record<string, string>;
}) => {
  const sender = conversation.meta.sender;
  const lastMsg = conversation.messages?.[0];
  const agent = conversation.meta.assignee;

  const dateStr = useMemo(() => {
    const d = new Date(normalizeTs(conversation.last_activity_at));
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.floor((today.getTime() - msgDay.getTime()) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return d.toLocaleDateString('es-PE', { weekday: 'short' });
    return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'numeric' });
  }, [normalizeTs(conversation.last_activity_at)]);

  const attachmentLabel = useMemo(() => {
    if (!lastMsg?.attachments?.length) return null;
    const types = lastMsg.attachments.map((a) => a.file_type);
    if (types.some((t) => t === 'image' || t?.startsWith('image/'))) return '📷 Imagen';
    if (types.some((t) => t === 'video' || t?.startsWith('video/'))) return '🎬 Video';
    if (types.some((t) => t === 'audio' || t?.startsWith('audio/'))) return '🎵 Audio';
    if (types.some((t) => t === 'location')) return '📍 Ubicación';
    if (types.some((t) => t === 'contact')) return '👤 Contacto';
    return '📎 Archivo adjunto';
  }, [lastMsg?.attachments]);

  const preview = attachmentLabel || lastMsg?.content?.slice(0, 100) || '';
  const isLastOutgoing = lastMsg?.message_type === CHATWOOT_MESSAGE_TYPE.OUTGOING;

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
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold overflow-hidden',
            (conversation.unread_count ?? 0) > 0
              ? 'bg-primary text-primary-foreground'
              : 'bg-primary/15 text-primary',
          )}>
            <ChatwootAvatar name={sender.name} thumbnail={sender.thumbnail} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <p className={cn('truncate text-xs', (conversation.unread_count ?? 0) > 0 ? 'font-semibold text-foreground' : 'text-foreground')}>{sender.name}</p>
              <span className="shrink-0 text-[11px] text-muted-foreground">{dateStr}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-1">
              {preview ? (
                <>
                  {isLastOutgoing ? (
                    <ArrowLeft className="shrink-0 size-3 text-muted-foreground/60" />
                  ) : (
                    <ArrowRight className="shrink-0 size-3 text-muted-foreground/60" />
                  )}
                  <p className={cn(
                    'line-clamp-1 text-xs flex-1',
                    (conversation.unread_count ?? 0) > 0 ? 'font-medium text-foreground' : 'text-muted-foreground',
                  )}>{preview}</p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground/50 italic flex-1">Sin mensajes</p>
              )}
              {(conversation.unread_count ?? 0) > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground shrink-0">
                  {conversation.unread_count}
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-1 flex-wrap">
              {agent && (
                <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/10 px-1 py-0.5 text-[10px] font-medium text-sky-600">
                  <Users className="size-3" />
                  {agent.name}
                </span>
              )}
              {(() => {
                const cod = conductorCodes ? getConductorCodigo(sender.phone_number, conductorCodes) : null;
                return cod ? (
                  <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
                    {cod}
                  </span>
                ) : null;
              })()}
            </div>
          </div>
        </div>
      </button>
    </div>
  );
});

ChatwootConversationItem.displayName = 'ChatwootConversationItem';

/* ==================== MESSAGE ATTACHMENT ==================== */

function getFileName(att: ChatwootAttachment): string {
  if ((att as any).file_name) return (att as any).file_name;
  const url = att.data_url || att.file_url || '';
  const parts = url.split('/');
  const last = parts[parts.length - 1];
  if (last && last.includes('.')) return decodeURIComponent(last);
  return 'Archivo';
}

function ChatwootMessageAttachment({ attachment, onImageClick, imageIndex }: { attachment: ChatwootAttachment; onImageClick?: (index: number) => void; imageIndex?: number }) {
  const [mediaError, setMediaError] = useState(false);

  const fileUrl = attachment.data_url || attachment.thumb_url;
  if (!fileUrl) return null;

  const mediaUrl = `${API_BASE}/api/chatwoot/content?url=${encodeURIComponent(fileUrl)}`;

  const isImage = attachment.file_type === 'image' || attachment.file_type?.startsWith('image/');
  const isAudio = attachment.file_type === 'audio' || attachment.file_type?.startsWith('audio/');
  const isVideo = attachment.file_type === 'video' || attachment.file_type?.startsWith('video/');

  if (isImage) {
    if (mediaError) {
      return (
        <div className="mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs bg-muted text-muted-foreground">
          <ImageIcon className="h-4 w-4 shrink-0" />
          <span>Imagen no disponible</span>
        </div>
      );
    }
    return (
      <div className="mb-2 w-full">
        <img
          src={mediaUrl}
          alt="Adjunto"
          onError={() => setMediaError(true)}
          className="max-h-60 w-full rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => onImageClick?.(imageIndex ?? 0)}
        />
      </div>
    );
  }

  if (isAudio || isVideo) {
    const fileName = getFileName(attachment);
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
      const el = audioRef.current;
      if (!el) return;
      const onDur = () => { if (isFinite(el.duration)) setDuration(el.duration); };
      const onTime = () => setCurrentTime(el.currentTime);
      const onEnd = () => setPlaying(false);
      el.addEventListener('loadedmetadata', onDur);
      el.addEventListener('durationchange', onDur);
      el.addEventListener('timeupdate', onTime);
      el.addEventListener('ended', onEnd);
      return () => {
        el.removeEventListener('loadedmetadata', onDur);
        el.removeEventListener('durationchange', onDur);
        el.removeEventListener('timeupdate', onTime);
        el.removeEventListener('ended', onEnd);
      };
    }, []);

    function togglePlay() {
      const el = audioRef.current;
      if (!el) return;
      if (playing) { el.pause(); setPlaying(false); }
      else { el.play().then(() => setPlaying(true)).catch(() => {}); }
    }

    function fmt(t: number) {
      if (!isFinite(t) || t < 0) return '0:00';
      const m = Math.floor(t / 60);
      const s = Math.floor(t % 60);
      return `${m}:${String(s).padStart(2, '0')}`;
    }

    return (
      <div className="mb-2 min-w-[260px] rounded-lg bg-muted/50 px-3 py-2.5">
        {isAudio && (
          <>
            <audio ref={audioRef} preload="metadata" src={mediaUrl} />
            <div className="flex items-center gap-2">
              <button onClick={togglePlay} className="shrink-0 rounded-full bg-primary p-1.5 text-primary-foreground hover:bg-primary/90 transition-colors">
                {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </button>
              <div className="flex-1 h-6 flex items-center cursor-pointer group" onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                if (audioRef.current) { audioRef.current.currentTime = pct * duration; }
              }}>
                <div className="relative w-full h-2 rounded-full bg-muted-foreground/20">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
                  <div className="absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-primary border-2 border-background shadow transition-transform hover:scale-125" style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%`, marginLeft: '-8px' }} />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs tabular-nums text-muted-foreground">{fmt(currentTime)}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{fmt(duration)}</span>
              <button onClick={() => { const a = document.createElement('a'); a.href = mediaUrl; a.download = fileName; a.click(); }} className="text-muted-foreground hover:text-foreground transition-colors" title="Descargar">
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        )}
        {isVideo && (
          <video controls preload="metadata" className="max-h-60 w-full rounded-lg bg-black" src={mediaUrl} />
        )}
      </div>
    );
  }

  return (
    <a
      href={mediaUrl}
      target="_blank"
      rel="noreferrer"
      className="mb-2 flex items-center gap-3 rounded-lg px-3 py-2 transition bg-muted/50 text-foreground hover:bg-muted/80"
    >
      <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
      <span className="truncate text-sm">{getFileName(attachment)}</span>
    </a>
  );
}

function getConductorCodigo(phone: string | null | undefined, codigos: Record<string, string>): string | null {
  if (!phone) return null;
  const normalized = phone.replace(/\D/g, '').replace(/^51/, '');
  return codigos[normalized] ?? null;
}

function formatDateLocal(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  // Usar los componentes locales para evitar desfase por zona horaria
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = d.toLocaleDateString('es-PE', { month: 'short', timeZone: 'UTC' });
  return `${day}-${month}`;
}

function ultimaObs(obs: string | null | undefined): string {
  if (!obs) return '';
  const entries = obs.split('\n---\n');
  return entries[0].replace(/^\[.+?\]\s*/, '');
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium truncate ml-2">{value}</span>
    </div>
  );
}

/* ==================== CHAT PANEL ==================== */

function ChatwootChatPanel({
  conversationId,
  conversations,
  onConversationsUpdated,
  messagesCache,
  setMessagesCache,
  conductorCodes,
}: {
  conversationId: number;
  conversations: ChatwootConversation[];
  onConversationsUpdated: React.Dispatch<React.SetStateAction<ChatwootConversation[]>>;
  messagesCache: Record<number, ChatwootMessage[]>;
  setMessagesCache: React.Dispatch<React.SetStateAction<Record<number, ChatwootMessage[]>>>;
  conductorCodes?: Record<string, string>;
}) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [pendingAtt, setPendingAtt] = useState<{ type: string; file: File; previewUrl?: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const hasInitialScrolledRef = useRef(false);
  const prevLenRef = useRef(0);
  const loadingOlderRef = useRef(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [prospecto, setProspecto] = useState<FlotaProspectoDetalle | null>(null);
  const [loadingProspecto, setLoadingProspecto] = useState(false);
  const [prospectoDeleted, setProspectoDeleted] = useState(() => {
    return !!localStorage.getItem(`chatwoot_deleted_prospect_${conversationId}`);
  });
  const [editProspectoOpen, setEditProspectoOpen] = useState(false);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [citadoDialogOpen, setCitadoDialogOpen] = useState(false);
  const [citadoDate, setCitadoDate] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [contactDetail, setContactDetail] = useState<{
    id?: number;
    custom_attributes?: Record<string, string>;
    additional_attributes?: Record<string, string>;
  } | null>(null);
  const [agents, setAgents] = useState<ChatwootAgent[]>([]);
  const [operadores, setOperadores] = useState<OperadorUser[]>([]);
  const [updating, setUpdating] = useState(false);

  const convo = conversations.find((c) => c.id === conversationId);
  const sender = convo?.meta.sender;
  const assignedAgentId = convo?.meta.assignee?.id;

  // Sincronizar operador cuando cambia el agente asignado (incluso por Socket.IO)
  const prevAgentRef = useRef(assignedAgentId);
  useEffect(() => {
    if (!prospecto?.id || prevAgentRef.current === assignedAgentId) return;
    prevAgentRef.current = assignedAgentId;
    const agentName = convo?.meta.assignee?.name;
    syncOperadorConAgente(agentName);
  }, [assignedAgentId, prospecto?.id]);

  useEffect(() => {
    if (!panelOpen || !conversationId) return;
    fetchConversation(conversationId).then((d) => {
      setContactDetail(d.meta?.sender ?? null);
    }).catch(() => {});
    fetchAgents().then(setAgents).catch(() => {});
    fetchOperadores().then((ops) => setOperadores(ops)).catch(() => {});
    // Cargar prospecto por teléfono
    const phone = conversations.find((c) => c.id === conversationId)?.meta?.sender?.phone_number;
    if (phone) {
      setLoadingProspecto(true);
      const cleanedPhone = phone.replace(/\D/g, '');
      flotaProspectosByPhone(cleanedPhone).then((res) => {
        if (res.found && res.prospecto) {
          setProspecto(res.prospecto);
          const agentName = conversations.find((c) => c.id === conversationId)?.meta?.assignee?.name;
          setTimeout(() => syncOperadorConAgente(agentName), 100);
        } else if (sender?.name && !localStorage.getItem(`chatwoot_deleted_prospect_${conversationId}`)) {
          setProspectoDeleted(false);
          return flotaProspectoCreate({ nombreCompleto: sender.name, celular: cleanedPhone }).then(
            (created) => setProspecto({ id: created.id, nombreCompleto: created.nombreCompleto, celular: created.celular, operador: null, estado: 'Nuevo' }),
          );
        } else {
          setProspecto(null);
        }
      }).catch(() => setProspecto(null)).finally(() => setLoadingProspecto(false));
    }
  }, [panelOpen, conversationId]);

  async function handleStatusChange(newStatus: string) {
    setUpdating(true);
    try {
      await updateConversation(conversationId, { status: newStatus });
      toast.success(`Conversación ${newStatus === 'open' ? 'abierta' : newStatus === 'resolved' ? 'resuelta' : 'pendiente'}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al actualizar');
    } finally {
      setUpdating(false);
    }
  }

  async function handleEstadoChange(nuevoEstado: string) {
    if (!prospecto?.id) return;
    if (nuevoEstado === 'Citado') {
      setCitadoDate(prospecto.fechaCita ? String(prospecto.fechaCita).split('T')[0] : '');
      setCitadoDialogOpen(true);
      return;
    }
    setUpdating(true);
    try {
      await api(`/flota-prospectos/${prospecto.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      setProspecto((prev) => prev ? { ...prev, estado: nuevoEstado } : prev);
      toast.success(`Estado: ${formatEstado(nuevoEstado)}`);
      try { new BroadcastChannel("flota-prospectos").postMessage({ type: "refresh" }); } catch {}
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al actualizar estado');
    } finally {
      setUpdating(false);
    }
  }

  async function handleGuardarCitado() {
    if (!prospecto?.id || !citadoDate) return;
    setUpdating(true);
    try {
      await api(`/flota-prospectos/${prospecto.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: 'Citado', fechaCita: citadoDate }),
      });
      setProspecto((prev) => prev ? { ...prev, estado: 'Citado', fechaCita: citadoDate } : prev);
      setCitadoDialogOpen(false);
      toast.success('Cita programada');
      try { new BroadcastChannel("flota-prospectos").postMessage({ type: "refresh" }); } catch {}
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setUpdating(false);
    }
  }

  async function handleCreateProspecto() {
    if (!sender?.phone_number || !sender?.name) return;
    setUpdating(true);
    try {
      const cleaned = sender.phone_number.replace(/\D/g, '');
      const created = await flotaProspectoCreate({ nombreCompleto: sender.name, celular: cleaned });
      setProspecto({ id: created.id, nombreCompleto: created.nombreCompleto, celular: created.celular, operador: null, estado: 'Nuevo' });
      toast.success('Prospecto creado');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al crear prospecto');
    } finally {
      setUpdating(false);
    }
  }

  async function syncOperadorConAgente(agentName: string | undefined) {
    if (!prospecto?.id) return;
    const matchingOperador = agentName ? operadores.find((op) => op.name === agentName) : null;
    try {
      await api(`/flota-prospectos/${prospecto.id}/operador`, {
        method: 'PATCH',
        body: JSON.stringify({ operador: matchingOperador ? agentName : null }),
      });
      if (matchingOperador) {
        setProspecto((prev) => prev ? { ...prev, operador: agentName! } : prev);
      } else {
        setProspecto((prev) => prev ? { ...prev, operador: null } : prev);
      }
    } catch {}
  }

  async function handleAssigneeChange(agentId: number) {
    setUpdating(true);
    const agentName = agents.find((a) => a.id === agentId)?.name;
    try {
      await updateConversation(conversationId, { assignee_id: agentId });
      // Sincronizar operador del prospecto
      if (prospecto?.id) await syncOperadorConAgente(agentName);
      toast.success(`Asignado: ${agentName || 'Agente #' + agentId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al asignar');
    } finally {
      setUpdating(false);
    }
  }

  const messages = messagesCache[conversationId] ?? [];

  const galleryImages = useMemo(() => {
    const urls: string[] = [];
    for (const msg of messages) {
      for (const att of msg.attachments || []) {
        const fileUrl = att.data_url || att.thumb_url;
        if (fileUrl && (att.file_type === 'image' || att.file_type?.startsWith('image/'))) {
          urls.push(`${API_BASE}/api/chatwoot/content?url=${encodeURIComponent(fileUrl)}`);
        }
      }
    }
    return urls;
  }, [messages]);

  useEffect(() => {
    if (!conversationId) return;
    const cached = messagesCache[conversationId];
    if (!cached || cached.length === 0) {
      setInitialLoading(true);
      loadMessages().finally(() => setInitialLoading(false));
    } else {
      setInitialLoading(false);
      loadMessages().catch(() => {});
    }
  }, [conversationId]);

  // La actualización en vivo se maneja via Socket.IO
  async function loadMessages() {
    const raw = await fetchMessages(conversationId);
    const msgs = raw.map(normalizeMsg);
    setMessagesCache((prev) => {
      const existing = prev[conversationId] ?? [];
      const realIds = new Set(msgs.map((m) => String(m.id)));
      const cleaned = existing.filter((m) => !realIds.has(String(m.id)));

      // Fusionar: si dos mensajes tienen mismo contenido y misma fecha (5s),
      // conservar solo el outgoing (type 1) y descartar el incoming (type 0).
      const merged = [...msgs, ...cleaned]
        .sort((a, b) => a.created_at - b.created_at)
        .filter((m, i, arr) => {
          if (m.message_type !== 0) return true;
          const prev = arr[i - 1];
          if (!prev || prev.message_type !== 1) return true;
          if (prev.content !== m.content) return true;
          if (Math.abs(prev.created_at - m.created_at) > 5) return true;
          return false; // es un duplicado incoming de un outgoing
        });

      return { ...prev, [conversationId]: merged };
    });
    setHasMore(msgs.length >= 20);
  }

  const loadOlderMessages = useCallback(async () => {
    if (!conversationId || loadingOlderRef.current || !hasMore) return;
    const current = messagesCache[conversationId] ?? [];
    if (current.length === 0) return;
    const oldestMsg = current[0];

    loadingOlderRef.current = true;
    try {
      const rawOlder = await fetchMessages(conversationId, oldestMsg.id);
      const olderMsgs = rawOlder.map(normalizeMsg);
      if (olderMsgs.length === 0) {
        setHasMore(false);
        return;
      }

      setMessagesCache((prev) => {
        const existing = prev[conversationId] ?? [];
        let merged = [...olderMsgs, ...existing];
        // Deduplicar por ID
        const seen = new Set<string>();
        merged = merged.filter((m) => {
          const key = String(m.id);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        merged.sort((a, b) => a.created_at - b.created_at);
        // Filtrar duplicados incoming (type 0) de outgoing (type 1) con mismo contenido
        merged = merged.filter((m, i, arr) => {
          if (m.message_type !== 0) return true;
          const prev = arr[i - 1];
          if (!prev || prev.message_type !== 1) return true;
          if (prev.content !== m.content) return true;
          if (Math.abs(prev.created_at - m.created_at) > 5) return true;
          return false;
        });
        return { ...prev, [conversationId]: merged };
      });
    } catch {
      // silent
    } finally {
      loadingOlderRef.current = false;
    }
  }, [conversationId, hasMore, messagesCache]);

  useEffect(() => {
    hasInitialScrolledRef.current = false;
    prevLenRef.current = 0;
    setNewMessagesCount(0);
    loadingOlderRef.current = false;
    // prospectoDeleted se mantiene: si estaba en localStorage, sigue eliminado
  }, [conversationId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      // Debounce: solo procesar cada 300ms
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = setTimeout(() => {
        if (hasMore && el.scrollTop < 80) {
          void loadOlderMessages();
        }
        const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (dist < 100) setNewMessagesCount(0);
      }, 300);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', handleScroll);
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, [hasMore, loadOlderMessages]);

  const messageItems = useMemo(() => {
    type Item = { type: 'date'; key: string; label: string }
      | { type: 'activity'; key: string; content: string }
      | { type: 'message'; key: string; msg: ChatwootMessage; mine: boolean };
    const items: Item[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const formatDateLabel = (date: Date) => {
      if (date.getTime() === today.getTime()) return 'Hoy';
      if (date.getTime() === yesterday.getTime()) return 'Ayer';
      return date.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
    };

    // Normalizar y remover duplicados visuales
    const normalized = messages.map(normalizeMsg);
    const filtered = [...normalized].sort((a, b) => a.created_at - b.created_at).filter((m, i, arr) => {
      if (m.message_type !== 0) return true;
      const prev = arr[i - 1];
      if (!prev || prev.message_type !== 1) return true;
      if (prev.content !== m.content) return true;
      if (Math.abs(prev.created_at - m.created_at) > 5) return true;
      return false;
    });

    const grouped: { date: Date; msgs: ChatwootMessage[] }[] = [];
    let currentDate: Date | null = null;
    let currentGroup: ChatwootMessage[] = [];

    const seenIds = new Set<string>();
    for (const m of filtered) {
      const key = String(m.id);
      if (seenIds.has(key)) continue;
      seenIds.add(key);
      const msgDate = new Date(normalizeTs(m.created_at));
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
        if (m.message_type === CHATWOOT_MESSAGE_TYPE.ACTIVITY) {
          items.push({ type: 'activity', key: `${m.id}`, content: m.content });
        } else {
          items.push({ type: 'message', key: `${m.id}`, msg: m, mine: m.message_type === CHATWOOT_MESSAGE_TYPE.OUTGOING });
        }
      }
    }
    return items;
  }, [messages]);

  useEffect(() => {
    const items = messageItems;
    const len = items.length;
    if (len === 0) return;
    const container = scrollRef.current;

    if (!hasInitialScrolledRef.current) {
      hasInitialScrolledRef.current = true;
      prevLenRef.current = len;
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      });
      return;
    }

    if (len <= prevLenRef.current) {
      prevLenRef.current = len;
      return;
    }
    prevLenRef.current = len;

    const dist = container
      ? container.scrollHeight - container.scrollTop - container.clientHeight
      : 0;

    if (dist < 200) {
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      });
    } else {
      setNewMessagesCount((c) => c + 1);
    }
  }, [messageItems.length, conversationId]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    setPendingAtt({
      type: isImage ? 'image' : 'document',
      file,
      previewUrl: isImage ? URL.createObjectURL(file) : undefined,
    });
  }

  function cancelPendingAtt() {
    if (pendingAtt?.previewUrl) URL.revokeObjectURL(pendingAtt.previewUrl);
    setPendingAtt(null);
  }

  async function handleSendAttachment() {
    const att = pendingAtt;
    if (!att) return;
    setUploading(true);
    try {
      const msg = await uploadAttachment(conversationId, att.file, draft.trim());
      setMessagesCache((prev) => {
        const existing = prev[conversationId] ?? [];
        // Remover solo los optimistas (string id) y agregar el real
        const cleaned = existing.filter((m) => typeof m.id === 'number');
        const merged = [...cleaned, normalizeMsg(msg)].sort((a, b) => a.created_at - b.created_at);
        return { ...prev, [conversationId]: merged };
      });
      setDraft('');
      setPendingAtt(null);
      markConversationAsRead(conversationId).catch(() => {});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al enviar archivo');
    } finally {
      setUploading(false);
    }
  }

  async function handleSend() {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    setSending(true);
    markConversationAsRead(conversationId).catch(() => {});
    const optimisticId = `opt:${Date.now()}`;
    const optTs = Math.floor(Date.now() / 1000);
    const optimistic: ChatwootMessage = {
      id: optimisticId as any,
      content: body,
      message_type: CHATWOOT_MESSAGE_TYPE.OUTGOING,
      sender: { id: 0, name: 'Yo', type: 'user' },
      created_at: optTs,
      attachments: [],
      conversation_id: conversationId,
    };
    setMessagesCache((prev) => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] ?? []), optimistic],
    }));
    try {
      await sendMessage(conversationId, body);
    } catch (e) {
      setMessagesCache((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] ?? []).filter((m) => String(m.id) !== optimisticId),
      }));
      setDraft(body);
      toast.error(e instanceof Error ? e.message : 'No se pudo enviar el mensaje');
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="flex h-full min-h-0 min-w-0 relative"
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
      onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }}
      onDrop={(e) => {
        e.preventDefault(); e.stopPropagation(); setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (!file) return;
        cancelPendingAtt();
        const isImage = file.type.startsWith('image/');
        setPendingAtt({ type: isImage ? 'image' : 'document', file, previewUrl: isImage ? URL.createObjectURL(file) : undefined });
      }}
    >
      {/* Overlay drag & drop */}
      {dragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 border-2 border-dashed border-primary rounded-lg pointer-events-none">
          <div className="text-center space-y-3">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <p className="text-lg font-semibold text-foreground">Arrastra y suelta aquí</p>
            <p className="text-sm text-muted-foreground">para adjuntar al chat</p>
          </div>
        </div>
      )}
      <section className="flex flex-col flex-1 min-w-0 overflow-hidden bg-card relative">
        <div className="flex items-center justify-between border-b border-muted px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary overflow-hidden shrink-0">
              {sender?.thumbnail ? (
                <img
                  src={`${API_BASE}/api/chatwoot/content?url=${encodeURIComponent(sender.thumbnail)}`}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <span>{(sender?.name ?? '?').slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold leading-tight">{sender?.name ?? 'Desconocido'}</p>
              <p className="truncate text-xs text-muted-foreground">
                {sender?.phone_number ?? ''}
                {(() => {
                  const cod = getConductorCodigo(sender?.phone_number, conductorCodes ?? {});
                  return cod ? <span className="ml-1 text-emerald-600 font-medium">{cod}</span> : null;
                })()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
              convo?.status === 'open'
                ? 'bg-emerald-500/10 text-emerald-600'
                : convo?.status === 'resolved'
                  ? 'bg-blue-500/10 text-blue-600'
                  : 'bg-muted text-muted-foreground',
            )}>
              <CheckCircle2 className="h-3 w-3" />
              {convo?.status === 'open' ? 'Abierto' : convo?.status === 'resolved' ? 'Resuelto' : 'Pendiente'}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPanelOpen(!panelOpen)}>
              <PanelRight className={cn('h-4 w-4', panelOpen && 'text-primary')} />
            </Button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin bg-[radial-gradient(circle_at_1px_1px,theme(colors.muted.foreground/0.08)_1px,transparent_0)] [background-size:18px_18px] px-4 py-5"
        >
          {initialLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messageItems.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No hay mensajes aún
            </div>
          ) : (
            <div key={`msgs-${messageItems.length}`} className="space-y-1">
              {messageItems.map((item) =>
                item.type === 'date' ? (
                  <div key={item.key} className="my-3 flex items-center gap-3">
                    <div className="h-px flex-1 border-t border-muted/40" />
                    <span className="text-[11px] font-medium capitalize text-muted-foreground">{item.label}</span>
                    <div className="h-px flex-1 border-t border-muted/40" />
                  </div>
                ) : item.type === 'activity' ? (
                  <div key={item.key} className="my-2 flex justify-center">
                    <span className="inline-block rounded-full bg-muted/60 px-4 py-1 text-[11px] text-muted-foreground">
                      {item.content}
                    </span>
                  </div>
                ) : (
                  <div key={item.key} className={cn('flex mb-1 w-full', item.mine ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-[85%] min-w-0 rounded-2xl px-4 py-2.5 text-sm shadow-sm',
                        item.mine
                          ? 'rounded-br-sm bg-primary text-primary-foreground'
                          : 'rounded-bl-sm bg-muted text-foreground',
                      )}
                    >
                      {item.msg.attachments?.map((att) => {
                        const fileUrl = att.data_url || att.thumb_url;
                        const proxyUrl = fileUrl ? `${API_BASE}/api/chatwoot/content?url=${encodeURIComponent(fileUrl)}` : '';
                        const imgGlobalIdx = proxyUrl ? galleryImages.indexOf(proxyUrl) : -1;
                        return (
                          <ChatwootMessageAttachment
                            key={att.id}
                            attachment={att}
                            imageIndex={imgGlobalIdx >= 0 ? imgGlobalIdx : undefined}
                            onImageClick={(idx) => setLightboxIndex(idx)}
                          />
                        );
                      })}
                      {item.msg.content && (
                        <p className="whitespace-pre-wrap break-words">{renderLinks(item.msg.content)}</p>
                      )}
                      <div className={cn('mt-1 flex items-center justify-end gap-1 text-[10px]', item.mine ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                        <span>{new Date(normalizeTs(item.msg.created_at)).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</span>
                        {item.mine && <CheckCheck className={cn('h-3 w-3', item.msg.waOutboundStatus === 'read' && 'text-sky-300')} />}
                      </div>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </div>

        {newMessagesCount > 0 && (
          <button
            onClick={() => {
              if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
              setNewMessagesCount(0);
            }}
            className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground shadow-lg"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {newMessagesCount} {newMessagesCount === 1 ? 'nuevo' : 'nuevos'}
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
        )}

        <div className="border-t border-muted bg-background/60 p-3">
          {pendingAtt ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-muted/50 pb-2">
                <span className="text-sm font-medium">
                  {pendingAtt.type === 'image' ? 'Enviar foto' : 'Enviar documento'}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelPendingAtt} disabled={uploading}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-col items-center gap-3">
                {pendingAtt.type === 'image' && pendingAtt.previewUrl && (
                  <img src={pendingAtt.previewUrl} alt="Preview" className="max-h-48 rounded-lg object-contain" />
                )}
                {pendingAtt.type === 'document' && (
                  <div className="flex items-center gap-3 rounded-lg bg-muted/30 px-4 py-3 w-full">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                    <span className="text-sm truncate">{pendingAtt.file.name}</span>
                  </div>
                )}
                <div className="flex w-full items-end gap-2">
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Añade un mensaje..."
                    className="min-h-[44px] max-h-24 resize-none flex-1"
                    rows={1}
                    disabled={uploading}
                  />
                  <Button onClick={() => void handleSendAttachment()} disabled={uploading} className="shrink-0">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
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
                  <DropdownMenuItem onClick={() => { if (fileInputRef.current) { fileInputRef.current.click(); } }}>
                    <FileText className="mr-2 h-4 w-4" /> Documento
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="shrink-0">
                    <Smile className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="w-auto p-0 border-0">
                  <EmojiGrid onSelect={(emoji) => setDraft((prev) => prev + emoji.replace(/\uFE0F/g, ''))} />
                </PopoverContent>
              </Popover>
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="Escribe un mensaje..."
                className="min-h-[44px] max-h-32 resize-none"
                rows={1}
                onFocus={() => markConversationAsRead(conversationId).catch(() => {})}
                onPaste={(e) => {
                  const items = e.clipboardData?.items;
                  if (!items) return;
                  for (const item of items) {
                    if (item.type.startsWith('image/')) {
                      e.preventDefault();
                      const file = item.getAsFile();
                      if (!file) continue;
                      cancelPendingAtt();
                      setPendingAtt({ type: 'image', file, previewUrl: URL.createObjectURL(file) });
                      return;
                    }
                  }
                }}
              />
              <Button
                onClick={() => void handleSend()}
                disabled={!draft.trim() || sending}
                className="shrink-0"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </div>
      </section>

      {lightboxIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={() => setLightboxIndex(null)}>
          {/* Barra superior */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent">
            <span className="text-sm text-white/80">
              {lightboxIndex + 1} / {galleryImages.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); downloadImage(galleryImages[lightboxIndex]); }}
                className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
                title="Descargar"
              >
                <Download className="h-5 w-5" />
              </button>
              <button
                onClick={() => setLightboxIndex(null)}
                className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
                title="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Imagen */}
          <img
            src={galleryImages[lightboxIndex]}
            alt="Imagen"
            className="max-h-[90vh] max-w-[90vw] object-contain select-none"
            onClick={(e) => e.stopPropagation()}
            draggable={false}
          />

          {/* Flecha izquierda */}
          {lightboxIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 transition-colors"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          {/* Flecha derecha */}
          {lightboxIndex < galleryImages.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 transition-colors"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          {/* Navegación por teclado */}
          <KeyboardNavigation
            onPrev={lightboxIndex > 0 ? () => setLightboxIndex(lightboxIndex - 1) : null}
            onNext={lightboxIndex < galleryImages.length - 1 ? () => setLightboxIndex(lightboxIndex + 1) : null}
            onClose={() => setLightboxIndex(null)}
          />
        </div>
      )}

      {panelOpen && (
        <aside className="w-full xl:w-[320px] shrink-0 flex flex-col overflow-hidden bg-card border-l border-muted animate-in slide-in-from-right-4">
          <div className="flex items-center justify-between border-b border-muted px-5 py-[13px]">
            <h3 className="text-sm font-semibold">Detalle del contacto</h3>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPanelOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-5">
            {/* Información del contacto */}
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Contacto</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-base font-semibold text-primary shrink-0 overflow-hidden">
                    {sender?.thumbnail ? (
                      <img
                        src={`${API_BASE}/api/chatwoot/content?url=${encodeURIComponent(sender.thumbnail)}`}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <span>{(sender?.name ?? '?').slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{sender?.name}</p>
                    <p className="text-xs text-muted-foreground">{sender?.phone_number}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Estado de la conversación */}
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Conversación</h4>
              <div className="space-y-2">
                <Select
                  value={convo?.status ?? 'open'}
                  onValueChange={handleStatusChange}
                  disabled={updating}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Abierto</SelectItem>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="resolved">Resuelto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Agente asignado */}
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Agente asignado</h4>
              <Select
                value={assignedAgentId ? String(assignedAgentId) : '__none__'}
                onValueChange={(v) => v !== '__none__' && handleAssigneeChange(Number(v))}
                disabled={updating || agents.length === 0}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin asignar</SelectItem>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Prospecto Flota */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Prospecto</h4>
                {prospecto && (
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => {
                    const data: Record<string, string> = {};
                    for (const [k, v] of Object.entries(prospecto)) {
                      if (v != null) data[k] = k === 'observaciones' ? ultimaObs(String(v)) : String(v);
                    }
                    setEditData(data);
                    setEditProspectoOpen(true);
                  }}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
              {loadingProspecto ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : prospecto ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                    <span className="text-xs text-muted-foreground">Estado</span>
                    <Select value={prospecto.estado} onValueChange={handleEstadoChange} disabled={updating}>
                      <SelectTrigger className={cn('h-7 w-auto text-xs border-0 font-medium', getEstadoStyle(prospecto.estado))}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ESTADOS_FLOTA.map((est) => (
                          <SelectItem key={est} value={est} className={cn('text-xs', getEstadoStyle(est))}>
                            {formatEstado(est)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                    <span className="text-xs text-muted-foreground">Nombre</span>
                    <span className="text-xs font-medium truncate ml-2">{prospecto.nombreCompleto}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                    <span className="text-xs text-muted-foreground">Celular</span>
                    <span className="text-xs font-medium">{prospecto.celular}</span>
                  </div>
                  {prospecto.operador && (
                    <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                      <span className="text-xs text-muted-foreground">Operador</span>
                      <span className="text-xs font-medium">{getOperatorDisplayName(prospecto.operador, operadores)}</span>
                    </div>
                  )}
                  {prospecto.llamadaCount != null && (
                    <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                      <span className="text-xs text-muted-foreground">Llamadas</span>
                      <span className="text-xs font-medium">{prospecto.llamadaCount}</span>
                    </div>
                  )}
                  {prospecto.edad != null && <Row label="Edad" value={String(prospecto.edad)} />}
                  {prospecto.modalidad && <Row label="Modalidad" value={prospecto.modalidad} />}
                  {prospecto.placa && <Row label="Placa" value={prospecto.placa} />}
                  {prospecto.anioVehiculo != null && <Row label="Año Veh." value={String(prospecto.anioVehiculo)} />}
                  {prospecto.distrito && <Row label="Distrito" value={prospecto.distrito} />}
                  {prospecto.movil && <Row label="Movil" value={prospecto.movil} />}
                  {prospecto.fechaCita && (
                    <>
                      <Row label="F. Cita" value={formatDateLocal(prospecto.fechaCita)} />
                      <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                        <span className="text-xs text-muted-foreground">Asistencia</span>
                        <Select
                          value={prospecto.asistencia || ''}
                          onValueChange={async (val) => {
                            if (!prospecto.id) return;
                            const newVal = val || null;
                            try {
                              await api(`/flota-prospectos/${prospecto.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ asistencia: newVal }),
                              });
                              setProspecto((prev) => prev ? { ...prev, asistencia: newVal } : prev);
                              toast.success(`Asistencia: ${val || 'Sin registrar'}`);
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : 'Error al guardar');
                            }
                          }}
                        >
                          <SelectTrigger className="h-7 w-auto text-xs border-0 font-medium">
                            <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Asistió" className="text-xs text-emerald-600">Asistió</SelectItem>
                            <SelectItem value="No Asistió" className="text-xs text-destructive">No Asistió</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                  {prospecto.observaciones && (
                    <div className="rounded-md bg-muted/30 px-3 py-2">
                      <p className="text-xs text-muted-foreground mb-1">Observaciones</p>
                      <p className="text-xs whitespace-pre-wrap break-words">{ultimaObs(prospecto.observaciones)}</p>
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => setDeleteConfirmOpen(true)}
                    disabled={updating}
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> Eliminar prospecto
                  </Button>
                </div>
              ) : prospectoDeleted ? (
                <div className="flex flex-col items-center gap-2 py-2">
                  <p className="text-xs text-muted-foreground">Prospecto eliminado</p>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={async () => {
                    if (!sender?.name || !sender?.phone_number) return;
                    setUpdating(true);
                    try {
                      const cleaned = sender.phone_number.replace(/\D/g, '');
                      const created = await flotaProspectoCreate({ nombreCompleto: sender.name, celular: cleaned });
                      localStorage.removeItem(`chatwoot_deleted_prospect_${conversationId}`);
                      setProspectoDeleted(false);
                      setProspecto({ id: created.id, nombreCompleto: created.nombreCompleto, celular: created.celular, operador: null, estado: 'Nuevo' });
                      toast.success('Prospecto recreado');
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Error al crear prospecto');
                    } finally {
                      setUpdating(false);
                    }
                  }} disabled={updating}>
                    <Plus className="h-3 w-3 mr-1" /> Volver a crear
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-2 text-center">
                  {sender?.name ? 'Creando prospecto...' : 'Sin datos de contacto'}
                </p>
              )}
            </div>

            {/* Atributos personalizados */}
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Atributos</h4>
              <div className="space-y-2">
                {/* Bot siempre visible */}
                <div>
                  <Label className="text-xs capitalize mb-1 block">bot</Label>
                  <Select
                    value={contactDetail?.custom_attributes?.bot || ''}
                    onValueChange={(newVal) => {
                      if (!newVal || !contactDetail?.id) return;
                      const updated = { ...contactDetail.custom_attributes, bot: newVal };
                      setContactDetail((prev) => prev ? { ...prev, custom_attributes: updated } : prev);
                      updateContact(contactDetail.id, { custom_attributes: updated })
                        .then(() => toast.success(`Bot ${newVal === 'On' ? 'activado' : 'desactivado'}`))
                        .catch(() => toast.error('Error al actualizar'));
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Seleccionar valor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="On">On</SelectItem>
                      <SelectItem value="Off">Off</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Resto de atributos personalizados (no bot) */}
                {contactDetail?.custom_attributes && Object.entries(contactDetail.custom_attributes)
                  .filter(([key]) => key !== 'bot')
                  .map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                      <span className="text-xs text-muted-foreground capitalize">{key}</span>
                      <span className="text-xs font-medium">{value}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Atributos adicionales */}
            {(() => {
              if (!contactDetail?.additional_attributes) return null;
              const visible = Object.entries(contactDetail.additional_attributes).filter(
                ([k, v]) => typeof v === 'string' && v && !k.startsWith('avatar') && k !== 'social_profiles' && k !== 'last_avatar_sync'
              );
              if (visible.length === 0) return null;
              return (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Info adicional</h4>
                  <div className="space-y-1.5">
                    {visible.map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                        <span className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                        <span className="text-xs font-medium truncate ml-2">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </aside>
      )}

      {/* Modal confirmar eliminación */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar prospecto</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de eliminar a <strong>{prospecto?.nombreCompleto}</strong>?
              Esta acción solo afecta al CRM, los datos en Chatwoot no se modifican.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} disabled={updating}>Cancelar</Button>
            <Button variant="destructive" onClick={async () => {
              if (!prospecto?.id) return;
              try {
                localStorage.setItem(`chatwoot_deleted_prospect_${conversationId}`, 'true');
                setProspectoDeleted(true);
                await api(`/flota-prospectos/${prospecto.id}`, { method: 'DELETE' });
                setProspecto(null);
                setDeleteConfirmOpen(false);
                toast.success('Prospecto eliminado');
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Error al eliminar');
              } finally {
                setUpdating(false);
              }
            }} disabled={updating}>
              {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal fecha cita */}
      <Dialog open={citadoDialogOpen} onOpenChange={setCitadoDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Programar cita</DialogTitle>
            <DialogDescription>Ingresa la fecha de la cita para este prospecto.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input type="date" value={citadoDate} onChange={(e) => setCitadoDate(e.target.value)} className="w-full" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCitadoDialogOpen(false)} disabled={updating}>Cancelar</Button>
            <Button onClick={() => void handleGuardarCitado()} disabled={!citadoDate || updating}>
              {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar cita
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal editar prospecto */}
      <Dialog open={editProspectoOpen} onOpenChange={setEditProspectoOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Prospecto</DialogTitle>
            <DialogDescription>Modifica los datos del prospecto</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            <div className="space-y-1 col-span-2">
              <Label>Nombre completo</Label>
              <Input value={editData.nombreCompleto ?? ''} onChange={(e) => setEditData((d) => ({ ...d, nombreCompleto: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Celular</Label>
              <Input value={editData.celular ?? ''} onChange={(e) => setEditData((d) => ({ ...d, celular: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Móvil</Label>
              <Input value={editData.movil ?? ''} onChange={(e) => setEditData((d) => ({ ...d, movil: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Edad</Label>
              <Input type="number" value={editData.edad ?? ''} onChange={(e) => setEditData((d) => ({ ...d, edad: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Distrito</Label>
              <Input value={editData.distrito ?? ''} onChange={(e) => setEditData((d) => ({ ...d, distrito: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Operador</Label>
              <Select value={editData.operador || '__none__'} onValueChange={(v) => setEditData((d) => ({ ...d, operador: v === '__none__' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Sin operador" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin operador</SelectItem>
                  {operadores.map((op) => (<SelectItem key={op.id} value={op.name}>{op.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Modalidad</Label>
              <Input value={editData.modalidad ?? ''} onChange={(e) => setEditData((d) => ({ ...d, modalidad: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Placa</Label>
              <Input value={editData.placa ?? ''} onChange={(e) => setEditData((d) => ({ ...d, placa: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Año vehículo</Label>
              <Input type="number" value={editData.anioVehiculo ?? ''} onChange={(e) => setEditData((d) => ({ ...d, anioVehiculo: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Red Social</Label>
              <Input value={editData.redSocial ?? ''} onChange={(e) => setEditData((d) => ({ ...d, redSocial: e.target.value }))} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Observaciones</Label>
              <Textarea value={editData.observaciones ?? ''} onChange={(e) => setEditData((d) => ({ ...d, observaciones: e.target.value }))} className="min-h-[80px] resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProspectoOpen(false)} disabled={updating}>Cancelar</Button>
            <Button onClick={async () => {
              if (!prospecto?.id) return;
              setUpdating(true);
              try {
                const body: Record<string, unknown> = {};
                for (const [k, v] of Object.entries(editData)) {
                  if (v?.trim()) body[k] = v.trim();
                }
                if (body.edad) body.edad = parseInt(body.edad as string, 10);
                if (body.anioVehiculo) body.anioVehiculo = parseInt(body.anioVehiculo as string, 10);
                await api(`/flota-prospectos/${prospecto.id}`, { method: 'PATCH', body: JSON.stringify(body) });
                // Recargar prospecto
                const cleaned = prospecto.celular?.replace(/\D/g, '');
                if (cleaned) {
                  const res = await flotaProspectosByPhone(cleaned);
                  if (res.found && res.prospecto) setProspecto(res.prospecto);
                }
                // Si cambió el nombre, actualizar en Chatwoot
                if (body.nombreCompleto && sender?.id) {
                  updateContact(sender.id, { name: String(body.nombreCompleto) }).catch(() => {});
                  onConversationsUpdated((prev) => prev.map((c) =>
                    c.id === conversationId ? { ...c, meta: { ...c.meta, sender: { ...c.meta.sender, name: String(body.nombreCompleto) } } } : c,
                  ));
                }
                setEditProspectoOpen(false);
                toast.success('Prospecto actualizado');
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Error al guardar');
              } finally {
                setUpdating(false);
              }
            }} disabled={updating || !editData.nombreCompleto?.trim()}>
              {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
