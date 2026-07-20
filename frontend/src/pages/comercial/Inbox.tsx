import { useState, useMemo, useEffect, useCallback, useRef, type DragEvent, type ChangeEvent } from 'react';
import type { Editor } from '@tiptap/core';
import { useNavigate, Link } from 'react-router-dom';
import { notify } from '@/lib/notify';
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
  MoreHorizontal,
  User,
  Building2,
  Target,
  Link2,
  Loader2,
  X,
  Download,
  Settings,
  Archive,
  Mail,
  MailOpen,
} from 'lucide-react';
import type { EmailThread, EmailFolder, EmailMessage } from '@/types';
import { emailThreads, folderLabels, entityTypeLabels } from '@/data/emailMock';
import { useAppStore } from '@/store';
import {
  companyDetailHref,
  contactDetailHref,
  opportunityDetailHref,
} from '@/lib/detailRoutes';
import { fetchGmailMessages, fetchGmailThread, sendGmailMessage, filesToGmailAttachments, linkEmailToCRM, downloadGmailAttachment, markGmailThreadRead, setGmailThreadStarred, archiveGmailThread, trashGmailThread, markGmailThreadUnread } from '@/lib/gmailApi';
import { fetchEmailSignature, resolveSignatureHtmlForEditor, prepareBodyHtmlForSend } from '@/lib/emailSignatureApi';
import { filterValidAttachmentFiles, ingestComposeFiles } from '@/lib/composeFiles';
import { EmailSignatureSettingsDialog } from '@/components/shared/EmailSignatureSettingsDialog';
import { ComposeEmailPanel } from '@/components/shared/ComposeEmailPanel';
import { GmailMessageBody } from '@/components/shared/GmailMessageBody';
import {
  InboxThreadContextMenu,
  useInboxThreadContextMenu,
} from '@/components/shared/InboxThreadContextMenu';

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
import type { GmailMessageDetail } from '@/lib/gmailApi';

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


function formatFullDate(iso: string) {
  return new Date(iso).toLocaleString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getGmailThreadId(thread: EmailThread): string {
  return thread.messages[0]?.threadId ?? thread.id;
}

function patchGmailLabelIds(
  labelIds: string[] | undefined,
  patch: { removeUnread?: boolean; addUnread?: boolean; starred?: boolean },
): string[] {
  let next = [...(labelIds ?? [])];
  if (patch.removeUnread) {
    next = next.filter((id) => id !== 'UNREAD');
  }
  if (patch.addUnread && !next.includes('UNREAD')) {
    next.push('UNREAD');
  }
  if (patch.starred === true && !next.includes('STARRED')) {
    next.push('STARRED');
  }
  if (patch.starred === false) {
    next = next.filter((id) => id !== 'STARRED');
  }
  return next;
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

function GmailMessageItem({
  msg,
  showReply,
  onReply,
}: {
  msg: GmailMessageDetail;
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

      <GmailMessageBody
        bodyHtml={msg.bodyHtml}
        bodyText={msg.bodyText}
        body={msg.body}
        subject={msg.subject}
      />

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
                      notify.error('Error al descargar el archivo'),
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
  const [composeResetKey, setComposeResetKey] = useState(0);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [composeMinimized, setComposeMinimized] = useState(false);
  const [composeFullscreen, setComposeFullscreen] = useState(false);
  const [composeShowCc, setComposeShowCc] = useState(false);
  const [composeShowBcc, setComposeShowBcc] = useState(false);
  const composeFileRef = useRef<HTMLInputElement>(null);
  const composeEditorRef = useRef<Editor | null>(null);
  const composeDragCounter = useRef(0);
  const [composeDragOver, setComposeDragOver] = useState(false);
  const [signatureSettingsOpen, setSignatureSettingsOpen] = useState(false);
  const [userSignatureHtml, setUserSignatureHtml] = useState<string | null>(null);

  const reportComposeFileErrors = useCallback((errors: string[]) => {
    for (const err of errors) notify.error(err);
  }, []);

  const addComposeAttachments = useCallback((files: File[]) => {
    if (!files.length) return;
    setComposeAttachments((prev) => [...prev, ...files]);
  }, []);

  const processComposeFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      const result = await ingestComposeFiles(files, null);
      if (result.inlineImages > 0) {
        notify.success(
          result.inlineImages === 1
            ? 'Imagen insertada en el mensaje'
            : `${result.inlineImages} imágenes insertadas en el mensaje`,
        );
      }
      if (result.attachments.length) {
        addComposeAttachments(result.attachments);
        notify.success(
          result.attachments.length === 1
            ? 'Archivo adjuntado'
            : `${result.attachments.length} archivos adjuntados`,
        );
      }
      reportComposeFileErrors(result.errors);
    },
    [addComposeAttachments, reportComposeFileErrors],
  );

  const handleComposeFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      e.target.value = '';
      if (!files.length) return;
      const { valid, errors } = filterValidAttachmentFiles(files);
      if (valid.length) {
        addComposeAttachments(valid);
        notify.success(
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

  useEffect(() => {
    if (!googleConnected) return;
    fetchEmailSignature()
      .then((res) => setUserSignatureHtml(res.html?.trim() || null))
      .catch(() => setUserSignatureHtml(null));
  }, [googleConnected]);

  const formatSignatureForInsert = useCallback((raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    if (/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed;
    return trimmed
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }, []);

  const insertComposeSignature = useCallback(async () => {
    if (!userSignatureHtml) {
      notify.error('No tienes firma configurada. Ve a Configuración para crearla.');
      setSignatureSettingsOpen(true);
      return;
    }
    const resolvedHtml = await resolveSignatureHtmlForEditor(
      formatSignatureForInsert(userSignatureHtml),
    );
    if (composeEditorRef.current) {
      composeEditorRef.current.chain().focus().insertContent(resolvedHtml).run();
      notify.success('Firma insertada');
      return;
    }
    setComposeBody((prev) => {
      const sep = prev.trim() && prev !== '<p></p>' ? '<br><br>' : '';
      return prev + sep + resolvedHtml;
    });
    notify.success('Firma insertada');
  }, [userSignatureHtml, formatSignatureForInsert]);

  const handleComposeEditorReady = useCallback((editor: Editor | null) => {
    composeEditorRef.current = editor;
  }, []);

  const closeCompose = useCallback(() => {
    setComposeOpen(false);
    setComposeMinimized(false);
    setComposeFullscreen(false);
  }, []);

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
      .catch(() => notify.error('Error al cargar correos'))
      .finally(() => setGmailLoading(false));
  }, [googleConnected, gmailFolderParams]);

  const loadMoreMessages = async () => {
    if (!nextPageToken || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetchGmailMessages(50, nextPageToken, gmailFolderParams.labelIds, gmailFolderParams.q);
      setGmailMessages((prev) => [...prev, ...res.messages]);
      setNextPageToken(res.nextPageToken);
      setReadThreads((prev) => {
        const next = new Set(prev);
        res.messages.filter((m) => !m.labelIds?.includes('UNREAD')).forEach((m) => next.add(m.id));
        return next;
      });
      setStarredThreads((prev) => {
        const next = new Set(prev);
        res.messages.filter((m) => m.labelIds?.includes('STARRED')).forEach((m) => next.add(m.id));
        return next;
      });
    } catch {
      notify.error('Error al cargar más correos');
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
        notify.error('No se pudo cargar el contenido del correo');
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

  const syncGmailThreadLabels = useCallback(
    (
      gmailThreadId: string,
      patch: { removeUnread?: boolean; addUnread?: boolean; starred?: boolean },
    ) => {
      setGmailMessages((prev) =>
        prev.map((msg) => {
          const msgThreadId = msg.threadId ?? msg.id;
          if (msgThreadId !== gmailThreadId) return msg;
          return { ...msg, labelIds: patchGmailLabelIds(msg.labelIds, patch) };
        }),
      );
    },
    [],
  );

  const toggleStar = useCallback(
    (thread: EmailThread) => {
      const listId = thread.id;
      const wasStarred = starredThreads.has(listId);
      const nextStarred = !wasStarred;

      setStarredThreads((prev) => {
        const next = new Set(prev);
        if (nextStarred) next.add(listId);
        else next.delete(listId);
        return next;
      });

      if (!googleConnected) return;

      const gmailThreadId = getGmailThreadId(thread);
      syncGmailThreadLabels(gmailThreadId, { starred: nextStarred });

      void setGmailThreadStarred(gmailThreadId, nextStarred).catch(() => {
        setStarredThreads((prev) => {
          const next = new Set(prev);
          if (wasStarred) next.add(listId);
          else next.delete(listId);
          return next;
        });
        syncGmailThreadLabels(gmailThreadId, { starred: wasStarred });
        notify.error('No se pudo actualizar el destacado en Gmail');
      });
    },
    [googleConnected, starredThreads, syncGmailThreadLabels],
  );

  const markAsRead = useCallback(
    (thread: EmailThread) => {
      if (readThreads.has(thread.id)) return;

      setReadThreads((prev) => new Set(prev).add(thread.id));

      if (!googleConnected) return;

      const gmailThreadId = getGmailThreadId(thread);
      syncGmailThreadLabels(gmailThreadId, { removeUnread: true });

      void markGmailThreadRead(gmailThreadId).catch(() => {
        setReadThreads((prev) => {
          const next = new Set(prev);
          next.delete(thread.id);
          return next;
        });
        syncGmailThreadLabels(gmailThreadId, { addUnread: true });
        notify.error('No se pudo marcar como leído en Gmail');
      });
    },
    [googleConnected, readThreads, syncGmailThreadLabels],
  );

  const isThreadUnread = (thread: EmailThread) => !readThreads.has(thread.id);
  const isThreadStarred = (thread: EmailThread) => starredThreads.has(thread.id);

  const handleSelectThread = (thread: EmailThread) => {
    setSelectedThread(thread);
    markAsRead(thread);
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

  const threadContextMenu = useInboxThreadContextMenu();

  const refreshGmailList = useCallback(async () => {
    if (!googleConnected) return;
    try {
      const res = await fetchGmailMessages(
        50,
        undefined,
        gmailFolderParams.labelIds,
        gmailFolderParams.q,
      );
      setGmailMessages(res.messages);
      setNextPageToken(res.nextPageToken);
      setReadThreads(
        new Set(res.messages.filter((m) => !m.labelIds?.includes('UNREAD')).map((m) => m.id)),
      );
      setStarredThreads(
        new Set(res.messages.filter((m) => m.labelIds?.includes('STARRED')).map((m) => m.id)),
      );
    } catch {
      notify.error('Error al actualizar la lista de correos');
    }
  }, [googleConnected, gmailFolderParams]);

  const removeThreadFromList = useCallback(
    (thread: EmailThread) => {
      const gmailThreadId = getGmailThreadId(thread);
      setGmailMessages((prev) =>
        prev.filter((msg) => {
          const msgThreadId = msg.threadId ?? msg.id;
          return msgThreadId !== gmailThreadId && msg.id !== thread.id;
        }),
      );
      setReadThreads((prev) => {
        const next = new Set(prev);
        next.delete(thread.id);
        return next;
      });
      setStarredThreads((prev) => {
        const next = new Set(prev);
        next.delete(thread.id);
        return next;
      });
      if (selectedThread?.id === thread.id) {
        clearSelectedThread();
      }
    },
    [selectedThread?.id, clearSelectedThread],
  );

  const handleArchiveThread = useCallback(
    (thread: EmailThread) => {
      if (!googleConnected) return;
      const gmailThreadId = getGmailThreadId(thread);
      removeThreadFromList(thread);
      void archiveGmailThread(gmailThreadId)
        .then(() => notify.success('Correo archivado', 'Sincronizado con Gmail'))
        .catch(() => {
          notify.error('No se pudo archivar', 'Inténtalo de nuevo');
          void refreshGmailList();
        });
    },
    [googleConnected, removeThreadFromList, refreshGmailList],
  );

  const handleTrashThread = useCallback(
    (thread: EmailThread) => {
      if (!googleConnected) return;
      const gmailThreadId = getGmailThreadId(thread);
      removeThreadFromList(thread);
      void trashGmailThread(gmailThreadId)
        .then(() => notify.success('Correo eliminado', 'Movido a la papelera'))
        .catch(() => {
          notify.error('No se pudo eliminar', 'Inténtalo de nuevo');
          void refreshGmailList();
        });
    },
    [googleConnected, removeThreadFromList, refreshGmailList],
  );

  const handleMarkThreadUnread = useCallback(
    (thread: EmailThread) => {
      if (!googleConnected) return;
      const gmailThreadId = getGmailThreadId(thread);
      setReadThreads((prev) => {
        const next = new Set(prev);
        next.delete(thread.id);
        return next;
      });
      syncGmailThreadLabels(gmailThreadId, { addUnread: true });
      void markGmailThreadUnread(gmailThreadId)
        .then(() => notify.success('Estado actualizado', 'Marcado como no leído'))
        .catch(() => {
          setReadThreads((prev) => new Set(prev).add(thread.id));
          syncGmailThreadLabels(gmailThreadId, { removeUnread: true });
          notify.error('No se pudo actualizar', 'No se marcó como no leído');
        });
    },
    [googleConnected, syncGmailThreadLabels],
  );

  const handleMarkThreadRead = useCallback(
    (thread: EmailThread) => {
      if (!googleConnected || readThreads.has(thread.id)) return;

      const gmailThreadId = getGmailThreadId(thread);
      setReadThreads((prev) => new Set(prev).add(thread.id));
      syncGmailThreadLabels(gmailThreadId, { removeUnread: true });

      void markGmailThreadRead(gmailThreadId)
        .then(() => notify.success('Estado actualizado', 'Marcado como leído'))
        .catch(() => {
          setReadThreads((prev) => {
            const next = new Set(prev);
            next.delete(thread.id);
            return next;
          });
          syncGmailThreadLabels(gmailThreadId, { addUnread: true });
          notify.error('No se pudo actualizar', 'No se marcó como leído');
        });
    },
    [googleConnected, readThreads, syncGmailThreadLabels],
  );

  const contextMenuThread = useMemo(
    () => filteredThreads.find((thread) => thread.id === threadContextMenu.threadId) ?? null,
    [filteredThreads, threadContextMenu.threadId],
  );

  const contextMenuItems = useMemo(() => {
    if (!contextMenuThread) return [];

    const unread = !readThreads.has(contextMenuThread.id);
    const readToggleItem = unread
      ? {
          id: 'read',
          label: 'Marcar como leído',
          icon: MailOpen,
          onSelect: () => handleMarkThreadRead(contextMenuThread),
        }
      : {
          id: 'unread',
          label: 'Marcar como no leída',
          icon: Mail,
          onSelect: () => handleMarkThreadUnread(contextMenuThread),
        };

    return [
      {
        id: 'archive',
        label: 'Archivar',
        icon: Archive,
        onSelect: () => handleArchiveThread(contextMenuThread),
      },
      {
        id: 'delete',
        label: 'Eliminar',
        icon: Trash2,
        onSelect: () => handleTrashThread(contextMenuThread),
        destructive: true,
      },
      readToggleItem,
    ];
  }, [
    contextMenuThread,
    handleArchiveThread,
    handleTrashThread,
    handleMarkThreadRead,
    handleMarkThreadUnread,
    readThreads,
  ]);

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
    const bodyHtml = prepareBodyHtmlForSend(composeBody, userSignatureHtml);
    const bodyText = bodyHtml.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    if (!composeTo.trim() || !composeSubject.trim() || !bodyText) {
      if (!composeTo.trim()) notify.error('Indica el destinatario');
      else if (!composeSubject.trim()) notify.error('El asunto es obligatorio');
      else notify.error('El mensaje no puede estar vacío');
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
      notify.success('Correo enviado', 'El mensaje se entregó correctamente');
      setComposeOpen(false);
      setComposeMinimized(false);
      setComposeFullscreen(false);
      setComposeTo('');
      setComposeCc('');
      setComposeBcc('');
      setComposeSubject('');
      setComposeBody('');
      setComposeAttachments([]);
      setComposeResetKey((k) => k + 1);
      setComposeShowCc(false);
      setComposeShowBcc(false);
      void linkEmailToCRM(to, subject)
        .then((res) => {
          if (res.linked.length > 0) {
            const createdNew = res.linked.some(
              (r) => r.created.contact || r.created.company || r.created.opportunity,
            );
            notify.success(
              'Correo registrado en el CRM',
              createdNew
                ? 'Se crearon registros y la actividad de correo'
                : 'Se registró la actividad de correo',
            );
          }
        })
        .catch((e) =>
          notify.error('Error al vincular: ' + (e instanceof Error ? e.message : '')),
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
      notify.error(e instanceof Error ? e.message : 'Error al enviar el correo');
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
      notify.error('Escribe un mensaje antes de enviar');
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
      notify.success('Respuesta enviada', 'Tu mensaje fue enviado');
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
      notify.error(e instanceof Error ? e.message : 'Error al enviar la respuesta');
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
          <button
            type="button"
            onClick={() => setSignatureSettingsOpen(true)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Settings className="size-4 shrink-0" />
            Configuración
          </button>
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
                  onContextMenu={(event) => {
                    if (!googleConnected) return;
                    threadContextMenu.openMenu(event, thread.id);
                  }}
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
                      toggleStar(thread);
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
                  const entityType = selectedThread.relatedEntityType;
                  const entityId = selectedThread.relatedEntityId;
                  const entityPath =
                    entityId && entityType === 'contact'
                      ? contactDetailHref({ id: entityId })
                      : entityId && entityType === 'opportunity'
                        ? opportunityDetailHref({ id: entityId })
                        : entityId && entityType === 'company'
                          ? companyDetailHref({ id: entityId })
                          : null;
                  return (
                    <>
                      <Icon className="size-4 text-[#13944C]" />
                      <span className="text-sm font-medium">Vinculado a:</span>
                      {entityPath ? (
                        <Link
                          to={entityPath}
                          className="text-sm text-[#13944C] hover:underline"
                        >
                          {selectedThread.relatedEntityName}
                        </Link>
                      ) : (
                        <span className="text-sm text-[#13944C]">
                          {selectedThread.relatedEntityName}
                        </span>
                      )}
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
                  <GmailMessageBody body={msg.body} subject={selectedThread.subject} />
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
                    <GmailMessageBody body={msg.body} subject={selectedThread.subject} />
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
                    <GmailMessageBody body={msg.body} subject={selectedThread.subject} />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex h-[90vh] w-full max-w-4xl min-h-0 flex-col">
            <ComposeEmailPanel
              fullscreen
              minimized={composeMinimized}
              onToggleFullscreen={() => setComposeFullscreen(false)}
              onToggleMinimized={() => setComposeMinimized((v) => !v)}
              onClose={closeCompose}
              subject={composeSubject}
              onSubjectChange={setComposeSubject}
              to={composeTo}
              onToChange={setComposeTo}
              cc={composeCc}
              onCcChange={setComposeCc}
              bcc={composeBcc}
              onBccChange={setComposeBcc}
              showCc={composeShowCc}
              showBcc={composeShowBcc}
              onShowCc={() => setComposeShowCc(true)}
              onShowBcc={() => setComposeShowBcc(true)}
              bodyHtml={composeBody}
              onBodyChange={setComposeBody}
              bodyResetKey={composeResetKey}
              onEditorReady={handleComposeEditorReady}
              attachments={composeAttachments}
              onRemoveAttachment={(index) =>
                setComposeAttachments((prev) => prev.filter((_, j) => j !== index))
              }
              onAttachClick={() => composeFileRef.current?.click()}
              onInsertSignature={() => void insertComposeSignature()}
              sending={sendingEmail}
              onSend={() => void handleSendEmail()}
              dragOver={composeDragOver}
              dropOverlay={composeDropOverlay}
              onDragEnter={handleComposeDragEnter}
              onDragLeave={handleComposeDragLeave}
              onDragOver={handleComposeDragOver}
              onDrop={handleComposeDrop}
            />
          </div>
        </div>
      )}

      {composeOpen && !composeFullscreen && (
        <div
          className={cn(
            'fixed z-50 flex flex-col overflow-hidden border border-border bg-card shadow-2xl',
            composeMinimized
              ? 'bottom-4 right-4 w-72 rounded-lg'
              : 'bottom-4 right-4 w-[min(720px,calc(100vw-2rem))] rounded-xl max-lg:left-4 max-lg:right-4 max-lg:w-auto',
          )}
          style={!composeMinimized ? { maxHeight: '85vh', height: '680px' } : undefined}
        >
          <ComposeEmailPanel
            minimized={composeMinimized}
            onToggleMinimized={() => setComposeMinimized((v) => !v)}
            onToggleFullscreen={() => setComposeFullscreen(true)}
            onClose={closeCompose}
            subject={composeSubject}
            onSubjectChange={setComposeSubject}
            to={composeTo}
            onToChange={setComposeTo}
            cc={composeCc}
            onCcChange={setComposeCc}
            bcc={composeBcc}
            onBccChange={setComposeBcc}
            showCc={composeShowCc}
            showBcc={composeShowBcc}
            onShowCc={() => setComposeShowCc(true)}
            onShowBcc={() => setComposeShowBcc(true)}
            bodyHtml={composeBody}
            onBodyChange={setComposeBody}
            bodyResetKey={composeResetKey}
            onEditorReady={handleComposeEditorReady}
            attachments={composeAttachments}
            onRemoveAttachment={(index) =>
              setComposeAttachments((prev) => prev.filter((_, j) => j !== index))
            }
            onAttachClick={() => composeFileRef.current?.click()}
            onInsertSignature={() => void insertComposeSignature()}
            sending={sendingEmail}
            onSend={() => void handleSendEmail()}
            dragOver={composeDragOver}
            dropOverlay={composeDropOverlay}
            onDragEnter={handleComposeDragEnter}
            onDragLeave={handleComposeDragLeave}
            onDragOver={handleComposeDragOver}
            onDrop={handleComposeDrop}
          />
        </div>
      )}

      <InboxThreadContextMenu
        open={threadContextMenu.open}
        x={threadContextMenu.x}
        y={threadContextMenu.y}
        items={contextMenuItems}
        onClose={threadContextMenu.closeMenu}
      />

      <EmailSignatureSettingsDialog
        open={signatureSettingsOpen}
        onOpenChange={setSignatureSettingsOpen}
        onSaved={setUserSignatureHtml}
      />
    </div>
  );
}
