import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bot,
  ChevronLeft,
  Copy,
  Loader2,
  Maximize2,
  MessageSquare,
  Minimize2,
  Paperclip,
  Search,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { buildAssistantContext } from '@/lib/assistantContext';
import {
  createAiConversation,
  deleteAiConversationById,
  fetchAiConversationById,
  fetchAiConversations,
  postAiChat,
  streamAiChat,
  type AiChatHistoryItem,
  type AiConversationMessage,
  type AiConversationSummary,
} from '@/lib/aiChatApi';
import { getAssistantMessageDisplay } from '@/lib/assistantJsonParse';
import { useAssistantStore, type AssistantMessage } from '@/store/assistantStore';
import { useAppStore } from '@/store';
import { AssistantMessageBody } from './AssistantMessageBody';

const SUGGESTIONS = [
  '¿Qué oportunidades están por cerrarse?',
  'Muéstrame empresas sin cambio de etapa',
  '¿Qué tareas tengo hoy?',
];

const CHAT_ATTACH_ACCEPT =
  '.txt,.md,.markdown,.json,.csv,.tsv,.html,.htm,text/plain,text/markdown,application/json,text/csv,text/html';
const CHAT_ATTACH_MAX_BYTES = 10 * 1024 * 1024;
const CHAT_ATTACH_MAX_FILES = 6;
/** Por mensaje al modelo (aprox.). */
const CHAT_ATTACH_MAX_EACH_CHARS = 55_000;
const CHAT_ATTACH_MAX_COMBINED_CHARS = 100_000;

const CHAT_TEXT_EXT = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.json',
  '.csv',
  '.tsv',
  '.html',
  '.htm',
]);

function chatFileExtension(name: string): string {
  const lower = name.toLowerCase();
  const i = lower.lastIndexOf('.');
  return i < 0 ? '' : lower.slice(i);
}

async function readChatAttachmentFile(
  file: File,
): Promise<{ name: string; text: string } | null> {
  if (!file.size) {
    toast.error('El archivo está vacío.');
    return null;
  }
  if (file.size > CHAT_ATTACH_MAX_BYTES) {
    toast.error('Archivo demasiado grande (máx. 10 MB).');
    return null;
  }
  const ext = chatFileExtension(file.name || 'documento');
  if (!CHAT_TEXT_EXT.has(ext)) {
    toast.error(
      'Formato no admitido en el chat. Usa .txt, .md, .json, .csv o .html (PDF u Office: usa Conocimiento → Subir archivos).',
    );
    return null;
  }
  try {
    const text = await file.text();
    const t = text.trim();
    if (!t.length) {
      toast.error('No hay texto legible en el archivo.');
      return null;
    }
    return { name: file.name || 'documento', text: t };
  } catch {
    toast.error('No se pudo leer el archivo.');
    return null;
  }
}

function formatTime(ts: number) {
  return new Intl.DateTimeFormat('es', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts));
}

function mapApiMessagesToAssistantStore(
  rows: AiConversationMessage[],
): AssistantMessage[] {
  return rows.map((m) => ({
    id: m.id,
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
    createdAt: new Date(m.createdAt).getTime(),
    links: m.links,
    actions: m.actions,
  }));
}

export function AiAssistantDrawer() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = useAppStore((s) => s.currentUser);

  const {
    isOpen,
    isMinimized,
    chatPanelExpanded,
    activeConversationId,
    messages,
    setOpen,
    setMinimized,
    setChatPanelExpanded,
    setActiveConversationId,
    addMessage,
    hydrateMessages,
    clearMessages,
  } = useAssistantStore();

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  /** Texto en vivo (SSE); null = no hay stream activo. */
  const [streamBuffer, setStreamBuffer] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [conversations, setConversations] = useState<AiConversationSummary[]>(
    [],
  );
  const [chatSidebarSearch, setChatSidebarSearch] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<
    { id: string; name: string; text: string }[]
  >([]);

  const streamEnabled = import.meta.env.VITE_AI_CHAT_STREAM === 'true';
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);

  const scrollMessagesToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  /** Tras pintar el DOM (incl. hidratar mensajes al abrir el panel). */
  useLayoutEffect(() => {
    if (!isOpen || isMinimized) return;
    scrollMessagesToBottom();
  }, [
    isOpen,
    isMinimized,
    chatPanelExpanded,
    messages,
    streamBuffer,
    sending,
    scrollMessagesToBottom,
  ]);

  /** Segundo pase: el layout a veces asienta la altura un frame después (p. ej. al reabrir). */
  useEffect(() => {
    if (!isOpen || isMinimized) return;
    const t1 = window.setTimeout(() => scrollMessagesToBottom(), 0);
    const t2 = window.setTimeout(() => scrollMessagesToBottom(), 80);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [
    isOpen,
    isMinimized,
    chatPanelExpanded,
    messages.length,
    streamBuffer,
    sending,
    scrollMessagesToBottom,
  ]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        const t = e.target as HTMLElement | null;
        if (
          t &&
          (t.tagName === 'INPUT' ||
            t.tagName === 'TEXTAREA' ||
            t.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        setOpen(true);
        setMinimized(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen, setMinimized]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen, isMinimized]);

  useEffect(() => {
    if (!isOpen) setConfirmClearOpen(false);
  }, [isOpen]);

  const bootstrapAssistant = useCallback(async () => {
    try {
      let list = await fetchAiConversations();
      let active = useAssistantStore.getState().activeConversationId;
      if (!list.length) {
        const c = await createAiConversation();
        list = [c];
        setActiveConversationId(c.id);
        active = c.id;
      } else if (!active || !list.some((x) => x.id === active)) {
        active = list[0].id;
        setActiveConversationId(active);
      }
      setConversations(list);
      const data = await fetchAiConversationById(active!);
      hydrateMessages(mapApiMessagesToAssistantStore(data.messages));
    } catch {
      /* offline: se mantiene estado local */
    }
  }, [hydrateMessages, setActiveConversationId]);

  useEffect(() => {
    if (!isOpen || isMinimized) return;
    void bootstrapAssistant();
  }, [isOpen, isMinimized, bootstrapAssistant]);

  const refreshConversationList = useCallback(async () => {
    try {
      const list = await fetchAiConversations();
      setConversations(list);
    } catch {
      /* ignore */
    }
  }, []);

  const filteredConversations = useMemo(() => {
    const q = chatSidebarSearch.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, chatSidebarSearch]);

  const startNewChat = useCallback(async () => {
    if (sending) return;
    try {
      const row = await createAiConversation();
      setActiveConversationId(row.id);
      clearMessages();
      setConversations((prev) => [row, ...prev]);
      toast.success('Nuevo chat');
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'No se pudo crear el chat',
      );
    }
  }, [sending, setActiveConversationId, clearMessages]);

  const selectThread = useCallback(
    async (id: string) => {
      if (id === activeConversationId || sending) return;
      setActiveConversationId(id);
      try {
        const data = await fetchAiConversationById(id);
        hydrateMessages(mapApiMessagesToAssistantStore(data.messages));
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : 'No se pudo cargar el chat',
        );
      }
    },
    [
      activeConversationId,
      sending,
      setActiveConversationId,
      hydrateMessages,
    ],
  );

  const sendText = async (raw: string) => {
    const text = raw.trim();
    if ((!text && pendingAttachments.length === 0) || sending) return;

    const convId = useAssistantStore.getState().activeConversationId;
    if (!convId) {
      toast.error('Espera un momento a que cargue el chat.');
      void bootstrapAssistant();
      return;
    }

    const attachmentBlock =
      pendingAttachments.length > 0
        ? pendingAttachments
            .map((a) => {
              const body =
                a.text.length > CHAT_ATTACH_MAX_EACH_CHARS
                  ? `${a.text.slice(0, CHAT_ATTACH_MAX_EACH_CHARS)}\n…(contenido truncado para el envío)`
                  : a.text;
              return `--- Archivo: ${a.name} ---\n${body}`;
            })
            .join('\n\n')
        : '';

    let fullMessage = text;
    if (attachmentBlock) {
      fullMessage = text
        ? `${attachmentBlock}\n\n---\nPregunta:\n${text}`
        : `${attachmentBlock}\n\n---\nInstrucción: Analiza o resume el contenido anterior según resulte útil.`;
    }

    if (fullMessage.length > CHAT_ATTACH_MAX_COMBINED_CHARS) {
      toast.error(
        'El mensaje con archivos supera el límite. Reduce archivos o tamaño.',
      );
      return;
    }

    const ctx = buildAssistantContext(location.pathname, {
      id: currentUser.id,
      role: currentUser.role,
    });

    const history: AiChatHistoryItem[] = messages
      .filter(
        (m) =>
          !(
            m.role === 'assistant' &&
            m.content.trimStart().startsWith('**Error:**')
          ),
      )
      .map((m) => ({ role: m.role, content: m.content }));

    const displayForUser =
      pendingAttachments.length > 0
        ? text
          ? text
          : `📎 ${pendingAttachments.map((a) => a.name).join(', ')}`
        : undefined;

    addMessage({
      role: 'user',
      content: fullMessage,
      ...(displayForUser !== undefined
        ? { displayContent: displayForUser }
        : {}),
    });
    setDraft('');
    setPendingAttachments([]);
    setSending(true);

    if (streamEnabled) {
      setStreamBuffer('');
      try {
        await streamAiChat(fullMessage, ctx, history, {
          onDelta: (delta) =>
            setStreamBuffer((prev) => (prev ?? '') + delta),
          onDone: ({ message, links, actions }) => {
            addMessage({
              role: 'assistant',
              content: message,
              links,
              actions,
            });
            setStreamBuffer(null);
          },
          onError: (msg) => {
            addMessage({
              role: 'assistant',
              content: `**Error:** ${msg}`,
            });
            setStreamBuffer(null);
            toast.error(msg);
          },
        }, convId);
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : 'No se pudo contactar al asistente.';
        addMessage({
          role: 'assistant',
          content: `**Error:** ${msg}`,
        });
        toast.error(msg);
        setStreamBuffer(null);
      } finally {
        setSending(false);
        setStreamBuffer(null);
        void refreshConversationList();
      }
      return;
    }

    try {
      const res = await postAiChat(fullMessage, ctx, history, convId);
      addMessage({
        role: 'assistant',
        content: res.message,
        links: res.links,
        actions: res.actions,
      });
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'No se pudo contactar al asistente.';
      addMessage({
        role: 'assistant',
        content: `**Error:** ${msg}`,
      });
      toast.error(msg);
    } finally {
      setSending(false);
      void refreshConversationList();
    }
  };

  const onSubmit = () => void sendText(draft);

  const deleteCurrentThread = async () => {
    const id = activeConversationId;
    if (!id || clearing) return;
    setClearing(true);
    try {
      await deleteAiConversationById(id);
      let list = await fetchAiConversations();
      if (!list.length) {
        const c = await createAiConversation();
        list = [c];
      }
      setConversations(list);
      const nextId = list[0].id;
      setActiveConversationId(nextId);
      const data = await fetchAiConversationById(nextId);
      hydrateMessages(mapApiMessagesToAssistantStore(data.messages));
      setPendingAttachments([]);
      setConfirmClearOpen(false);
      toast.success('Conversación eliminada');
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : 'No se pudo eliminar el chat en el servidor',
      );
    } finally {
      setClearing(false);
    }
  };

  const onAttachSelected = async (list: FileList | null) => {
    try {
      if (!list?.length) return;
      const fileArr = Array.from(list);
      const room = CHAT_ATTACH_MAX_FILES - pendingAttachments.length;
      if (room <= 0) {
        toast.error(`Máximo ${CHAT_ATTACH_MAX_FILES} archivos en cola.`);
        return;
      }
      const toRead = fileArr.slice(0, room);
      if (fileArr.length > room) {
        toast(
          `Solo se añaden ${room} archivo(s) más (${CHAT_ATTACH_MAX_FILES} máx.).`,
        );
      }
      const next: { id: string; name: string; text: string }[] = [];
      for (const file of toRead) {
        const parsed = await readChatAttachmentFile(file);
        if (parsed) {
          next.push({
            id: crypto.randomUUID(),
            name: parsed.name,
            text: parsed.text,
          });
        }
      }
      if (next.length) {
        setPendingAttachments((prev) => [...prev, ...next]);
      }
    } finally {
      if (attachInputRef.current) attachInputRef.current.value = '';
    }
  };

  const panelWidth = isMinimized
    ? 'w-14 min-w-14'
    : chatPanelExpanded
      ? 'w-full min-w-0 max-w-[min(100vw-12px,56rem)]'
      : 'w-full min-w-0 max-w-[min(100vw-12px,560px)] sm:max-w-[600px]';

  const bubbleMaxClass = chatPanelExpanded
    ? 'max-w-[min(100%,520px)]'
    : 'max-w-[min(100%,320px)]';

  return (
    <>
    {isOpen ? (
    <div
      className="pointer-events-none fixed inset-y-0 right-0 z-[100] flex max-h-[100dvh] flex-col"
      aria-hidden={false}
    >
      <aside
        className={cn(
          'pointer-events-auto flex h-full flex-col border-l border-border bg-background shadow-[-8px_0_24px_-4px_rgba(0,0,0,0.12)] transition-[transform,opacity,width] duration-300 ease-out dark:shadow-[-8px_0_24px_-4px_rgba(0,0,0,0.45)]',
          panelWidth,
          'animate-in slide-in-from-right-4 fade-in-0 duration-300',
        )}
      >
        {isMinimized ? (
          <div className="flex h-full flex-col items-center gap-2 border-b border-border py-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 shrink-0"
                  onClick={() => setMinimized(false)}
                  aria-label="Expandir asistente"
                >
                  <ChevronLeft className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Expandir panel</TooltipContent>
            </Tooltip>
            <div className="flex flex-1 items-center justify-center">
              <Sparkles className="size-5 text-[#13944C]" />
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 shrink-0"
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar asistente"
                >
                  <X className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Cerrar</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div className="flex min-h-0 min-w-0 flex-1 flex-row">
            {chatPanelExpanded ? (
              <div className="flex w-[156px] shrink-0 flex-col border-r border-border bg-muted/20 sm:w-[200px]">
                <div className="shrink-0 space-y-2 border-b border-border p-2">
                  <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Chats
                  </p>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={chatSidebarSearch}
                      onChange={(e) => setChatSidebarSearch(e.target.value)}
                      placeholder="Buscar"
                      className="h-8 border-border bg-background pl-8 text-xs"
                      aria-label="Buscar chats"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 w-full gap-1 bg-[#13944C] text-xs text-white hover:bg-[#0f7a3d]"
                    onClick={() => void startNewChat()}
                    disabled={sending}
                  >
                    Nuevo chat
                  </Button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-1.5">
                  {filteredConversations.length === 0 ? (
                    <p className="px-2 py-3 text-center text-[11px] text-muted-foreground">
                      Sin coincidencias
                    </p>
                  ) : (
                    filteredConversations.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => void selectThread(c.id)}
                        className={cn(
                          'mb-1 w-full rounded-lg px-2 py-2 text-left text-xs transition-colors',
                          'hover:bg-muted/80',
                          c.id === activeConversationId &&
                            'bg-[#13944C]/12 font-medium text-[#13944C] dark:bg-[#13944C]/20',
                        )}
                      >
                        <span className="line-clamp-2 break-words">
                          {c.title}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : null}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <header className="flex shrink-0 flex-col gap-1 border-b border-border px-3 py-3">
              <div className="flex items-start gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#13944C]/15 text-[#13944C] dark:bg-[#13944C]/25">
                    <Sparkles className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold leading-tight">
                      Asistente AI
                    </h2>
                    <p className="truncate text-xs text-muted-foreground">
                      Tu asistente comercial inteligente
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() =>
                          setChatPanelExpanded(!chatPanelExpanded)
                        }
                        aria-label={
                          chatPanelExpanded
                            ? 'Vista compacta del chat'
                            : 'Ampliar chat'
                        }
                      >
                        {chatPanelExpanded ? (
                          <Minimize2 className="size-4" />
                        ) : (
                          <Maximize2 className="size-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[220px]">
                      {chatPanelExpanded
                        ? 'Vista compacta (oculta historial)'
                        : 'Ampliar panel e historial de chats'}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => setMinimized(true)}
                        aria-label="Minimizar"
                      >
                        <ChevronLeft className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Minimizar</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => setConfirmClearOpen(true)}
                        disabled={!activeConversationId || clearing}
                        aria-label="Eliminar este chat"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Eliminar este hilo del historial</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => setOpen(false)}
                        aria-label="Cerrar"
                      >
                        <X className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Cerrar</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </header>

            <div
              ref={scrollRef}
              className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3"
            >
              <div className="flex flex-col gap-4 pb-2">
                {messages.length === 0 && !sending && (
                  <div className="rounded-xl border border-dashed border-border/80 bg-muted/30 p-4 text-center">
                    <MessageSquare className="mx-auto mb-2 size-8 text-[#13944C]/80" />
                    <p className="text-sm font-medium text-foreground">
                      Hola 👋 Soy tu asistente.
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Puedo ayudarte a gestionar clientes, oportunidades y
                      tareas.
                    </p>
                    <div className="mt-4 flex flex-col gap-2 text-left">
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          className={cn(
                            'rounded-lg border border-border bg-background px-3 py-2 text-left text-xs transition-colors',
                            'hover:border-[#13944C]/40 hover:bg-[#13944C]/5',
                          )}
                          onClick={() => void sendText(s)}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((m) => {
                  const disp = getAssistantMessageDisplay(m);
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        'flex gap-2',
                        m.role === 'user' ? 'justify-end' : 'justify-start',
                      )}
                    >
                      {m.role === 'assistant' && (
                        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                          <Bot className="size-4 text-[#13944C]" />
                        </div>
                      )}
                      <div
                        className={cn(
                          'rounded-2xl px-3 py-2 shadow-none dark:shadow-sm',
                          bubbleMaxClass,
                          m.role === 'user'
                            ? 'rounded-br-md bg-[#13944C] text-white'
                            : 'rounded-bl-md border border-border bg-card text-card-foreground',
                        )}
                      >
                        {m.role === 'assistant' ? (
                          <AssistantMessageBody text={disp.text} />
                        ) : (
                          <p className="whitespace-pre-wrap break-words text-sm">
                            {m.displayContent ?? m.content}
                          </p>
                        )}

                        {m.role === 'assistant' &&
                          disp.links &&
                          disp.links.length > 0 && (
                            <div className="mt-2 flex flex-col gap-1 border-t border-border/60 pt-2">
                              {disp.links.map((link) => (
                                <button
                                  key={link.href + link.label}
                                  type="button"
                                  className="text-left text-xs font-medium text-[#13944C] underline-offset-2 hover:underline"
                                  onClick={() => navigate(link.href)}
                                >
                                  👉 {link.label}
                                </button>
                              ))}
                            </div>
                          )}

                        {m.role === 'assistant' &&
                          disp.actions &&
                          disp.actions.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border/60 pt-2">
                              {disp.actions.map((a) => (
                                <Button
                                  key={a.id}
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() =>
                                    void sendText(a.prompt ?? a.label)
                                  }
                                >
                                  {a.label}
                                </Button>
                              ))}
                            </div>
                          )}

                        <div
                          className={cn(
                            'mt-1.5 flex items-center justify-between gap-2',
                            m.role === 'user' ? 'text-white/70' : 'text-muted-foreground',
                          )}
                        >
                          <span className="text-[10px]">
                            {formatTime(m.createdAt)}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={cn(
                              'size-6',
                              m.role === 'user'
                                ? 'text-white/80 hover:bg-white/10 hover:text-white'
                                : '',
                            )}
                            aria-label="Copiar mensaje"
                            onClick={() => {
                              const toCopy =
                                m.role === 'assistant'
                                  ? disp.text
                                  : (m.displayContent ?? m.content);
                              void navigator.clipboard.writeText(toCopy);
                              toast.success('Copiado');
                            }}
                          >
                            <Copy className="size-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {streamBuffer !== null && (
                  <div className="flex gap-2">
                    <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Bot className="size-4 text-[#13944C]" />
                    </div>
                    <div
                      className={cn(
                        'rounded-2xl rounded-bl-md border border-border bg-card px-3 py-2 shadow-none dark:shadow-sm',
                        bubbleMaxClass,
                      )}
                    >
                      {streamBuffer.length === 0 ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="size-4 animate-spin text-[#13944C]" />
                          <span>Escribiendo…</span>
                        </div>
                      ) : (
                        <AssistantMessageBody text={streamBuffer} />
                      )}
                    </div>
                  </div>
                )}

                {sending && streamBuffer === null && (
                  <div className="flex gap-2">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Bot className="size-4 text-[#13944C]" />
                    </div>
                    <div className="rounded-2xl rounded-bl-md border border-border bg-card px-3 py-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin text-[#13944C]" />
                        <span>Escribiendo...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <footer className="shrink-0 border-t border-border bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
              <input
                ref={attachInputRef}
                type="file"
                className="hidden"
                accept={CHAT_ATTACH_ACCEPT}
                multiple
                onChange={(e) => void onAttachSelected(e.target.files)}
              />
              {pendingAttachments.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {pendingAttachments.map((a) => (
                    <span
                      key={a.id}
                      className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] text-foreground"
                    >
                      <span className="max-w-[180px] truncate" title={a.name}>
                        📎 {a.name}
                      </span>
                      <button
                        type="button"
                        className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={`Quitar ${a.name}`}
                        onClick={() =>
                          setPendingAttachments((prev) =>
                            prev.filter((p) => p.id !== a.id),
                          )
                        }
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Textarea
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Escribe un mensaje…"
                  disabled={sending}
                  rows={1}
                  className="min-h-[44px] max-h-32 resize-none rounded-xl border-border py-3"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      onSubmit();
                    }
                  }}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 shrink-0 self-end rounded-xl text-muted-foreground"
                      disabled={sending}
                      aria-label="Adjuntar archivos de texto"
                      onClick={() => attachInputRef.current?.click()}
                    >
                      <Paperclip className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-[240px]">
                    Adjuntar .txt, .md, .json, .csv o .html (se envían al
                    asistente con tu mensaje).
                  </TooltipContent>
                </Tooltip>
                <Button
                  type="button"
                  size="icon"
                  className="h-11 w-11 shrink-0 self-end rounded-xl bg-[#13944C] hover:bg-[#0f7a3d]"
                  disabled={
                    (!draft.trim() && pendingAttachments.length === 0) ||
                    sending
                  }
                  onClick={onSubmit}
                  aria-label="Enviar"
                >
                  {sending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                </Button>
              </div>
              <p className="mt-2 text-center text-[10px] text-muted-foreground">
                Enter envía · Shift+Enter nueva línea ·{' '}
                <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">
                  Ctrl
                </kbd>
                {' + '}
                <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">
                  K
                </kbd>
              </p>
            </footer>
            </div>
          </div>
        )}
      </aside>
    </div>
    ) : null}

    <Dialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
      <DialogContent
        overlayClassName="z-[105]"
        className="z-[110]"
        showCloseButton={!clearing}
        onPointerDownOutside={(e) => {
          if (clearing) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (clearing) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>¿Eliminar este chat?</DialogTitle>
          <DialogDescription>
            Se borrará solo este hilo y sus mensajes en el servidor. El resto de
            conversaciones en el panel lateral se conservan.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setConfirmClearOpen(false)}
            disabled={clearing}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="gap-2"
            onClick={() => void deleteCurrentThread()}
            disabled={clearing}
          >
            {clearing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Borrando…
              </>
            ) : (
              'Eliminar chat'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

/** Botón flotante / topbar: abre el drawer (estado global). */
export function AssistantLauncherButton({
  className,
}: {
  className?: string;
}) {
  const { isOpen, setOpen, setMinimized } = useAssistantStore();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={isOpen ? 'secondary' : 'ghost'}
          size="sm"
          className={cn(
            'relative gap-1.5 px-2 text-muted-foreground',
            isOpen && 'text-[#13944C]',
            className,
          )}
          onClick={() => {
            if (isOpen) {
              setOpen(false);
            } else {
              setOpen(true);
              setMinimized(false);
            }
          }}
          aria-label="Asistente AI"
          aria-expanded={isOpen}
        >
          <Sparkles className="size-4 shrink-0" />
          <span className="hidden text-xs font-medium sm:inline">Asistente</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        Asistente (Ctrl+K)
      </TooltipContent>
    </Tooltip>
  );
}
