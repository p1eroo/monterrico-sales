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
  type ChatwootAgent,
} from '@/lib/chatwootApi';
import type { ChatwootConversation } from '@/lib/chatwootApi';
import { fetchOperadores, getOperatorDisplayName, type OperadorUser } from '@/lib/flotaProspectosApi';
import { api } from '@/lib/api';

/* ==================== CHATWOOT INBOX VIEW ==================== */

export default function ChatwootInboxView() {
  const [conversations, setConversations] = useState<ChatwootConversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [messagesCache, setMessagesCache] = useState<Record<number, ChatwootMessage[]>>({});
  const [filter, setFilter] = useState<'all' | 'unread' | 'open' | 'resolved'>('all');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef(activeId);
  const socketRef = useRef<any>(null);

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
      void loadConversations();
    });

    socket.on('chatwoot', (payload: { event: string; conversationId?: number; data?: unknown }) => {
      if (!payload.conversationId) {
        void loadConversations();
        return;
      }
      const currentActiveId = activeIdRef.current;

      if (payload.event === 'conversation_updated') {
        void loadConversations();
      }

      if (payload.event === 'message_created') {
        const msgData = (payload.data as any)?.message;
        if (!msgData) return;

        if (payload.conversationId === currentActiveId) {
          setMessagesCache((prev) => {
            const existing = prev[payload.conversationId!] ?? [];
            // Evitar duplicados por ID
            if (existing.some((m) => m.id === msgData.id)) return prev;
            const next = [...existing, msgData as ChatwootMessage];
            return { ...prev, [payload.conversationId!]: next };
          });
        }
        void loadConversations();
      } else if (payload.event === 'conversation_status_changed') {
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
      const items = await fetchConversations();
      setConversations(items);
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
    estimateSize: () => 72,
    overscan: 8,
  });

  const handleSelectConversation = useCallback((id: number) => {
    setActiveId(id);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[420px_minmax(0,1fr)]">
        <aside className="flex flex-col overflow-hidden bg-card border-r border-muted">
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
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto scrollbar-thin pt-1.5">
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
            messagesCache={messagesCache}
            setMessagesCache={setMessagesCache}
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
}: {
  conversation: ChatwootConversation;
  isActive: boolean;
  index: number;
  start: number;
  measureElement: (element: HTMLElement | null) => void;
  onClick: (id: number) => void;
}) => {
  const sender = conversation.meta.sender;
  const lastMsg = conversation.messages?.[0];
  const agent = conversation.meta.assignee;

  const dateStr = useMemo(() => {
    const d = new Date(conversation.last_activity_at * 1000);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.floor((today.getTime() - msgDay.getTime()) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return d.toLocaleDateString('es-PE', { weekday: 'short' });
    return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'numeric' });
  }, [conversation.last_activity_at]);

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
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold overflow-hidden',
            (conversation.unread_count ?? 0) > 0
              ? 'bg-primary text-primary-foreground'
              : 'bg-primary/15 text-primary',
          )}>
            <ChatwootAvatar name={sender.name} thumbnail={sender.thumbnail} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className={cn('truncate text-sm', (conversation.unread_count ?? 0) > 0 ? 'font-semibold text-foreground' : 'text-foreground')}>{sender.name}</p>
              <span className="shrink-0 text-xs text-muted-foreground">{dateStr}</span>
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
                    'line-clamp-1 text-sm flex-1',
                    (conversation.unread_count ?? 0) > 0 ? 'font-medium text-foreground' : 'text-muted-foreground',
                  )}>{preview}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground/50 italic flex-1">Sin mensajes</p>
              )}
              {(conversation.unread_count ?? 0) > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground shrink-0">
                  {conversation.unread_count}
                </span>
              )}
            </div>
            {agent && (
              <div className="mt-1 flex items-center gap-1">
                <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-600">
                  <Users className="size-3" />
                  {agent.name}
                </span>
              </div>
            )}
          </div>
        </div>
      </button>
    </div>
  );
});

ChatwootConversationItem.displayName = 'ChatwootConversationItem';

/* ==================== MESSAGE ATTACHMENT ==================== */

function ChatwootMessageAttachment({ attachment, onImageClick, imageIndex }: { attachment: ChatwootAttachment; onImageClick?: (index: number) => void; imageIndex?: number }) {
  const [imgError, setImgError] = useState(false);

  const fileUrl = attachment.data_url || attachment.thumb_url;
  if (!fileUrl) return null;

  const imgUrl = `${API_BASE}/api/chatwoot/content?url=${encodeURIComponent(fileUrl)}`;

  if (attachment.file_type === 'image' || attachment.file_type?.startsWith('image/')) {
    if (imgError) {
      return (
        <div className="mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs bg-black/5 text-muted-foreground">
          <ImageIcon className="h-4 w-4 shrink-0" />
          <span>Imagen no disponible</span>
        </div>
      );
    }
    return (
      <div className="mb-2 w-full">
        <img
          src={imgUrl}
          alt="Adjunto"
          onError={() => setImgError(true)}
          className="max-h-60 w-full rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => onImageClick?.(imageIndex ?? 0)}
        />
      </div>
    );
  }

  return (
    <a
      href={imgUrl}
      target="_blank"
      rel="noreferrer"
      className="mb-2 flex items-center gap-3 rounded-lg px-3 py-2 transition bg-black/5 text-foreground hover:bg-black/10"
    >
      <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
      <span className="truncate text-sm">{attachment.file_type || 'Archivo'}</span>
    </a>
  );
}

/* ==================== CHAT PANEL ==================== */

function ChatwootChatPanel({
  conversationId,
  conversations,
  messagesCache,
  setMessagesCache,
}: {
  conversationId: number;
  conversations: ChatwootConversation[];
  messagesCache: Record<number, ChatwootMessage[]>;
  setMessagesCache: React.Dispatch<React.SetStateAction<Record<number, ChatwootMessage[]>>>;
}) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const hasInitialScrolledRef = useRef(false);
  const prevLenRef = useRef(0);
  const loadingOlderRef = useRef(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
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

  useEffect(() => {
    if (!panelOpen || !conversationId) return;
    fetchConversation(conversationId).then((d) => {
      setContactDetail(d.meta?.sender ?? null);
    }).catch(() => {});
    fetchAgents().then(setAgents).catch(() => {});
    fetchOperadores().then((ops) => setOperadores(ops)).catch(() => {});
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

  async function handleAssigneeChange(agentId: number) {
    setUpdating(true);
    const agentName = agents.find((a) => a.id === agentId)?.name;
    try {
      await updateConversation(conversationId, { assignee_id: agentId });

      // Si el agente tiene el mismo nombre que un operador de Flota, sincronizar
      if (agentName) {
        const matchingOperador = operadores.find(
          (op) => getOperatorDisplayName(op.name, operadores) === agentName || op.name === agentName,
        );
        if (matchingOperador && sender?.phone_number) {
          const cleanedPhone = sender.phone_number.replace(/\D/g, '').slice(-9);
          try {
            const prospects = await api<{ data: Array<{ id: string }> }>(
              `/flota-prospectos?celular=${cleanedPhone}&limit=1`,
            );
            const prospectId = prospects.data?.[0]?.id;
            if (prospectId) {
              await api(`/flota-prospectos/${prospectId}/operador`, {
                method: 'PATCH',
                body: JSON.stringify({ operador: agentName }),
              }).catch(() => {});
            }
          } catch {}
        }
      }

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
    if (cached && cached.length > 0) {
      setLoadingMessages(false);
      return;
    }
    setLoadingMessages(true);
    void loadMessages();
  }, [conversationId]);

  async function loadMessages() {
    try {
      const msgs = await fetchMessages(conversationId);
      // Deduplicar por ID
      const seen = new Set<number>();
      const unique = msgs.filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
      setMessagesCache((prev) => ({ ...prev, [conversationId]: unique }));
      setHasMore(unique.length >= 20);
    } catch {
      toast.error('No se pudieron cargar los mensajes');
    } finally {
      setLoadingMessages(false);
    }
  }

  const loadOlderMessages = useCallback(async () => {
    if (!conversationId || loadingOlderRef.current || !hasMore) return;
    const current = messagesCache[conversationId] ?? [];
    if (current.length === 0) return;
    const oldestMsg = current[0];

    loadingOlderRef.current = true;
    try {
      const olderMsgs = await fetchMessages(conversationId, oldestMsg.id);
      if (olderMsgs.length === 0) {
        setHasMore(false);
        return;
      }

      setMessagesCache((prev) => {
        const existing = prev[conversationId] ?? [];
        const merged = [...olderMsgs, ...existing];
        // Ordenar cronológicamente y deduplicar
        const seen = new Set<number>();
        const unique = merged.filter((m) => {
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });
        unique.sort((a, b) => a.created_at - b.created_at);
        return { ...prev, [conversationId]: unique };
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

    const grouped: { date: Date; msgs: ChatwootMessage[] }[] = [];
    let currentDate: Date | null = null;
    let currentGroup: ChatwootMessage[] = [];

    const seenIds = new Set<number>();
    for (const m of messages) {
      if (seenIds.has(m.id)) continue;
      seenIds.add(m.id);
      const msgDate = new Date(m.created_at * 1000);
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

  async function handleSend() {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    setSending(true);
    const optimisticId = `opt:${Date.now()}`;
    const optimistic: ChatwootMessage = {
      id: Date.now(),
      content: body,
      message_type: CHATWOOT_MESSAGE_TYPE.OUTGOING,
      sender: { id: 0, name: 'Yo', type: 'user' },
      created_at: Math.floor(Date.now() / 1000),
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
        [conversationId]: (prev[conversationId] ?? []).filter((m) => m.id !== Date.now()),
      }));
      setDraft(body);
      toast.error(e instanceof Error ? e.message : 'No se pudo enviar el mensaje');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 min-w-0">
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
          {loadingMessages ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messageItems.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No hay mensajes aún
            </div>
          ) : (
            <div className="space-y-1">
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
                        <span>{new Date(item.msg.created_at * 1000).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</span>
                        {item.mine && <CheckCheck className="h-3 w-3" />}
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
          <div className="flex items-end gap-2">
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
            />
            <Button
              onClick={() => void handleSend()}
              disabled={!draft.trim() || sending}
              className="shrink-0"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
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
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary shrink-0 overflow-hidden">
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
            {contactDetail?.additional_attributes && Object.keys(contactDetail.additional_attributes).length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Info adicional</h4>
                <div className="space-y-1.5">
                  {Object.entries(contactDetail.additional_attributes).map(([key, value]) => {
                    if (typeof value !== 'string' || !value || key.startsWith('avatar') || key === 'social_profiles') return null;
                    return (
                      <div key={key} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                        <span className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                        <span className="text-xs font-medium truncate ml-2">{value}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
