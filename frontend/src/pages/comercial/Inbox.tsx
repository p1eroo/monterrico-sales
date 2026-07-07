import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Search,
  PenSquare,
  Inbox,
  Send,
  FileEdit,
  Star,
  Trash2,
  Reply,
  ReplyAll,
  Forward,
  Paperclip,
  ChevronLeft,
  ChevronDown,
  MoreHorizontal,
  User,
  Building2,
  Target,
  Link2,
  Loader2,
  X,
  Maximize2,
  Download,
} from 'lucide-react';
import type { EmailThread, EmailFolder, EmailMessage } from '@/types';
import { emailThreads, folderLabels, entityTypeLabels } from '@/data/emailMock';
import { useAppStore } from '@/store';
import {
  companyDetailHref,
  contactDetailHref,
  opportunityDetailHref,
} from '@/lib/detailRoutes';
import { fetchGmailMessages, fetchGmailMessage, sendGmailMessage, linkEmailToCRM, downloadGmailAttachment } from '@/lib/gmailApi';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EmailRecipientsInput } from '@/components/shared/EmailRecipientsInput';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import DOMPurify from 'dompurify';

const FOLDERS: { id: EmailFolder; icon: typeof Inbox; label: string }[] = [
  { id: 'inbox', icon: Inbox, label: 'Recibidos' },
  { id: 'sent', icon: Send, label: 'Enviados' },
  { id: 'drafts', icon: FileEdit, label: 'Borradores' },
  { id: 'starred', icon: Star, label: 'Destacados' },
  { id: 'trash', icon: Trash2, label: 'Papelera' },
];

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) {
    return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  }
  if (days === 1) return 'Ayer';
  if (days < 7) return d.toLocaleDateString('es-PE', { weekday: 'short' });
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
}

function formatFullDate(iso: string) {
  return new Date(iso).toLocaleString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getEntityIcon(type: string) {
  switch (type) {
    case 'contact':
      return User;
    case 'company':
      return Building2;
    case 'opportunity':
      return Target;
    default:
      return Link2;
  }
}

export default function InboxPage() {
  const navigate = useNavigate();
  const googleConnected = useAppStore((s) => s.googleConnected);
  const [activeFolder, setActiveFolder] = useState<EmailFolder>('inbox');
  const [search, setSearch] = useState('');
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [starredThreads, setStarredThreads] = useState<Set<string>>(new Set());
  const [readThreads, setReadThreads] = useState<Set<string>>(new Set());
  // Compose state
  const [composeTo, setComposeTo] = useState('');
  const [composeCc, setComposeCc] = useState('');
  const [composeBcc, setComposeBcc] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeAttachments, setComposeAttachments] = useState<File[]>([]);
  const [composeEmojiOpen, setComposeEmojiOpen] = useState(false);
  const [composeFormatOpen, setComposeFormatOpen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [composeMinimized, setComposeMinimized] = useState(false);
  const [composeFullscreen, setComposeFullscreen] = useState(false);
  const [composeShowCc, setComposeShowCc] = useState(false);
  const [composeShowBcc, setComposeShowBcc] = useState(false);
  const composeFileRef = useRef<HTMLInputElement>(null);
  const composeBodyRef = useRef<HTMLDivElement>(null);
  const composeHasAttachments = composeAttachments.length > 0;

  const composeAttachmentsPreview = composeHasAttachments ? (
    <div className="flex items-center gap-1 overflow-x-auto px-1 py-1 border-t">
      {composeAttachments.map((file, i) => (
        <span key={i} className="flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground whitespace-nowrap">
          <Paperclip className="size-3" />
          <span className="truncate max-w-[100px]">{file.name}</span>
          <button type="button" className="ml-0.5 hover:text-foreground" onClick={() => setComposeAttachments((prev) => prev.filter((_, j) => j !== i))}>
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  ) : null;
  // Gmail state
  const [gmailMessages, setGmailMessages] = useState<any[]>([]);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [gmailCategory, setGmailCategory] = useState<string>('PRIMARY');
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedGmailId, setSelectedGmailId] = useState<string | null>(null);
  const [selectedGmailDetail, setSelectedGmailDetail] = useState<any>(null);
  const [gmailDetailLoading, setGmailDetailLoading] = useState(false);
  const [gmailDetailError, setGmailDetailError] = useState(false);

  const gmailCategoryLabels: Record<string, string> = {
    PRIMARY: 'Principal',
    CATEGORY_SOCIAL: 'Social',
    CATEGORY_PROMOTIONS: 'Promociones',
    CATEGORY_UPDATES: 'Notificaciones',
  };

  const gmailFolderParams = useMemo(() => {
    if (!googleConnected) return { labelIds: undefined, q: undefined };
    switch (activeFolder) {
      case 'sent':
        return { q: 'in:sent' };
      case 'drafts':
        return { q: 'in:drafts' };
      case 'starred':
        return { q: 'is:starred' };
      case 'trash':
        return { q: 'in:trash' };
      default: // inbox
        return {
          labelIds: gmailCategory === 'PRIMARY' ? undefined : ['INBOX', gmailCategory],
          q: gmailCategory === 'PRIMARY' ? 'in:inbox category:primary' : undefined,
        };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleConnected, activeFolder, gmailCategory]);

  // Fetch Gmail messages
  useEffect(() => {
    if (!googleConnected) return;
    setGmailLoading(true);
    fetchGmailMessages(50, undefined, gmailFolderParams.labelIds, gmailFolderParams.q)
      .then((res) => {
        setGmailMessages(res.messages);
        setNextPageToken(res.nextPageToken);
        // Messages with UNREAD label are unread; the rest are read
        setReadThreads(new Set(res.messages.filter((m) => !m.labelIds?.includes('UNREAD')).map((m) => m.id)));
        // Populate starred set
        setStarredThreads(new Set(res.messages.filter((m) => m.labelIds?.includes('STARRED')).map((m) => m.id)));
      })
      .catch(() => toast.error('Error al cargar correos'))
      .finally(() => setGmailLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleConnected, gmailCategory, gmailFolderParams]);

  const loadMoreMessages = async () => {
    if (!nextPageToken || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetchGmailMessages(50, nextPageToken, gmailFolderParams.labelIds, gmailFolderParams.q);
      setGmailMessages((prev) => [...prev, ...res.messages]);
      setNextPageToken(res.nextPageToken);
      setStarredThreads((prev) => {
        const next = new Set(prev);
        res.messages.filter((m) => m.labelIds?.includes('STARRED')).forEach((m) => next.add(m.id));
        return next;
      });
    } catch {
      toast.error('Error al cargar más correos');
    } finally {
      setLoadingMore(false);
    }
  };

  // Fetch Gmail detail when a message is selected
  useEffect(() => {
    if (!selectedGmailId) { setSelectedGmailDetail(null); setGmailDetailError(false); return; }
    setGmailDetailLoading(true);
    setGmailDetailError(false);
    fetchGmailMessage(selectedGmailId)
      .then(setSelectedGmailDetail)
      .catch(() => {
        setGmailDetailError(true);
        toast.error('No se pudo cargar el contenido del correo');
      })
      .finally(() => setGmailDetailLoading(false));
  }, [selectedGmailId]);

  // Convert Gmail message to EmailThread shape
  const gmailThreads: EmailThread[] = useMemo(() => {
    return gmailMessages.map((msg) => {
      const msgObj: EmailMessage = {
        id: msg.id,
        from: msg.from,
        fromName: msg.from.replace(/<.*>/, '').trim() || msg.from,
        to: msg.to ? (Array.isArray(msg.to) ? msg.to : [msg.to]) : [],
        subject: msg.subject,
        body: msg.snippet || '',
        timestamp: msg.date ? new Date(msg.date).toISOString() : new Date().toISOString(),
        folder: msg.labelIds?.includes('SENT') ? 'sent' : msg.labelIds?.includes('DRAFT') ? 'drafts' : msg.labelIds?.includes('TRASH') ? 'trash' : 'inbox',
        isRead: !msg.labelIds?.includes('UNREAD'),
        isStarred: msg.labelIds?.includes('STARRED') ?? false,
        threadId: msg.threadId ?? msg.id,
        attachments: [],
      };
      return {
        id: msg.id,
        subject: msg.subject,
        messages: [msgObj],
      } as EmailThread;
    });
  }, [gmailMessages]);

  const displayThreads = googleConnected ? gmailThreads : emailThreads;

  const filteredThreads = useMemo(() => {
    return displayThreads.filter((thread) => {
      const lastMsg = thread.messages[0];
      if (!lastMsg) return false;
      const inFolder =
        activeFolder === 'starred'
          ? starredThreads.has(thread.id)
          : lastMsg.folder === activeFolder;
      const matchSearch =
        !search ||
        thread.subject.toLowerCase().includes(search.toLowerCase()) ||
        lastMsg.fromName.toLowerCase().includes(search.toLowerCase());
      return inFolder && matchSearch;
    });
  }, [displayThreads, activeFolder, search, starredThreads]);

  const toggleStar = (threadId: string) => {
    setStarredThreads((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) next.delete(threadId);
      else next.add(threadId);
      return next;
    });
  };

  const markAsRead = (threadId: string) => {
    setReadThreads((prev) => new Set(prev).add(threadId));
  };

  const isThreadUnread = (thread: EmailThread) => !readThreads.has(thread.id);
  const isThreadStarred = (thread: EmailThread) => starredThreads.has(thread.id);

  const handleSelectThread = (thread: EmailThread) => {
    setSelectedThread(thread);
    markAsRead(thread.id);
    if (googleConnected) {
      setSelectedGmailId(thread.id);
    }
  };

  const handleSendEmail = async () => {
    const bodyHtml = composeBodyRef.current?.innerHTML.trim() || composeBody;
    const bodyText = bodyHtml.replace(/<[^>]*>/g, '').trim();
    if (!composeTo.trim() || !composeSubject.trim() || !bodyText) {
      if (!composeTo.trim()) toast.error('Indica el destinatario');
      else if (!composeSubject.trim()) toast.error('El asunto es obligatorio');
      else toast.error('El mensaje no puede estar vacío');
      return;
    }
    setSendingEmail(true);
    try {
      const cc = composeShowCc ? composeCc.trim() : undefined;
      const bcc = composeShowBcc ? composeBcc.trim() : undefined;
      await sendGmailMessage(composeTo, composeSubject, bodyHtml, cc || undefined);
      toast.success('Correo enviado');

      // Vincular destinatarios al CRM
      toast.loading('Vinculando destinatario(s) al CRM...', { id: 'gmail-link' });
      try {
        await linkEmailToCRM(composeTo, composeSubject);
        toast.dismiss('gmail-link');
      } catch (e) {
        toast.dismiss('gmail-link');
        toast.error('Error al vincular: ' + (e instanceof Error ? e.message : ''));
      }
      setComposeOpen(false);
      setComposeMinimized(false);
      setComposeFullscreen(false);
      setComposeTo('');
      setComposeCc('');
      setComposeBcc('');
      setComposeSubject('');
      setComposeBody('');
      setComposeFormatOpen(false);
      setComposeEmojiOpen(false);
      if (composeBodyRef.current) composeBodyRef.current.innerHTML = '';
      setComposeShowCc(false);
      setComposeShowBcc(false);
      // Refresh after a short delay to let Gmail index the message
      setTimeout(async () => {
        try {
          const res = await fetchGmailMessages(50, undefined, gmailFolderParams.labelIds, gmailFolderParams.q);
          setGmailMessages(res.messages);
        } catch {
          // silently fail
        }
      }, 2000);
    } catch (e) {
      console.error('Error sending email:', e);
      toast.error(e instanceof Error ? e.message : 'Error al enviar el correo');
      setSendingEmail(false);
    }
  };

  if (!googleConnected) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/20 p-12">
        <div className="flex size-20 items-center justify-center rounded-full bg-[#ea4335]/10">
          <svg className="size-10" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L12 9.883l8.073-6.39C21.69 2.28 24 3.434 24 5.457z"
            />
          </svg>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold">Conecta Gmail</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Conecta tu cuenta de Gmail para ver y gestionar tus correos desde el CRM. Los correos se sincronizarán con contactos y oportunidades.
          </p>
        </div>
        <Button
          className="bg-[#13944C] hover:bg-[#0f7a3d]"
          onClick={() => navigate('/profile?tab=integraciones')}
        >
          Ir a Mi perfil → Integraciones
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-0 rounded-xl border bg-card overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden min-h-0 w-56 shrink-0 flex-col border-r bg-muted/30 lg:flex">
        <div className="p-3">
          <Button
            className="w-full bg-[#13944C] hover:bg-[#0f7a3d]"
            onClick={() => setComposeOpen(true)}
          >
            <PenSquare className="size-4" />
            Nuevo correo
          </Button>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {FOLDERS.map((f) => {
            const Icon = f.icon;
            return (
              <button
                key={f.id}
                onClick={() => setActiveFolder(f.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                  activeFolder === f.id
                    ? 'bg-[#13944C]/10 text-[#13944C] font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="size-4 shrink-0" />
                {f.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Email list */}
      <div className="flex min-h-0 flex-col border-r" style={{ flex: '0 0 620px' }}>
        {/* Mobile folder tabs */}
        <div className="flex gap-1 overflow-x-auto border-b p-2 lg:hidden">
          {FOLDERS.map((f) => {
            const Icon = f.icon;
            return (
              <button
                key={f.id}
                onClick={() => setActiveFolder(f.id)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs',
                  activeFolder === f.id
                    ? 'bg-[#13944C] text-white'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                <Icon className="size-3.5" />
                {f.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 border-b p-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar correos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        {googleConnected && activeFolder === 'inbox' && (          <div className="flex gap-0.5 border-b px-2 py-1.5">
            {Object.entries(gmailCategoryLabels).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setGmailCategory(key)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  gmailCategory === key
                    ? 'bg-[#13944C]/10 text-[#13944C]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
          <div className="divide-y">
            {filteredThreads.map((thread) => {
              const lastMsg = thread.messages[0];
              const unread = isThreadUnread(thread);
              const starred = isThreadStarred(thread);
              const preview = lastMsg.body.slice(0, 80).replace(/\n/g, ' ') + '...';
              return (
                <div
                  key={thread.id}
                  onClick={() => {
                    setSelectedThread(thread);
                    setSelectedGmailId(thread.id);
                    markAsRead(thread.id);
                  }}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50',
                    selectedThread?.id === thread.id && 'bg-muted/70',
                    unread && 'bg-[#13944C]/5'
                  )}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStar(thread.id);
                    }}
                    className="shrink-0 text-muted-foreground hover:text-amber-500"
                  >
                    <Star
                      className={cn('size-4', starred && 'fill-amber-500 text-amber-500')}
                    />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'truncate text-xs',
                          unread ? 'font-semibold' : 'font-medium'
                        )}
                      >
                        {lastMsg.fromName}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatTime(lastMsg.timestamp)}
                      </span>
                    </div>
                    <p
                      className={cn(
                        'truncate text-xs',
                        unread ? 'font-semibold text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      {thread.subject}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{preview}</p>
                  </div>
                  {thread.relatedEntityName && (
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {entityTypeLabels[thread.relatedEntityType ?? 'contact']}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
          {filteredThreads.length === 0 && !gmailLoading && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Inbox className="size-12 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">No hay correos</p>
              <p className="text-xs text-muted-foreground">
                {activeFolder === 'inbox' ? 'Tu bandeja está vacía' : `No hay correos en ${folderLabels[activeFolder]}`}
              </p>
            </div>
          )}
          {gmailLoading && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="mt-2 text-sm text-muted-foreground">Cargando correos…</p>
            </div>
          )}
          {googleConnected && nextPageToken && !gmailLoading && (
            <div className="flex justify-center border-t p-4">
              <Button variant="outline" size="sm" disabled={loadingMore} onClick={() => void loadMoreMessages()}>
                {loadingMore ? <Loader2 className="size-4 animate-spin" /> : null}
                {loadingMore ? 'Cargando…' : 'Cargar más correos'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Email detail */}
      <div
        className={cn(
          'hidden min-h-0 flex-1 flex-col bg-background md:flex',
          !selectedThread && 'md:hidden lg:flex lg:items-center lg:justify-center'
        )}
      >
        {selectedThread ? (
          <>
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => {
                    setSelectedThread(null);
                    setSelectedGmailId(null);
                  }}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <h2 className="truncate font-semibold">{selectedThread.subject}</h2>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm">
                  <Reply className="size-4" />
                  Responder
                </Button>
                {!googleConnected && (
                  <>
                    <Button variant="ghost" size="sm">
                      <ReplyAll className="size-4" />
                      Responder a todos
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Forward className="size-4" />
                      Reenviar
                    </Button>
                  </>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>Registrar como actividad</DropdownMenuItem>
                    <DropdownMenuItem>Vincular a contacto</DropdownMenuItem>
                    <DropdownMenuItem>Vincular a empresa</DropdownMenuItem>
                    <DropdownMenuItem>Vincular a oportunidad</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            {selectedThread.relatedEntityName && (
              <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2">
                {(() => {
                  const Icon = getEntityIcon(
                    selectedThread.relatedEntityType ?? 'contact'
                  );
                  return (
                    <>
                      <Icon className="size-4 text-[#13944C]" />
                      <span className="text-sm font-medium">Vinculado a:</span>
                      <button
                        type="button"
                        onClick={() => {
                          const t = selectedThread.relatedEntityType;
                          const id = selectedThread.relatedEntityId;
                          if (t === 'contact' && id) navigate(contactDetailHref({ id }));
                          if (t === 'opportunity' && id) navigate(opportunityDetailHref({ id }));
                          if (t === 'company' && id) navigate(companyDetailHref({ id }));
                        }}
                        className="text-sm text-[#13944C] hover:underline"
                      >
                        {selectedThread.relatedEntityName}
                      </button>
                      <Badge variant="secondary" className="text-[10px]">
                        {entityTypeLabels[selectedThread.relatedEntityType ?? 'contact']}
                      </Badge>
                    </>
                  );
                })()}
              </div>
            )}
        <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
          {googleConnected && selectedGmailId ? (
            <div className="p-4">
              {gmailDetailLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="size-5 animate-spin text-primary" />
                  <span className="ml-2 text-sm text-muted-foreground">Cargando contenido…</span>
                </div>
              )}

              {!gmailDetailLoading && gmailDetailError && (
                <div className="flex flex-col items-center justify-center gap-3 py-8">
                  <p className="text-sm text-muted-foreground">No se pudo cargar el correo.</p>
                  <Button variant="outline" size="sm" onClick={() => {
                    if (selectedGmailId) {
                      setGmailDetailLoading(true);
                      setGmailDetailError(false);
                      fetchGmailMessage(selectedGmailId)
                        .then(setSelectedGmailDetail)
                        .catch(() => setGmailDetailError(true))
                        .finally(() => setGmailDetailLoading(false));
                    }
                  }}>
                    Reintentar
                  </Button>
                </div>
              )}

              {selectedGmailDetail && !gmailDetailLoading && (
                <div className="rounded-lg border bg-card p-4">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#13944C]/10 text-[#13944C] font-semibold">
                        {(selectedGmailDetail.from || '?').charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{selectedGmailDetail.from}</p>
                        <p className="text-xs text-muted-foreground truncate">Para: {selectedGmailDetail.to}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">{formatFullDate(selectedGmailDetail.date)}</span>
                      <a href={`https://mail.google.com/mail/u/0/#inbox/${selectedGmailDetail.id}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                        Ver en Gmail
                      </a>
                    </div>
                  </div>

                  {selectedGmailDetail.body ? (
                    /<[a-z][\s\S]*>/i.test(selectedGmailDetail.body) ? (
                      <div className="max-h-[60vh] overflow-y-auto rounded border bg-muted/10 p-3 text-sm leading-relaxed [&_a]:text-[#13944C] [&_a]:underline" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedGmailDetail.body, { ADD_ATTR: ['target'], ADD_TAGS: ['a'] }) }} />
                    ) : (
                      <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded border bg-muted/10 p-3 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: (() => {
                        const text = selectedGmailDetail.body
                          .replace(/&/g, '&amp;')
                          .replace(/</g, '&lt;')
                          .replace(/>/g, '&gt;');
                        return text.replace(
                          /(https?:\/\/\S+)/g,
                          '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#13944C;text-decoration:underline">$1</a>'
                        );
                      })() }} />
                    )
                  ) : (
                    <p className="text-sm text-muted-foreground italic">(Sin contenido)</p>
                  )}

                  {selectedGmailDetail.attachments?.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {selectedGmailDetail.attachments.map((att: any, i: number) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => downloadGmailAttachment(selectedGmailDetail.id, att.attachmentId, att.filename).catch(() => toast.error('Error al descargar el archivo'))}
                          className="flex items-center gap-2 rounded border bg-muted/50 px-3 py-2 text-sm hover:bg-muted/80 transition-colors cursor-pointer"
                        >
                          <Paperclip className="size-4" />
                          {att.filename}
                          <span className="text-xs text-muted-foreground">({(att.size / 1024).toFixed(1)} KB)</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : selectedThread ? (
            <div className="p-4">
              {[...selectedThread.messages].reverse().map((msg) => (
                <div key={msg.id} className="rounded-lg border bg-card p-4 mb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#13944C]/10 text-[#13944C] font-semibold">
                        {msg.fromName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">{msg.fromName}</p>
                        <p className="text-xs text-muted-foreground">{msg.from}</p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{formatFullDate(msg.timestamp)}</span>
                  </div>
                  <div className="mt-4 whitespace-pre-wrap text-sm">{msg.body}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-center">
            <Inbox className="size-16 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              Selecciona un correo para leerlo
            </p>
          </div>
        )}
      </div>

      {/* Mobile FAB - Compose */}
      <Button
        className="fixed bottom-6 right-6 z-40 size-14 rounded-full shadow-lg lg:hidden"
        onClick={() => setComposeOpen(true)}
        style={{ backgroundColor: '#13944C' }}
      >
        <PenSquare className="size-6" />
      </Button>

      {/* Mobile/Tablet: overlay when no 3-column layout */}
      {selectedThread && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background lg:hidden">
          <div className="flex items-center gap-2 border-b p-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSelectedThread(null);
                setSelectedGmailId(null);
              }}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="truncate font-semibold">{selectedThread.subject}</span>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
            <div className="space-y-6 p-4">
              {googleConnected && selectedGmailDetail ? (
                <div className="rounded-lg border p-4">
                  <p className="font-medium">{selectedGmailDetail.from}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFullDate(selectedGmailDetail.date)}
                  </p>
                  {(() => {
                    const safeHtml = DOMPurify.sanitize(selectedGmailDetail.body || '<p>Sin contenido</p>', { ADD_ATTR: ['target'] });
                    return (
                      <iframe
                        sandbox="allow-same-origin"
                        srcDoc={`
                          <html>
                            <head>
                              <style>
                                body {
                                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                                  padding: 0; margin: 0; color: #111827; font-size: 14px; line-height: 1.6;
                                }
                                img { max-width: 100%; height: auto; }
                                a { color: #13944C; }
                                table { max-width: 100%; }
                                * { max-width: 100%; }
                              </style>
                            </head>
                            <body>${safeHtml}</body>
                          </html>
                        `.trim()}
                        title="Contenido del correo"
                        className="w-full min-h-[300px] rounded border-0"
                      />
                    );
                  })()}
                </div>
              ) : (
                [...selectedThread.messages].reverse().map((msg) => (
                  <div key={msg.id} className="rounded-lg border p-4">
                    <p className="font-medium">{msg.fromName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFullDate(msg.timestamp)}
                    </p>
                    <div className="mt-3 whitespace-pre-wrap text-sm">{msg.body}</div>
                  </div>
                ))
              )}
            </div>
            </div>
        </div>
      )}

      {/* Compose floating card / fullscreen */}
      {composeOpen && composeFullscreen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="flex h-[90vh] w-[90vw] max-w-4xl flex-col rounded-xl border border-border bg-card shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b px-5 py-3">
              <span className="text-base font-semibold text-foreground">Nuevo mensaje</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setComposeFullscreen(false)} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Vista flotante">
                  <ChevronDown className="size-4" />
                </button>
                <button type="button" onClick={() => { setComposeOpen(false); setComposeMinimized(false); setComposeFullscreen(false); }} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Cerrar">
                  <X className="size-4" />
                </button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              {/* Recipients */}
              <div className="shrink-0">
                <div className="flex items-center gap-2 border-b px-5">
                  <span className="w-10 shrink-0 text-xs font-medium text-muted-foreground">Para</span>
                  <EmailRecipientsInput value={composeTo} onChange={setComposeTo} />
                </div>
                {composeShowCc && (
                  <div className="flex items-center gap-2 border-b px-5">
                    <span className="w-10 shrink-0 text-xs font-medium text-muted-foreground">CC</span>
                    <input className="min-w-0 flex-1 border-0 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground/50" placeholder="CC" value={composeCc} onChange={(e) => setComposeCc(e.target.value)} />
                  </div>
                )}
                {composeShowBcc && (
                  <div className="flex items-center gap-2 border-b px-5">
                    <span className="w-10 shrink-0 text-xs font-medium text-muted-foreground">CCO</span>
                    <input className="min-w-0 flex-1 border-0 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground/50" placeholder="CCO" value={composeBcc} onChange={(e) => setComposeBcc(e.target.value)} />
                  </div>
                )}
                {(!composeShowCc || !composeShowBcc) && (
                  <div className="flex items-center gap-3 border-b px-5 py-1.5">
                    {!composeShowCc && <button type="button" onClick={() => setComposeShowCc(true)} className="text-xs text-primary hover:underline">CC</button>}
                    {!composeShowBcc && <button type="button" onClick={() => setComposeShowBcc(true)} className="text-xs text-primary hover:underline">CCO</button>}
                  </div>
                )}
              </div>
              <div className="shrink-0 border-b px-5">
                <input className="w-full border-0 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground/50" placeholder="Asunto" value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} />
              </div>
              <div
                ref={composeBodyRef}
                contentEditable
                suppressContentEditableWarning
                className="min-h-0 flex-1 overflow-y-auto border-0 bg-transparent px-5 py-3 text-sm outline-none [&:empty:before]:content-[attr(data-placeholder)] [&:empty:before]:text-muted-foreground/50"
                data-placeholder="Escribe tu mensaje..."
                onInput={() => {
                  if (composeBodyRef.current) {
                    setComposeBody(composeBodyRef.current.innerHTML);
                  }
                }}
              />
              <div className="flex shrink-0 items-center justify-between border-t px-4 py-2">
                <div className="flex items-center gap-1">
                  <Button className="bg-[#13944C] hover:bg-[#0f7a3d]" disabled={sendingEmail} onClick={() => void handleSendEmail()}>
                    {sendingEmail ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    {sendingEmail ? 'Enviando…' : 'Enviar'}
                  </Button>
                  <button type="button" className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Formato"><span className="text-xs font-semibold tracking-wide">Aa</span></button>
                  <button type="button" className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Adjuntar archivos"><Paperclip className="size-4" /></button>
                  <button type="button" className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Insertar emoji"><span className="text-sm">😊</span></button>
                </div>
                <Button variant="outline" size="sm" onClick={() => setComposeFullscreen(false)}>Salir de pantalla completa</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {composeOpen && !composeFullscreen && (
        <div
          className={cn(
            'fixed z-50 shadow-xl border border-border bg-card flex flex-col',
            composeMinimized
              ? 'bottom-4 right-4 w-72 rounded-lg'
              : 'bottom-4 right-4 w-[640px] rounded-lg max-lg:left-4 max-lg:w-auto'
          )}
          style={!composeMinimized ? { maxHeight: '85vh', height: '640px' } : undefined}
        >
          {/* Header bar */}
          <div
            className={cn(
              'flex shrink-0 items-center justify-between px-4 py-2.5',
              composeMinimized ? 'rounded-lg' : 'rounded-t-lg border-b'
            )}
          >
            <span className="text-sm font-semibold text-foreground">
              {composeMinimized ? composeSubject || 'Nuevo mensaje' : 'Nuevo mensaje'}
            </span>
            <div className="flex items-center gap-0.5">
              <button type="button" onClick={() => setComposeFullscreen(true)} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Pantalla completa">
                <Maximize2 className="size-3.5" />
              </button>
              <button type="button" onClick={() => setComposeMinimized(!composeMinimized)} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title={composeMinimized ? 'Maximizar' : 'Minimizar'}>
                <ChevronDown className={cn('size-3.5 transition-transform', composeMinimized && 'rotate-180')} />
              </button>
              <button type="button" onClick={() => { setComposeOpen(false); setComposeMinimized(false); setComposeFullscreen(false); }} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Cerrar">
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Body (hidden when minimized) */}
          {!composeMinimized && (
            <div className="flex min-h-0 flex-1 flex-col">
              {/* Recipients */}
              <div className="shrink-0">
                {/* PARA */}
                <div className="flex items-center gap-2 px-4">
                  <span className="w-10 shrink-0 text-xs font-medium text-muted-foreground">Para</span>
                  <EmailRecipientsInput value={composeTo} onChange={setComposeTo} />
                </div>
                <div className="mx-4 border-b" />
                {/* CC */}
                {composeShowCc && (
                  <>
                    <div className="flex items-center gap-2 px-4">
                      <span className="w-10 shrink-0 text-xs font-medium text-muted-foreground">CC</span>
                      <input
                        className="min-w-0 flex-1 border-0 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground/50"
                        placeholder="CC"
                        value={composeCc}
                        onChange={(e) => setComposeCc(e.target.value)}
                      />
                    </div>
                    <div className="mx-4 border-b" />
                  </>
                )}
                {/* CCO */}
                {composeShowBcc && (
                  <>
                    <div className="flex items-center gap-2 px-4">
                      <span className="w-10 shrink-0 text-xs font-medium text-muted-foreground">CCO</span>
                      <input
                        className="min-w-0 flex-1 border-0 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground/50"
                        placeholder="CCO"
                        value={composeBcc}
                        onChange={(e) => setComposeBcc(e.target.value)}
                      />
                    </div>
                    <div className="mx-4 border-b" />
                  </>
                )}
                {/* CC / CCO Toggle */}
                {(!composeShowCc || !composeShowBcc) && (
                  <div className="flex items-center gap-3 px-4 py-1.5">
                    {!composeShowCc && (
                      <button type="button" onClick={() => setComposeShowCc(true)} className="text-xs text-primary hover:underline">CC</button>
                    )}
                    {!composeShowBcc && (
                      <button type="button" onClick={() => setComposeShowBcc(true)} className="text-xs text-primary hover:underline">CCO</button>
                    )}
                  </div>
                )}
              </div>  {/* recipients shrink-0 */}

              {/* Asunto */}
              <div className="shrink-0">
                <div className="px-4">
                  <input
                    className="w-full border-0 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground/50"
                    placeholder="Asunto"
                    value={composeSubject}
                    onChange={(e) => setComposeSubject(e.target.value)}
                  />
                </div>
                <div className="mx-4 border-b" />
              </div>  {/* asunto shrink-0 */}

              {/* Rich text body */}
              <div
                ref={composeBodyRef}
                contentEditable
                suppressContentEditableWarning
                className="min-h-0 flex-1 overflow-y-auto border-0 bg-transparent px-4 py-3 text-sm outline-none [&:empty:before]:content-[attr(data-placeholder)] [&:empty:before]:text-muted-foreground/50"
                data-placeholder="Escribe tu mensaje..."
                onInput={() => {
                  if (composeBodyRef.current) {
                    setComposeBody(composeBodyRef.current.innerHTML);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void handleSendEmail();
                  }
                }}
              />

              {/* Toolbar */}
              <div className="shrink-0">
                <div className="mx-4 border-t" />
                 <div className="flex items-center justify-between px-2 py-1.5">
                   <div className="flex items-center gap-0.5">
                  <Button
                    size="sm"
                    className="bg-[#13944C] hover:bg-[#0f7a3d]"
                    disabled={sendingEmail}
                    onClick={() => void handleSendEmail()}
                  >
                    {sendingEmail ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                    {sendingEmail ? 'Enviando…' : 'Enviar'}
                  </Button>

                  {/* Aa — Format popover */}
                  <div className="relative">
                    <button
                      type="button"
                      className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      title="Formato"
                      onClick={() => setComposeFormatOpen(!composeFormatOpen)}
                    >
                      <span className="text-xs font-semibold tracking-wide">Aa</span>
                    </button>
                    {composeFormatOpen && (
                      <div className="absolute bottom-full left-0 mb-1 flex gap-0.5 rounded-lg border bg-background p-1.5 shadow-xl" onMouseDown={(e) => e.preventDefault()}>
                        <button
                          type="button"
                          className="rounded px-2 py-1 text-sm font-bold hover:bg-muted transition-colors"
                          title="Negrita"
                          onClick={() => { document.execCommand('bold'); composeBodyRef.current?.focus(); }}
                        >B</button>
                        <button
                          type="button"
                          className="rounded px-2 py-1 text-sm font-serif italic hover:bg-muted transition-colors"
                          title="Cursiva"
                          onClick={() => { document.execCommand('italic'); composeBodyRef.current?.focus(); }}
                        >I</button>
                        <button
                          type="button"
                          className="rounded px-2 py-1 text-sm underline hover:bg-muted transition-colors"
                          title="Subrayado"
                          onClick={() => { document.execCommand('underline'); composeBodyRef.current?.focus(); }}
                        >U</button>
                        <span className="mx-0.5 self-stretch w-px bg-border" />
                        <button
                          type="button"
                          className="rounded px-2 py-1 text-sm hover:bg-muted transition-colors"
                          title="Lista ordenada"
                          onClick={() => { document.execCommand('insertOrderedList'); composeBodyRef.current?.focus(); }}
                        ><span className="text-xs">1.</span></button>
                        <button
                          type="button"
                          className="rounded px-2 py-1 text-sm hover:bg-muted transition-colors"
                          title="Lista con viñetas"
                          onClick={() => { document.execCommand('insertUnorderedList'); composeBodyRef.current?.focus(); }}
                        ><span className="text-xs">•</span></button>
                        <span className="mx-0.5 self-stretch w-px bg-border" />
                        <button
                          type="button"
                          className="rounded px-2 py-1 text-sm hover:bg-muted transition-colors"
                          title="Citar"
                          onClick={() => { document.execCommand('formatBlock', false, 'blockquote'); composeBodyRef.current?.focus(); }}
                        ><span className="text-xs">❝</span></button>
                        <button
                          type="button"
                          className="rounded px-2 py-1 text-sm hover:bg-muted transition-colors"
                          title="Enlace"
                          onClick={() => {
                            const url = prompt('URL del enlace:');
                            if (url) { document.execCommand('createLink', false, url); composeBodyRef.current?.focus(); }
                          }}
                        ><span className="text-xs">🔗</span></button>
                      </div>
                    )}
                  </div>

                  {/* Adjuntar archivos */}
                  <button
                    type="button"
                    className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    title="Adjuntar archivos"
                    onClick={() => composeFileRef.current?.click()}
                  >
                    <Paperclip className="size-4" />
                  </button>
                  <input
                    ref={composeFileRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      if (files.length > 0) {
                        setComposeAttachments((prev) => [...prev, ...files]);
                      }
                      e.target.value = '';
                    }}
                  />

                  {/* Emoji picker */}
                  <div className="relative">
                    <button
                      type="button"
                      className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      title="Insertar emoji"
                      onClick={() => setComposeEmojiOpen(!composeEmojiOpen)}
                    >
                      <span className="text-sm">😊</span>
                    </button>
                    {composeEmojiOpen && (
                      <div className="absolute bottom-full left-0 mb-1 grid w-64 grid-cols-8 gap-0.5 rounded-lg border bg-background p-2 shadow-xl">
                        {['😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎','😍','😘','🥰','😗','😙','😚','🙂','🤗','🤩','🤔','🤨','😐','😑','😶','🙄','😏','😣','😥','😮','🤐','😯','😪','😫','😴','😌','😛','😜','😝','🤤','😒','😓','😔','😕','🙃','🤑','😲','☹️','🙁','😖','😞','😟','😤','😢','😭','😦','😧','😨','😩','🤯','😬','😰','😱','🥵','🥶','😳','🤪','😵','😡','😠','🤬','👍','👎','👊','✊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💪','🎉','❤️','💔','💖','💙','💚','💛','💜','🖤','⭐','🌈','🔥','💯','✅','❌','📎','📧','📅','📁','📂','📌','🔗','🎯','💡','🚀','⭐','🎁'].map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            className="rounded p-1 text-sm hover:bg-muted transition-colors"
                            onClick={() => {
                              if (composeBodyRef.current) {
                                const sel = window.getSelection();
                                if (sel && sel.rangeCount > 0) {
                                  const range = sel.getRangeAt(0);
                                  if (composeBodyRef.current.contains(range.commonAncestorContainer)) {
                                    range.deleteContents();
                                    range.insertNode(document.createTextNode(emoji));
                                    range.collapse(false);
                                  } else {
                                    composeBodyRef.current.innerHTML += emoji;
                                  }
                                } else {
                                  composeBodyRef.current.innerHTML += emoji;
                                }
                                setComposeBody(composeBodyRef.current.innerHTML);
                              } else {
                                setComposeBody((prev) => prev + emoji);
                              }
                              setComposeEmojiOpen(false);
                            }}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                  </div>  {/* toolbar content */}
                {composeAttachmentsPreview}
              </div>
          </div>
          )}
        </div>
      )}
    </div>
  );
}
