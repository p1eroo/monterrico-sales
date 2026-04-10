import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { io } from 'socket.io-client';
import { Loader2, MessageCircle, RefreshCw, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Contact } from '@/types';
import { usePermissions } from '@/hooks/usePermissions';
import { API_BASE } from '@/lib/api';
import {
  fetchWhatsappMessages,
  sendWhatsappMessage,
  type WhatsappMessageItem,
  type WhatsappSocketPayload,
} from '@/lib/whatsappApi';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

function mergeChatItem(
  prev: WhatsappMessageItem[],
  item: WhatsappMessageItem,
): WhatsappMessageItem[] {
  const rest = prev.filter((x) => x.id !== item.id);
  const next = [...rest, item];
  next.sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  return next;
}

function OutboundDeliveryTicks({ status }: { status?: string | null }) {
  const s = status ?? 'sent';
  if (s === 'read') {
    return (
      <span className="text-sky-300/95" title="Leído" aria-label="Leído">
        ✓✓
      </span>
    );
  }
  if (s === 'delivered') {
    return (
      <span className="text-emerald-200/65" title="Entregado" aria-label="Entregado">
        ✓✓
      </span>
    );
  }
  return (
    <span className="text-emerald-200/55" title="Enviado" aria-label="Enviado">
      ✓
    </span>
  );
}

function formatMsgTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('es-PE', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

type WhatsappContactDrawerProps = {
  contact: Contact;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function WhatsappContactDrawer({
  contact,
  open,
  onOpenChange,
}: WhatsappContactDrawerProps) {
  const { hasPermission } = usePermissions();
  const canSend =
    hasPermission('contactos.editar') || hasPermission('campanas.editar');

  const [items, setItems] = useState<WhatsappMessageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchWhatsappMessages(contact.id, 120);
      setItems(rows);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'No se pudo cargar el historial';
      toast.error(msg);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [contact.id]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  /** Polling ligero con drawer abierto y pestaña visible (~5,5 s). */
  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void load();
    }, 5500);
    return () => window.clearInterval(id);
  }, [open, load]);

  /** Refetch al volver a la pestaña o al foco de la ventana. */
  useEffect(() => {
    if (!open) return;
    const onVis = () => {
      if (document.visibilityState === 'visible') void load();
    };
    const onFocus = () => void load();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
    };
  }, [open, load]);

  /** Socket.IO: mensajes nuevos y actualización de estado de entrega. */
  useEffect(() => {
    if (!open) return;
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('accessToken')
        : null;
    if (!token) return;

    const socket = io(`${API_BASE}/whatsapp`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    socket.emit('join', { contactId: contact.id });

    const onPayload = (payload: WhatsappSocketPayload) => {
      if (payload.contactId !== contact.id) return;
      if (payload.type === 'message') {
        setItems((prev) => mergeChatItem(prev, payload.item));
      } else if (payload.type === 'status') {
        setItems((prev) =>
          prev.map((m) =>
            m.id === payload.id
              ? { ...m, waOutboundStatus: payload.waOutboundStatus }
              : m,
          ),
        );
      }
    };

    socket.on('whatsapp', onPayload);
    return () => {
      socket.off('whatsapp', onPayload);
      socket.disconnect();
    };
  }, [open, contact.id]);

  useLayoutEffect(() => {
    if (!open || !scrollRef.current) return;
    const el = scrollRef.current;
    el.scrollTop = el.scrollHeight;
  }, [open, items, loading]);

  async function onSend() {
    if (sending) return;
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    try {
      await sendWhatsappMessage(contact.id, text);
      setDraft('');
      toast.success('Mensaje enviado');
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al enviar';
      toast.error(msg);
    } finally {
      setSending(false);
      queueMicrotask(() => composerRef.current?.focus());
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className={cn(
          'flex h-full w-full flex-col gap-0 border-l border-zinc-700/80 p-0',
          'sm:max-w-[440px]',
        )}
        aria-describedby={undefined}
      >
        <SheetTitle className="sr-only">
          WhatsApp con {contact.name}
        </SheetTitle>
        <SheetDescription className="sr-only">
          Historial y envío de mensajes vía Evolution GO
        </SheetDescription>

        {/* Barra superior estilo WhatsApp */}
        <header className="flex shrink-0 items-center gap-3 bg-[#075e54] px-3 py-3 text-white dark:bg-[#1f2c34]">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15">
            <MessageCircle className="size-5 text-white" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold leading-tight">
              {contact.name}
            </p>
            <p className="truncate text-xs text-white/80">{contact.telefono}</p>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 text-white hover:bg-white/10"
              onClick={() => void load()}
              disabled={loading}
              title="Actualizar chat"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
            </Button>
            <SheetClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 text-white hover:bg-white/10"
                title="Cerrar"
              >
                <X className="size-5" />
              </Button>
            </SheetClose>
          </div>
        </header>

        {/* Fondo conversación */}
        <div
          ref={scrollRef}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#0b141a] px-3 py-4 outline-none focus:outline-none dark:bg-[#0b141a]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        >
          {loading && items.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-white/50">
              <Loader2 className="size-8 animate-spin text-emerald-500/80" />
              Cargando mensajes…
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center text-sm text-white/55">
              <MessageCircle
                className="mb-3 size-12 text-white/20"
                strokeWidth={1.25}
              />
              <p className="font-medium text-white/70">Sin mensajes aún</p>
              <p className="mt-2 max-w-[280px] text-xs leading-relaxed">
                Los mensajes entrantes aparecen aquí al configurar el webhook
                de Evolution GO con tu CRM.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {items.map((m) => {
                const outbound = m.direction === 'outbound';
                return (
                  <li
                    key={m.id}
                    className={cn(
                      'flex w-full',
                      outbound ? 'justify-end' : 'justify-start',
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[85%] rounded-lg px-2.5 py-1.5 shadow-sm',
                        outbound
                          ? 'rounded-br-none bg-[#005c4b] text-[13px] text-[#e9edef]'
                          : 'rounded-bl-none bg-[#202c33] text-[13px] text-[#e9edef]',
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words leading-snug">
                        {m.body}
                      </p>
                      <p
                        className={cn(
                          'mt-1 flex items-center justify-end gap-1 text-right text-[10px] tabular-nums',
                          outbound ? 'text-emerald-200/70' : 'text-white/45',
                        )}
                      >
                        <span>{formatMsgTime(m.createdAt)}</span>
                        {outbound ? (
                          <OutboundDeliveryTicks status={m.waOutboundStatus} />
                        ) : null}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Compositor */}
        <div className="shrink-0 border-t border-zinc-700/60 bg-[#1f2c34] p-3 dark:bg-[#1f2c34]">
          {canSend ? (
            <div className="flex items-end gap-2">
              <Textarea
                ref={composerRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Escribe un mensaje"
                rows={1}
                readOnly={sending}
                className={cn(
                  'max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border-zinc-600/80 bg-[#2a3942] px-3 py-2.5 text-[13px] text-[#e9edef] placeholder:text-white/35',
                  'focus-visible:border-emerald-600/50 focus-visible:ring-emerald-600/20',
                  sending && 'cursor-wait opacity-80',
                )}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void onSend();
                  }
                }}
              />
              <Button
                type="button"
                size="icon"
                className="size-11 shrink-0 rounded-full bg-[#00a884] text-white hover:bg-[#00c896]"
                onClick={() => void onSend()}
                disabled={sending || !draft.trim()}
                title="Enviar"
              >
                {sending ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Send className="size-5" />
                )}
              </Button>
            </div>
          ) : (
            <p className="text-center text-xs text-white/45">
              Necesitas permiso de edición en contactos o campañas para enviar.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
