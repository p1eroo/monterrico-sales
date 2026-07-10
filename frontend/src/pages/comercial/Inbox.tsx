import { useState, useMemo, useEffect, useCallback, useRef, type DragEvent, type ChangeEvent } from 'react';
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
import { fetchGmailMessages, fetchGmailThread, sendGmailMessage, filesToGmailAttachments, linkEmailToCRM, downloadGmailAttachment } from '@/lib/gmailApi';
import { filterValidAttachmentFiles, ingestComposeFiles } from '@/lib/composeFiles';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EmailRecipientsInput } from '@/components/shared/EmailRecipientsInput';
import { SenderAvatar } from '@/components/shared/SenderAvatar';
import { CampaignEmailEditor } from '@/components/shared/CampaignEmailEditor';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { FileDownloadSvgIcon } from '@/components/icons/FileDownloadSvgIcon';
import { PdfSvgIcon } from '@/components/icons/PdfSvgIcon';
import { JpgSvgIcon } from '@/components/icons/JpgSvgIcon';
import { XlsSvgIcon } from '@/components/icons/XlsSvgIcon';
import { Attach2SvgIcon } from '@/components/icons/Attach2SvgIcon';
import { ReplySvgIcon } from '@/components/icons/ReplySvgIcon';
import { GmailSvgIcon } from '@/components/icons/GmailSvgIcon';
import { PencilFileSvgIcon } from '@/components/icons/PencilFileSvgIcon';
import { Layout3SvgIcon } from '@/components/icons/Layout3SvgIcon';
import { Columns32SvgIcon } from '@/components/icons/Columns32SvgIcon';
import DOMPurify from 'dompurify';

type InboxLayoutMode = 'three-column' | 'two-column';

const INBOX_LAYOUT_STORAGE_KEY = 'inbox-layout-mode';

function readInboxLayoutMode(): InboxLayoutMode {
  try {
    const v = localStorage.getItem(INBOX_LAYOUT_STORAGE_KEY);
    return v === 'two-column' ? 'two-column' : 'three-column';
  } catch {
    return 'three-column';
  }
}

const FOLDERS: { id: EmailFolder; icon: typeof Inbox; label: string }[] = [
  { id: 'inbox', icon: Inbox, label: 'Recibidos' },
  { id: 'sent', icon: Send, label: 'Enviados' },
  { id: 'drafts', icon: FileEdit, label: 'Borradores' },
  { id: 'starred', icon: Star, label: 'Destacados' },
  { id: 'attachments', icon: Paperclip, label: 'Adjuntos' },
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

function formatComposeFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    const kb = Math.round(bytes / 1024);
    return `${kb.toLocaleString('es-PE')} K`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

function extractEmailFromHeader(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1].trim() : from.trim();
}

function replySubject(subject: string): string {
  const trimmed = subject.trim();
  if (/^re:/i.test(trimmed)) return trimmed;
  return `Re: ${trimmed}`;
}

function GmailMessageBody({ body }: { body: string }) {
  if (!body) {
    return <p className="text-sm text-muted-foreground italic">(Sin contenido)</p>;
  }
  if (/<[a-z][\s\S]*>/i.test(body)) {
    return (
      <div
        className="max-w-full overflow-x-hidden text-sm leading-relaxed [overflow-wrap:anywhere] [&_*]:!max-w-full [&_a]:[overflow-wrap:anywhere] [&_a]:text-[#13944C] [&_a]:underline [&_img]:h-auto [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_table]:!w-auto"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(body, { ADD_ATTR: ['target'], ADD_TAGS: ['a'] }) }}
      />
    );
  }
  const text = body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const linked = text.replace(
    /(https?:\/\/\S+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#13944C;text-decoration:underline">$1</a>',
  );
  return (
    <div
      className="max-w-full whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]"
      dangerouslySetInnerHTML={{ __html: linked }}
    />
  );
}

function GmailMessageItem({
  msg,
  showReply,
  onReply,
}: {
  msg: any;
  showReply: boolean;
  onReply: () => void;
}) {
  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <SenderAvatar from={msg.from} />
          <div className="min-w-0">
            <p className="truncate font-medium">{msg.from}</p>
            <p className="truncate text-xs text-muted-foreground">Para: {msg.to}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {showReply && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-foreground/70 hover:text-foreground"
              onClick={onReply}
              title="Responder"
            >
              <ReplySvgIcon className="size-5" />
            </Button>
          )}
          <span className="text-xs text-muted-foreground">{formatFullDate(msg.date)}</span>
        </div>
      </div>

      <GmailMessageBody body={msg.body} />

      {msg.attachments?.length > 0 && (
        <div className="mt-4 rounded-xl bg-muted/50 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Attach2SvgIcon className="size-5" />
            {msg.attachments.length}{' '}
            {msg.attachments.length === 1 ? 'Adjunto' : 'Adjuntos'}
          </div>
          <div className="flex flex-wrap gap-3">
            {msg.attachments.map((att: any, i: number) => {
              const AttachmentIcon = getAttachmentIcon(att.filename, att.mimeType);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() =>
                    downloadGmailAttachment(msg.id, att.attachmentId, att.filename).catch(() =>
                      toast.error('Error al descargar el archivo'),
                    )
                  }
                  className="flex cursor-pointer items-center gap-3 rounded-lg border bg-background px-3 py-2 text-left transition-colors hover:bg-muted/40"
                >
                  <AttachmentIcon className="size-9 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{att.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {(att.size / 1024).toFixed(1)} KB · Descargar
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function InboxPage() {
  const navigate = useNavigate();
  const googleConnected = useAppStore((s) => s.googleConnected);
  const [activeFolder, setActiveFolder] = useState<EmailFolder>('inbox');
  const [search, setSearch] = useState('');
  const [layoutMode, setLayoutMode] = useState<InboxLayoutMode>(readInboxLayoutMode);
  const isThreeColumn = layoutMode === 'three-column';
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
  const composeDragCounter = useRef(0);
  const [composeDragOver, setComposeDragOver] = useState(false);
  const composeHasAttachments = composeAttachments.length > 0;

  const syncComposeBodyFromRef = useCallback(() => {
    if (composeBodyRef.current) {
      setComposeBody(composeBodyRef.current.innerHTML);
    }
  }, []);

  const reportComposeFileErrors = useCallback((errors: string[]) => {
    for (const err of errors) toast.error(err);
  }, []);

  const addComposeAttachments = useCallback((files: File[]) => {
    if (!files.length) return;
    setComposeAttachments((prev) => [...prev, ...files]);
  }, []);

  const processComposeFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      const result = await ingestComposeFiles(files, composeBodyRef.current);
      if (result.inlineImages > 0) {
        syncComposeBodyFromRef();
        toast.success(
          result.inlineImages === 1
            ? 'Imagen insertada en el mensaje'
            : `${result.inlineImages} imágenes insertadas en el mensaje`,
        );
      }
      if (result.attachments.length) {
        addComposeAttachments(result.attachments);
        toast.success(
          result.attachments.length === 1
            ? 'Archivo adjuntado'
            : `${result.attachments.length} archivos adjuntados`,
        );
      }
      reportComposeFileErrors(result.errors);
    },
    [syncComposeBodyFromRef, addComposeAttachments, reportComposeFileErrors],
  );

  const handleComposeFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      e.target.value = '';
      if (!files.length) return;
      const { valid, errors } = filterValidAttachmentFiles(files);
      if (valid.length) {
        addComposeAttachments(valid);
        toast.success(
          valid.length === 1 ? 'Archivo adjuntado' : `${valid.length} archivos adjuntados`,
        );
      }
      reportComposeFileErrors(errors);
    },
    [addComposeAttachments, reportComposeFileErrors],
  );

  const hasComposeFileDrag = (e: DragEvent) =>
    Array.from(e.dataTransfer.types).includes('Files');

  const handleComposeDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!hasComposeFileDrag(e)) return;
    composeDragCounter.current += 1;
    setComposeDragOver(true);
  }, []);

  const handleComposeDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    composeDragCounter.current -= 1;
    if (composeDragCounter.current <= 0) {
      composeDragCounter.current = 0;
      setComposeDragOver(false);
    }
  }, []);

  const handleComposeDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (hasComposeFileDrag(e)) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleComposeDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      composeDragCounter.current = 0;
      setComposeDragOver(false);
      const files = Array.from(e.dataTransfer.files ?? []);
      if (!files.length) return;
      void processComposeFiles(files);
    },
    [processComposeFiles],
  );

  const composeBodyClassName = cn(
    'min-h-0 flex-1 overflow-y-auto border-0 bg-transparent text-sm outline-none [&:empty:before]:content-[attr(data-placeholder)] [&:empty:before]:text-muted-foreground/50',
    composeDragOver && 'bg-primary/5',
  );

  const composeDropOverlay = composeDragOver ? (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-primary/60 bg-primary/5">
      <div className="flex flex-col items-center gap-1 text-primary">
        <Paperclip className="size-5" />
        <span className="text-xs font-medium">Suelta para adjuntar</span>
      </div>
    </div>
  ) : null;

  useEffect(() => {
    if (!composeOpen) {
      composeDragCounter.current = 0;
      setComposeDragOver(false);
    }
  }, [composeOpen]);

  const composeAttachmentsPreview = composeHasAttachments ? (
    <div className="shrink-0 divide-y border-t bg-muted/40">
      {composeAttachments.map((file, i) => (
        <div key={`${file.name}-${file.size}-${i}`} className="flex items-center gap-2 px-4 py-2">
          <Paperclip className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-sm text-[#0b57d0] dark:text-[#8ab4f8]">
            {file.name}
            <span className="text-muted-foreground"> ({formatComposeFileSize(file.size)})</span>
          </span>
          <button
            type="button"
            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Quitar adjunto"
            onClick={() => setComposeAttachments((prev) => prev.filter((_, j) => j !== i))}
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  ) : null;
  // Gmail state
  const [gmailMessages, setGmailMessages] = useState<any[]>([]);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedGmailId, setSelectedGmailId] = useState<string | null>(null);
  const [selectedGmailThreadId, setSelectedGmailThreadId] = useState<string | null>(null);
  const [selectedGmailDetail, setSelectedGmailDetail] = useState<any>(null);
  const [selectedThreadMessages, setSelectedThreadMessages] = useState<any[]>([]);
  const [gmailDetailLoading, setGmailDetailLoading] = useState(false);
  const [gmailDetailError, setGmailDetailError] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyHtml, setReplyHtml] = useState('');
  const [replyResetKey, setReplyResetKey] = useState(0);
  const [sendingReply, setSendingReply] = useState(false);
  const replyBoxRef = useRef<HTMLDivElement>(null);

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
      case 'attachments':
        return { q: 'has:attachment' };
      default: // inbox
        return { q: 'in:inbox' };
    }
  }, [googleConnected, activeFolder]);

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
  }, [googleConnected, gmailFolderParams]);

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

  // Fetch the full Gmail thread (conversation) when a message is selected
  useEffect(() => {
    if (!selectedGmailThreadId) {
      setSelectedGmailDetail(null);
      setSelectedThreadMessages([]);
      setGmailDetailError(false);
      return;
    }
    setReplyOpen(false);
    setReplyHtml('');
    setReplyResetKey((k) => k + 1);
    setGmailDetailLoading(true);
    setGmailDetailError(false);
    fetchGmailThread(selectedGmailThreadId)
      .then((thread) => {
        setSelectedThreadMessages(thread.messages);
        setSelectedGmailDetail(thread.messages[thread.messages.length - 1] ?? null);
      })
      .catch(() => {
        setGmailDetailError(true);
        toast.error('No se pudo cargar el contenido del correo');
      })
      .finally(() => setGmailDetailLoading(false));
  }, [selectedGmailThreadId]);

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
        hasAttachments: msg.hasAttachments ?? false,
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
          : activeFolder === 'attachments'
            ? (thread.hasAttachments ?? false)
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
      setSelectedGmailThreadId(thread.messages[0]?.threadId ?? thread.id);
    }
  };

  const clearSelectedThread = useCallback(() => {
    setSelectedThread(null);
    setSelectedGmailId(null);
    setSelectedGmailThreadId(null);
  }, []);

  const toggleLayoutMode = useCallback(() => {
    setLayoutMode((prev) => {
      const next: InboxLayoutMode = prev === 'three-column' ? 'two-column' : 'three-column';
      try {
        localStorage.setItem(INBOX_LAYOUT_STORAGE_KEY, next);
      } catch {
        /* noop */
      }
      return next;
    });
  }, []);

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
    const to = composeTo;
    const subject = composeSubject;
    const cc = composeShowCc ? composeCc.trim() : undefined;
    try {
      const attachments =
        composeAttachments.length > 0
          ? await filesToGmailAttachments(composeAttachments)
          : undefined;
      await sendGmailMessage(to, subject, bodyHtml, {
        cc: cc || undefined,
        attachments,
      });
      toast.success('Correo enviado');
      setComposeOpen(false);
      setComposeMinimized(false);
      setComposeFullscreen(false);
      setComposeTo('');
      setComposeCc('');
      setComposeBcc('');
      setComposeSubject('');
      setComposeBody('');
      setComposeAttachments([]);
      setComposeFormatOpen(false);
      setComposeEmojiOpen(false);
      if (composeBodyRef.current) composeBodyRef.current.innerHTML = '';
      setComposeShowCc(false);
      setComposeShowBcc(false);
      void linkEmailToCRM(to, subject)
        .then(() => toast.success('Destinatario vinculado al CRM'))
        .catch((e) =>
          toast.error('Error al vincular: ' + (e instanceof Error ? e.message : '')),
        );
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
    } finally {
      setSendingEmail(false);
    }
  };

  useEffect(() => {
    if (!replyOpen) return;
    const t = setTimeout(() => {
      replyBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
    return () => clearTimeout(t);
  }, [replyOpen]);

  const handleDiscardReply = () => {
    setReplyOpen(false);
    setReplyHtml('');
    setReplyResetKey((k) => k + 1);
  };

  const replyTarget = useMemo(() => {
    if (selectedThreadMessages.length === 0) return null;
    // Reply to the most recent message not sent by us; fallback to last message
    const inbound = [...selectedThreadMessages]
      .reverse()
      .find((m) => !(m.labelIds ?? []).includes('SENT'));
    return inbound ?? selectedThreadMessages[selectedThreadMessages.length - 1];
  }, [selectedThreadMessages]);

  const handleSendReply = async () => {
    if (!replyTarget) return;
    const bodyText = replyHtml.replace(/<[^>]*>/g, '').trim();
    if (!bodyText) {
      toast.error('Escribe un mensaje antes de enviar');
      return;
    }
    const to = extractEmailFromHeader(replyTarget.from);
    const subject = replySubject(replyTarget.subject || '');
    setSendingReply(true);
    try {
      await sendGmailMessage(to, subject, replyHtml, {
        threadId: replyTarget.threadId,
        inReplyTo: replyTarget.messageId,
      });
      toast.success('Respuesta enviada');
      handleDiscardReply();
      if (selectedGmailThreadId) {
        const thread = await fetchGmailThread(selectedGmailThreadId);
        setSelectedThreadMessages(thread.messages);
        setSelectedGmailDetail(thread.messages[thread.messages.length - 1] ?? null);
      }
      // Refrescar la lista para actualizar el preview del hilo
      fetchGmailMessages(50, undefined, gmailFolderParams.labelIds, gmailFolderParams.q)
        .then((res) => setGmailMessages(res.messages))
        .catch(() => {});
    } catch (e) {
      console.error('Error sending reply:', e);
      toast.error(e instanceof Error ? e.message : 'Error al enviar la respuesta');
    } finally {
      setSendingReply(false);
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
      <aside className="hidden min-h-0 w-60 shrink-0 flex-col border-r bg-muted/30 lg:flex">
        <div className="p-3 pt-7">
          <Button
            className="h-11 w-full gap-2 bg-[#13944C] hover:bg-[#0f7a3d]"
            onClick={() => setComposeOpen(true)}
          >
            <PencilFileSvgIcon className="size-5" />
            Redactar
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
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors',
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
      <div
        className={cn(
          'flex min-h-0 shrink-0 flex-col border-r font-sans',
          isThreeColumn
            ? 'w-full md:w-[400px] lg:w-[440px] xl:w-[500px]'
            : cn('min-w-0 flex-1', selectedThread && 'hidden md:hidden'),
        )}
      >
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
          <div className="relative min-w-0 flex-1">
            <Input
              placeholder="Buscar correos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-0 bg-transparent pr-9 shadow-none focus-visible:ring-0"
            />
            <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          <div className="h-6 w-px shrink-0 bg-border" aria-hidden />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={toggleLayoutMode}
            title={isThreeColumn ? 'Cambiar a vista de 2 columnas' : 'Cambiar a vista de 3 columnas'}
            aria-label={isThreeColumn ? 'Cambiar a vista de 2 columnas' : 'Cambiar a vista de 3 columnas'}
          >
            {isThreeColumn ? (
              <Columns32SvgIcon className="size-[18px]" />
            ) : (
              <Layout3SvgIcon className="size-[18px]" />
            )}
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
          <div className="divide-y divide-dashed divide-[#e8ecf0] dark:divide-gray-700">
            {filteredThreads.map((thread) => {
              const lastMsg = thread.messages[0];
              const unread = isThreadUnread(thread);
              const starred = isThreadStarred(thread);
              const previewLimit = isThreeColumn ? 80 : 280;
              const rawPreview = lastMsg.body.replace(/\n/g, ' ').trim();
              const preview =
                rawPreview.length > previewLimit
                  ? `${rawPreview.slice(0, previewLimit)}...`
                  : rawPreview;
              return (
                <div
                  key={thread.id}
                  onClick={() => handleSelectThread(thread)}
                  className={cn(
                    'relative flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50',
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
                  {isThreeColumn ? (
                    <>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              'truncate text-sm',
                              unread ? 'font-medium' : 'font-normal',
                            )}
                          >
                            {lastMsg.fromName}
                          </span>
                          <span className="shrink-0 text-sm font-normal text-muted-foreground">
                            {formatTime(lastMsg.timestamp)}
                          </span>
                        </div>
                        <p
                          className={cn(
                            'truncate pr-20 text-sm',
                            unread ? 'font-medium text-foreground' : 'font-normal text-muted-foreground',
                          )}
                        >
                          {thread.subject}
                        </p>
                        <p className="truncate pr-20 text-sm font-normal text-muted-foreground">
                          {preview}
                        </p>
                      </div>
                      {thread.relatedEntityName && (
                        <Badge variant="outline" className="shrink-0 text-xs font-normal">
                          {entityTypeLabels[thread.relatedEntityType ?? 'contact']}
                        </Badge>
                      )}
                      {thread.hasAttachments && (
                        <FileDownloadSvgIcon
                          className="absolute bottom-2 right-3 size-5 text-muted-foreground"
                        />
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span
                          className={cn(
                            'w-[10.5rem] shrink-0 truncate text-sm sm:w-[12rem]',
                            unread ? 'font-semibold text-foreground' : 'font-normal text-foreground',
                          )}
                        >
                          {lastMsg.fromName}
                        </span>
                        <p
                          className={cn(
                            'min-w-0 flex-1 truncate text-sm',
                            unread ? 'text-foreground' : 'text-muted-foreground',
                          )}
                        >
                          <span className={unread ? 'font-semibold text-foreground' : 'font-medium text-foreground'}>
                            {thread.subject}
                          </span>
                          {preview ? (
                            <span className="font-normal text-muted-foreground">
                              {' '}
                              — {preview}
                            </span>
                          ) : null}
                        </p>
                        <span className="shrink-0 text-sm font-normal text-muted-foreground">
                          {formatTime(lastMsg.timestamp)}
                        </span>
                        {thread.hasAttachments && (
                          <FileDownloadSvgIcon className="size-5 shrink-0 text-muted-foreground" />
                        )}
                        {thread.relatedEntityName && (
                          <Badge variant="outline" className="shrink-0 text-xs font-normal">
                            {entityTypeLabels[thread.relatedEntityType ?? 'contact']}
                          </Badge>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {filteredThreads.length === 0 && !gmailLoading && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Inbox className="size-12 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">No hay correos</p>
              <p className="text-sm font-normal text-muted-foreground">
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
          'flex min-h-0 min-w-0 flex-col bg-background',
          isThreeColumn
            ? cn(
                'hidden flex-1 md:flex',
                !selectedThread && 'md:hidden lg:flex lg:items-center lg:justify-center',
              )
            : cn('hidden flex-1', selectedThread && 'md:flex'),
        )}
      >
        {selectedThread ? (
          <>
            <div className="flex items-center justify-between gap-2 border-b border-dashed border-[#e8ecf0] px-4 py-3 dark:border-gray-700">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(!isThreeColumn ? 'md:inline-flex' : 'lg:hidden')}
                  onClick={clearSelectedThread}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <h2 className="truncate font-medium">{selectedThread.subject}</h2>
              </div>
              <div className="flex items-center gap-1">
                {googleConnected && selectedGmailId ? (
                  <Button variant="ghost" size="icon" className="size-8" asChild title="Ver en Gmail">
                    <a
                      href={`https://mail.google.com/mail/u/0/#inbox/${selectedGmailThreadId ?? selectedGmailId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <GmailSvgIcon className="size-9" />
                    </a>
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm">
                    <Reply className="size-4" />
                    Responder
                  </Button>
                )}
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
                    if (selectedGmailThreadId) {
                      setGmailDetailLoading(true);
                      setGmailDetailError(false);
                      fetchGmailThread(selectedGmailThreadId)
                        .then((thread) => {
                          setSelectedThreadMessages(thread.messages);
                          setSelectedGmailDetail(thread.messages[thread.messages.length - 1] ?? null);
                        })
                        .catch(() => setGmailDetailError(true))
                        .finally(() => setGmailDetailLoading(false));
                    }
                  }}>
                    Reintentar
                  </Button>
                </div>
              )}

              {selectedThreadMessages.length > 0 && !gmailDetailLoading && (
                <div>
                  {selectedThreadMessages.map((msg, idx) => (
                    <div
                      key={msg.id}
                      className={cn(
                        idx > 0 &&
                          'mt-6 border-t border-dashed border-[#e8ecf0] pt-6 dark:border-gray-700',
                      )}
                    >
                      <GmailMessageItem
                        msg={msg}
                        showReply={idx === selectedThreadMessages.length - 1}
                        onReply={() => setReplyOpen(true)}
                      />
                    </div>
                  ))}

                  {replyOpen && replyTarget && (
                    <div ref={replyBoxRef} className="mt-6 rounded-xl border border-border bg-background shadow-sm">
                      <div className="flex items-center gap-2 border-b border-dashed border-[#e8ecf0] px-4 py-3 dark:border-gray-700">
                        <ReplySvgIcon className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate text-sm text-muted-foreground">
                          Para:{' '}
                          <span className="text-foreground">
                            {extractEmailFromHeader(replyTarget.from)}
                          </span>
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
                      <div className="flex items-center justify-between gap-2 border-t border-dashed border-[#e8ecf0] px-4 py-3 dark:border-gray-700">
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
                          onClick={handleDiscardReply}
                          title="Descartar"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : selectedThread ? (
            <div className="p-4">
              {[...selectedThread.messages].reverse().map((msg, idx) => (
                <div key={msg.id} className={cn('pb-4', idx > 0 && 'mt-4 border-t pt-4')}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#13944C]/10 text-[#13944C] font-semibold">
                        {msg.fromName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{msg.fromName}</p>
                        <p className="text-xs text-muted-foreground truncate">{msg.from}</p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{formatFullDate(msg.timestamp)}</span>
                  </div>
                  <div className="mt-4 max-w-full whitespace-pre-wrap break-words text-sm leading-relaxed">{msg.body}</div>
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

      {/* Mobile: overlay en vista de 3 columnas o pantallas pequeñas */}
      {selectedThread && (isThreeColumn ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-background lg:hidden">
          <div className="flex items-center gap-2 border-b p-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={clearSelectedThread}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="truncate font-medium">{selectedThread.subject}</span>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
            <div className="space-y-6 p-4">
              {googleConnected && selectedThreadMessages.length > 0 ? (
                selectedThreadMessages.map((msg, idx) => (
                  <div
                    key={msg.id}
                    className={cn(idx > 0 && 'border-t border-dashed border-[#e8ecf0] pt-6 dark:border-gray-700')}
                  >
                    <GmailMessageItem
                      msg={msg}
                      showReply={idx === selectedThreadMessages.length - 1}
                      onReply={() => setReplyOpen(true)}
                    />
                  </div>
                ))
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
      ) : (
        <div className="fixed inset-0 z-50 flex flex-col bg-background md:hidden">
          <div className="flex items-center gap-2 border-b p-3">
            <Button variant="ghost" size="icon" onClick={clearSelectedThread}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="truncate font-medium">{selectedThread.subject}</span>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
            <div className="space-y-6 p-4">
              {googleConnected && selectedThreadMessages.length > 0 ? (
                selectedThreadMessages.map((msg, idx) => (
                  <div
                    key={msg.id}
                    className={cn(idx > 0 && 'border-t border-dashed border-[#e8ecf0] pt-6 dark:border-gray-700')}
                  >
                    <GmailMessageItem
                      msg={msg}
                      showReply={idx === selectedThreadMessages.length - 1}
                      onReply={() => setReplyOpen(true)}
                    />
                  </div>
                ))
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
      ))}

      {/* Compose floating card / fullscreen */}
      {composeOpen && (
        <input
          ref={composeFileRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleComposeFileInputChange}
        />
      )}
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
            <div
              className="relative flex min-h-0 flex-1 flex-col"
              onDragEnter={handleComposeDragEnter}
              onDragLeave={handleComposeDragLeave}
              onDragOver={handleComposeDragOver}
              onDrop={handleComposeDrop}
            >
              {composeDropOverlay}
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
                className={cn(composeBodyClassName, 'px-5 py-3')}
                data-placeholder="Escribe tu mensaje..."
                onInput={syncComposeBodyFromRef}
              />
              {composeAttachmentsPreview}
              <div className="flex shrink-0 items-center justify-between border-t px-4 py-2">
                <div className="flex items-center gap-1">
                  <Button className="bg-[#13944C] hover:bg-[#0f7a3d]" disabled={sendingEmail} onClick={() => void handleSendEmail()}>
                    {sendingEmail ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    {sendingEmail ? 'Enviando…' : 'Enviar'}
                  </Button>
                  <button type="button" className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Formato"><span className="text-xs font-semibold tracking-wide">Aa</span></button>
                  <button type="button" className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Adjuntar archivos" onClick={() => composeFileRef.current?.click()}><Paperclip className="size-4" /></button>
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
            <div
              className="relative flex min-h-0 flex-1 flex-col"
              onDragEnter={handleComposeDragEnter}
              onDragLeave={handleComposeDragLeave}
              onDragOver={handleComposeDragOver}
              onDrop={handleComposeDrop}
            >
              {composeDropOverlay}
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
                className={cn(composeBodyClassName, 'px-4 py-3')}
                data-placeholder="Escribe tu mensaje..."
                onInput={syncComposeBodyFromRef}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void handleSendEmail();
                  }
                }}
              />

              {/* Adjuntos + toolbar */}
              <div className="shrink-0">
                {composeAttachmentsPreview}
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
              </div>
          </div>
          )}
        </div>
      )}
    </div>
  );
}
