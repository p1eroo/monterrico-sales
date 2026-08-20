import { useEffect, useState } from 'react';
import { ChevronLeft, Inbox, Search, Send } from 'lucide-react';
import {
  getMailboxThreadApi,
  listMailboxThreadsApi,
  type MailboxFolder,
  type MailboxMessage,
  type MailboxThreadSummary,
} from '@/lib/campaignApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { GmailMessageBody } from '@/components/shared/GmailMessageBody';
import { SenderAvatar } from '@/components/shared/SenderAvatar';
import { formatDateTime } from '@/lib/formatters';
import { cn } from '@/lib/utils';

function formatListTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  const sameDay =
    d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
}

export default function CampaignInboxPage() {
  const [folder, setFolder] = useState<MailboxFolder>('inbox');
  const [searchInput, setSearchInput] = useState('');
  const [serverSearch, setServerSearch] = useState('');
  const [items, setItems] = useState<MailboxThreadSummary[]>([]);
  const [inboxCount, setInboxCount] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MailboxMessage[]>([]);
  const [threadSubject, setThreadSubject] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setServerSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setSelectedId(null);
    setMessages([]);
  }, [folder, serverSearch]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await listMailboxThreadsApi({
          folder,
          limit: 80,
          search: serverSearch || undefined,
        });
        if (cancelled) return;
        setLoadError(null);
        setItems(res.items);
        setInboxCount(res.inboxCount);
        setSentCount(res.sentCount);
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Error al cargar el buzón');
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [folder, serverSearch]);

  const openThread = async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    setMessages([]);
    try {
      const t = await getMailboxThreadApi(id);
      setThreadSubject(t.subject);
      setMessages(t.messages);
    } catch {
      setMessages([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const selected = items.find((i) => i.id === selectedId);

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-0 flex-col overflow-hidden rounded-xl border bg-card">
      {loadError && (
        <p className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          No se pudo cargar el buzón: {loadError}
        </p>
      )}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden w-44 shrink-0 flex-col border-r bg-muted/30 sm:flex">
          <nav className="space-y-0.5 p-2 pt-3">
            {(
              [
                { id: 'inbox' as const, label: 'Recibidos', icon: Inbox, count: inboxCount },
                { id: 'sent' as const, label: 'Enviados', icon: Send, count: sentCount },
              ] as const
            ).map((f) => {
              const Icon = f.icon;
              const active = folder === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFolder(f.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-[#13944C]/15 font-medium text-[#13944C]'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="flex-1 text-left">{f.label}</span>
                  <span className="text-xs tabular-nums">{f.count}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className={cn('min-w-0 flex-1 flex-col border-r sm:max-w-md lg:max-w-lg', selectedId ? 'hidden md:flex' : 'flex')}>
          <div className="flex items-center gap-2 border-b p-3">
            <div className="flex gap-1 sm:hidden">
              <Button
                size="sm"
                variant={folder === 'inbox' ? 'default' : 'outline'}
                className={folder === 'inbox' ? 'bg-[#13944C] hover:bg-[#0f7a3d]' : ''}
                onClick={() => setFolder('inbox')}
              >
                Recibidos
              </Button>
              <Button
                size="sm"
                variant={folder === 'sent' ? 'default' : 'outline'}
                className={folder === 'sent' ? 'bg-[#13944C] hover:bg-[#0f7a3d]' : ''}
                onClick={() => setFolder('sent')}
              >
                Enviados
              </Button>
            </div>
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="h-9 pl-8"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <p className="p-4 text-sm text-muted-foreground">Cargando…</p>
            ) : items.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                {folder === 'sent'
                  ? 'Aún no hay envíos. Manda una campaña para verla aquí.'
                  : 'Aún no hay respuestas. Cuando contesten una campaña, aparecerán aquí.'}
              </p>
            ) : (
              items.map((row) => {
                const active = row.id === selectedId;
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => void openThread(row.id)}
                    className={cn(
                      'flex w-full items-start gap-3 border-b px-3 py-3 text-left transition-colors',
                      active ? 'bg-[#13944C]/10' : 'hover:bg-muted/50',
                    )}
                  >
                    <SenderAvatar from={row.counterpart} className="size-9" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm font-medium">
                          {row.counterpart}
                        </p>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {formatListTime(row.lastAt)}
                        </span>
                      </div>
                      <p className="truncate text-sm">{row.subject || '(Sin asunto)'}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.lastDirection === 'outbound' ? 'Tú: ' : ''}
                        {row.preview || '—'}
                      </p>
                      {row.inboundCount > 0 && row.outboundCount > 0 && (
                        <Badge variant="secondary" className="mt-1 h-5 text-[10px]">
                          Conversación
                        </Badge>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div
          className={cn(
            'min-w-0 flex-1 flex-col bg-card',
            selectedId ? 'flex' : 'hidden md:flex',
          )}
        >
          {!selectedId ? (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
              Selecciona un correo para ver la conversación
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-dashed border-border px-4 py-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setSelectedId(null)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <h2 className="min-w-0 flex-1 truncate font-medium">
                  {threadSubject || selected?.subject || '(Sin asunto)'}
                </h2>
                {selected && selected.inboundCount > 0 && selected.outboundCount > 0 && (
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    Conversación
                  </Badge>
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
                <div className="p-4">
                  {detailLoading && (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Cargando conversación…
                    </p>
                  )}
                  {!detailLoading &&
                    messages.map((msg, idx) => {
                      const outbound = msg.direction === 'outbound';
                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            idx > 0 && 'mt-6 border-t border-dashed border-border pt-6',
                          )}
                        >
                          <div className="mb-4 flex items-start justify-between gap-4">
                            <div className="flex min-w-0 items-center gap-3">
                              <SenderAvatar from={msg.fromEmail} />
                              <div className="min-w-0">
                                <p className="truncate font-medium">{msg.fromEmail}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                  Para: {msg.toEmails.join(', ') || '—'}
                                </p>
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <Badge variant="outline" className="text-[10px] font-normal">
                                {outbound ? 'Enviado' : 'Recibido'}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatDateTime(msg.at)}
                              </span>
                            </div>
                          </div>
                          {msg.html || msg.text ? (
                            <GmailMessageBody
                              bodyHtml={msg.html}
                              bodyText={msg.text}
                              subject={msg.subject}
                              tone="theme"
                            />
                          ) : (
                            <p className="text-sm text-muted-foreground italic">
                              {outbound
                                ? 'Cuerpo del envío no disponible (campañas anteriores).'
                                : '(Sin contenido)'}
                            </p>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
