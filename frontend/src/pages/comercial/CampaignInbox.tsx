import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Inbox, Loader2, Search, Send, Trash2 } from 'lucide-react';
import {
  downloadMailboxAttachment,
  getMailboxThreadApi,
  listMailboxThreadsApi,
  replyMailboxThreadApi,
  type MailboxAttachment,
  type MailboxFolder,
  type MailboxMessage,
  type MailboxThreadSummary,
} from '@/lib/campaignApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { GmailMessageBody } from '@/components/shared/GmailMessageBody';
import { SenderAvatar } from '@/components/shared/SenderAvatar';
import { CampaignEmailEditor } from '@/components/shared/CampaignEmailEditor';
import { formatDateTime } from '@/lib/formatters';
import { notify } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { Attach2SvgIcon } from '@/components/icons/Attach2SvgIcon';
import { FileDownloadSvgIcon } from '@/components/icons/FileDownloadSvgIcon';
import { JpgSvgIcon } from '@/components/icons/JpgSvgIcon';
import { PdfSvgIcon } from '@/components/icons/PdfSvgIcon';
import { ReplySvgIcon } from '@/components/icons/ReplySvgIcon';
import { XlsSvgIcon } from '@/components/icons/XlsSvgIcon';

function formatListTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
}

function extractEmail(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return (match?.[1] ?? raw).trim();
}

function getAttachmentIcon(filename?: string, mimeType?: string) {
  const name = (filename ?? '').toLowerCase();
  const mime = (mimeType ?? '').toLowerCase();
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : '';

  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic'].includes(ext)) {
    return JpgSvgIcon;
  }
  if (
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    ['xls', 'xlsx', 'xlsm', 'csv'].includes(ext)
  ) {
    return XlsSvgIcon;
  }
  return PdfSvgIcon;
}

function MessageAttachments({
  messageId,
  attachments,
}: {
  messageId: string;
  attachments: MailboxAttachment[];
}) {
  if (!attachments.length) return null;
  return (
    <div className="mt-4 rounded-xl bg-muted/50 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Attach2SvgIcon className="size-5" />
        {attachments.length} {attachments.length === 1 ? 'Adjunto' : 'Adjuntos'}
      </div>
      <div className="flex flex-wrap gap-3">
        {attachments.map((att, i) => {
          const AttachmentIcon = getAttachmentIcon(att.filename, att.contentType);
          const canDownload = Boolean(att.id);
          return (
            <button
              key={att.id ?? `${att.filename ?? 'file'}-${i}`}
              type="button"
              disabled={!canDownload}
              onClick={() => {
                if (!att.id) return;
                downloadMailboxAttachment(
                  messageId,
                  att.id,
                  att.filename || 'adjunto',
                ).catch(() => notify.error('Error al descargar el archivo'));
              }}
              className={cn(
                'flex items-center gap-3 rounded-lg border bg-background px-3 py-2 text-left transition-colors',
                canDownload
                  ? 'cursor-pointer hover:bg-muted/40'
                  : 'cursor-default opacity-70',
              )}
            >
              <AttachmentIcon className="size-9 shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {att.filename || 'Archivo'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {typeof att.size === 'number' && att.size > 0
                    ? `${(att.size / 1024).toFixed(1)} KB`
                    : 'Archivo'}
                  {canDownload ? ' · Descargar' : ''}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
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
  const [threadCounterpart, setThreadCounterpart] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyHtml, setReplyHtml] = useState('');
  const [replyResetKey, setReplyResetKey] = useState(0);
  const [sendingReply, setSendingReply] = useState(false);
  const replyBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setServerSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setSelectedId(null);
    setMessages([]);
    setThreadCounterpart('');
    setReplyOpen(false);
    setReplyHtml('');
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

  const discardReply = useCallback(() => {
    setReplyOpen(false);
    setReplyHtml('');
    setReplyResetKey((k) => k + 1);
  }, []);

  const openThread = async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    setMessages([]);
    discardReply();
    try {
      const t = await getMailboxThreadApi(id);
      setThreadSubject(t.subject);
      setThreadCounterpart(t.counterpart);
      setMessages(t.messages);
    } catch {
      setMessages([]);
      setThreadCounterpart('');
    } finally {
      setDetailLoading(false);
    }
  };

  const selected = items.find((i) => i.id === selectedId);

  const replyToEmail = useMemo(() => {
    const inbound = [...messages].reverse().find((m) => m.direction === 'inbound');
    if (inbound) return extractEmail(inbound.fromEmail);
    return extractEmail(threadCounterpart || selected?.counterpart || '');
  }, [messages, threadCounterpart, selected?.counterpart]);

  useEffect(() => {
    if (!replyOpen) return;
    const t = setTimeout(() => {
      replyBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
    return () => clearTimeout(t);
  }, [replyOpen]);

  const handleSendReply = async () => {
    if (!selectedId || !replyToEmail) return;
    const bodyText = replyHtml.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    if (!bodyText) {
      notify.error('Escribe un mensaje antes de enviar');
      return;
    }
    setSendingReply(true);
    try {
      const updated = await replyMailboxThreadApi(selectedId, replyHtml);
      setThreadSubject(updated.subject);
      setThreadCounterpart(updated.counterpart);
      setMessages(updated.messages);
      discardReply();
      notify.success('Respuesta enviada', 'Tu mensaje fue enviado');
      try {
        const res = await listMailboxThreadsApi({
          folder,
          limit: 80,
          search: serverSearch || undefined,
        });
        setItems(res.items);
        setInboxCount(res.inboxCount);
        setSentCount(res.sentCount);
      } catch {
        /* la conversación ya se actualizó */
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Error al enviar la respuesta');
    } finally {
      setSendingReply(false);
    }
  };

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
                      <div className="mt-1 flex items-center gap-2">
                        {row.inboundCount > 0 && row.outboundCount > 0 && (
                          <Badge variant="secondary" className="h-5 text-[10px]">
                            Conversación
                          </Badge>
                        )}
                        {row.hasAttachments && (
                          <FileDownloadSvgIcon className="size-4 text-muted-foreground" />
                        )}
                      </div>
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
                {replyToEmail && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-foreground/70 hover:text-foreground"
                    onClick={() => setReplyOpen(true)}
                    title="Responder"
                  >
                    <ReplySvgIcon className="size-5" />
                  </Button>
                )}
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
                      const isLast = idx === messages.length - 1;
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
                              {isLast && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-foreground/70 hover:text-foreground"
                                  onClick={() => setReplyOpen(true)}
                                  title="Responder"
                                >
                                  <ReplySvgIcon className="size-5" />
                                </Button>
                              )}
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
                          <MessageAttachments
                            messageId={msg.id}
                            attachments={msg.attachments ?? []}
                          />
                        </div>
                      );
                    })}

                  {replyOpen && replyToEmail && (
                    <div
                      ref={replyBoxRef}
                      className="mt-6 rounded-xl border border-border bg-background shadow-sm"
                    >
                      <div className="flex items-center gap-2 border-b border-dashed border-border px-4 py-3">
                        <ReplySvgIcon className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate text-sm text-muted-foreground">
                          Para:{' '}
                          <span className="text-foreground">{replyToEmail}</span>
                        </span>
                      </div>
                      <div className="p-3">
                        <CampaignEmailEditor
                          initialHtml=""
                          onChange={setReplyHtml}
                          resetKey={replyResetKey}
                          placeholder="Escribe tu respuesta..."
                          compact
                          bordered={false}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2 border-t border-dashed border-border px-4 py-3">
                        <Button
                          className="bg-[#13944C] hover:bg-[#0f7a3d]"
                          disabled={sendingReply}
                          onClick={() => void handleSendReply()}
                        >
                          {sendingReply ? (
                            <>
                              <Loader2 className="mr-2 size-4 animate-spin" />
                              Enviando...
                            </>
                          ) : (
                            'Enviar'
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={discardReply}
                          title="Descartar"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
