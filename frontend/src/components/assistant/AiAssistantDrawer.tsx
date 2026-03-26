import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bot,
  ChevronLeft,
  Copy,
  Loader2,
  MessageSquare,
  Mic,
  Paperclip,
  Pin,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
  deleteAiConversation,
  fetchAiConversation,
  postAiChat,
  streamAiChat,
  type AiChatHistoryItem,
} from '@/lib/aiChatApi';
import { useAssistantStore } from '@/store/assistantStore';
import { useAppStore } from '@/store';
import { AssistantMessageBody } from './AssistantMessageBody';

const SUGGESTIONS = [
  '¿Qué oportunidades están por cerrarse?',
  'Muéstrame empresas inactivas',
  '¿Qué tareas tengo hoy?',
];

function formatTime(ts: number) {
  return new Intl.DateTimeFormat('es', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts));
}

export function AiAssistantDrawer() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = useAppStore((s) => s.currentUser);

  const {
    isOpen,
    isMinimized,
    pinned,
    messages,
    setOpen,
    setMinimized,
    setPinned,
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

  const streamEnabled = import.meta.env.VITE_AI_CHAT_STREAM === 'true';
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending, streamBuffer, scrollToBottom]);

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

  /** Sincroniza con PostgreSQL si el servidor tiene un hilo más reciente que el local (evita pisar un envío en curso). */
  useEffect(() => {
    if (!isOpen) return;
    void fetchAiConversation()
      .then((data) => {
        if (!data.messages?.length) return;
        const local = useAssistantStore.getState().messages;
        const localMax = local.reduce(
          (a, m) => Math.max(a, m.createdAt),
          0,
        );
        const serverMax = Math.max(
          ...data.messages.map((m) => new Date(m.createdAt).getTime()),
        );
        if (serverMax < localMax) return;
        hydrateMessages(
          data.messages.map((m) => ({
            id: m.id,
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
            createdAt: new Date(m.createdAt).getTime(),
            links: m.links,
            actions: m.actions,
          })),
        );
      })
      .catch(() => {
        /* offline / error: se mantiene el estado local */
      });
  }, [isOpen, hydrateMessages]);

  const sendText = async (raw: string) => {
    const text = raw.trim();
    if (!text || sending) return;

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

    addMessage({ role: 'user', content: text });
    setDraft('');
    setSending(true);

    if (streamEnabled) {
      setStreamBuffer('');
      try {
        await streamAiChat(text, ctx, history, {
          onDelta: (delta) =>
            setStreamBuffer((prev) => (prev ?? '') + delta),
          onDone: ({ message }) => {
            addMessage({
              role: 'assistant',
              content: message,
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
        });
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
      }
      return;
    }

    try {
      const res = await postAiChat(text, ctx, history);
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
    }
  };

  const onSubmit = () => void sendText(draft);

  const handleClearChat = async () => {
    if (messages.length === 0 || clearing) return;
    setClearing(true);
    try {
      await deleteAiConversation();
      clearMessages();
      setConfirmClearOpen(false);
      toast.success('Conversación borrada');
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : 'No se pudo borrar el historial en el servidor',
      );
    } finally {
      setClearing(false);
    }
  };

  const panelWidth = isMinimized
    ? 'w-14 min-w-14'
    : 'w-full min-w-0 max-w-[420px] sm:max-w-[420px]';

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
          <>
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
                        onClick={() => setPinned(!pinned)}
                        aria-label={
                          pinned ? 'Desfijar panel' : 'Fijar panel abierto'
                        }
                      >
                        <Pin
                          className={cn(
                            'size-4',
                            pinned ? 'text-[#13944C]' : 'text-muted-foreground',
                          )}
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {pinned
                        ? 'Desfijar (no recordar abierto)'
                        : 'Fijar estado al recargar'}
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
                        disabled={messages.length === 0 || clearing}
                        aria-label="Borrar conversación"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Limpiar chat (se pedirá confirmación)
                    </TooltipContent>
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

                {messages.map((m) => (
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
                        'max-w-[min(100%,320px)] rounded-2xl px-3 py-2 shadow-sm',
                        m.role === 'user'
                          ? 'rounded-br-md bg-[#13944C] text-white'
                          : 'rounded-bl-md border border-border bg-card text-card-foreground',
                      )}
                    >
                      {m.role === 'assistant' ? (
                        <AssistantMessageBody text={m.content} />
                      ) : (
                        <p className="whitespace-pre-wrap break-words text-sm">
                          {m.content}
                        </p>
                      )}

                      {m.role === 'assistant' && m.links && m.links.length > 0 && (
                        <div className="mt-2 flex flex-col gap-1 border-t border-border/60 pt-2">
                          {m.links.map((link) => (
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
                        m.actions &&
                        m.actions.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border/60 pt-2">
                            {m.actions.map((a) => (
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
                            void navigator.clipboard.writeText(m.content);
                            toast.success('Copiado');
                          }}
                        >
                          <Copy className="size-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {streamBuffer !== null && (
                  <div className="flex gap-2">
                    <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Bot className="size-4 text-[#13944C]" />
                    </div>
                    <div className="max-w-[min(100%,320px)] rounded-2xl rounded-bl-md border border-border bg-card px-3 py-2 shadow-sm">
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
                <div className="flex flex-col gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9 shrink-0 text-muted-foreground"
                        disabled
                        aria-label="Adjuntar (próximamente)"
                      >
                        <Paperclip className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Adjuntar (próximamente)</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9 shrink-0 text-muted-foreground"
                        disabled
                        aria-label="Voz (próximamente)"
                      >
                        <Mic className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Voz (próximamente)</TooltipContent>
                  </Tooltip>
                </div>
                <Button
                  type="button"
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-xl bg-[#13944C] hover:bg-[#0f7a3d]"
                  disabled={!draft.trim() || sending}
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
          </>
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
          <DialogTitle>¿Borrar toda la conversación?</DialogTitle>
          <DialogDescription>
            Se eliminará el historial en el servidor y en este dispositivo. Esta
            acción no se puede deshacer.
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
            onClick={() => void handleClearChat()}
            disabled={clearing}
          >
            {clearing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Borrando…
              </>
            ) : (
              'Borrar definitivamente'
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
