import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  Loader2,
  Mic,
  Paperclip,
  Plus,
  Send,
  Smile,
  X,
  Zap,
} from 'lucide-react';
import { FileNewSvgIcon } from '@/components/icons/FileNewSvgIcon';
import { GallerySvgIcon } from '@/components/icons/GallerySvgIcon';
import { MusicNoteSvgIcon } from '@/components/icons/MusicNoteSvgIcon';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { EmojiGrid } from '@/components/EmojiGrid';
import { toast } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { useChatpoolStore } from './store';
import { type QuickReply } from './quickReplies';
import {
  filterQuickRepliesBySlashQuery,
  getSlashQuery,
} from './quickReplySlash';
import { QuickRepliesModal } from './QuickRepliesModal';
import { QuickRepliesSlashMenu } from './QuickRepliesSlashMenu';
import { useFlotaQuickReplies } from './useFlotaQuickReplies';
import {
  attachmentTypeOf,
  getClipboardAttachmentFile,
  mergePendingAttachments,
} from './attachmentUtils';
import {
  ComposerPendingAttachments,
  type ComposerPendingAttachment,
} from './ComposerPendingAttachments';
import { VoiceRecorderBar, type VoiceRecordingResult } from './VoiceRecorderBar';

function makePending(file: File): ComposerPendingAttachment {
  return {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    url: URL.createObjectURL(file),
  };
}

export function ChatComposer() {
  const activeConversationId = useChatpoolStore((s) => s.activeConversationId);
  const connectionState = useChatpoolStore((s) => s.connectionState);
  const sendMessage = useChatpoolStore((s) => s.sendMessage);
  const sendMediaMessage = useChatpoolStore((s) => s.sendMediaMessage);
  const attachFileRequest = useChatpoolStore((s) => s.attachFileRequest);
  const clearAttachFileRequest = useChatpoolStore((s) => s.clearAttachFileRequest);

  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [quickRepliesModalOpen, setQuickRepliesModalOpen] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<ComposerPendingAttachment[]>([]);
  const [caption, setCaption] = useState('');
  const [sendingAttachment, setSendingAttachment] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [slashCursor, setSlashCursor] = useState(0);
  const [slashMenuDismissed, setSlashMenuDismissed] = useState(false);
  const [slashActiveIndex, setSlashActiveIndex] = useState(0);

  const { replies, createReply, updateReply, deleteReply } = useFlotaQuickReplies();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingRef = useRef(pendingAttachments);
  pendingRef.current = pendingAttachments;

  useEffect(() => {
    return () => {
      pendingRef.current.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, []);

  useEffect(() => {
    setPendingAttachments((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.url));
      return [];
    });
    setCaption('');
    setIsRecording(false);
    setContent('');
    setSlashMenuDismissed(false);
    setQuickRepliesModalOpen(false);
  }, [activeConversationId]);

  function stageFiles(incoming: File[]) {
    const currentFiles = pendingRef.current.map((p) => p.file);
    const result = mergePendingAttachments(currentFiles, incoming);
    if (!result.ok) {
      toast.error(result.reason);
      return false;
    }

    setPendingAttachments((prev) => {
      const next = result.files.map((file) => {
        const existing = prev.find((p) => p.file === file);
        return existing ?? makePending(file);
      });
      prev.forEach((item) => {
        if (!next.some((n) => n.id === item.id)) {
          URL.revokeObjectURL(item.url);
        }
      });
      return next;
    });

    if (result.truncated) {
      toast.error('Algunos archivos no se adjuntaron (límite alcanzado)');
    }
    setToolbarOpen(false);
    return true;
  }

  useEffect(() => {
    if (!attachFileRequest) return;
    stageFiles([attachFileRequest]);
    clearAttachFileRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachFileRequest, clearAttachFileRequest]);

  const slashQuery = useMemo(
    () => (slashMenuDismissed ? null : getSlashQuery(content, slashCursor)),
    [content, slashCursor, slashMenuDismissed],
  );

  const slashMatches = useMemo(
    () =>
      slashQuery ? filterQuickRepliesBySlashQuery(replies, slashQuery.query) : [],
    [slashQuery, replies],
  );

  const slashMenuOpen = Boolean(slashQuery);

  useEffect(() => {
    setSlashActiveIndex(0);
  }, [slashQuery?.query, slashQuery?.start]);

  const applyQuickReply = useCallback(
    (reply: QuickReply, fromSlash: boolean) => {
      if (fromSlash) {
        const query = getSlashQuery(
          content,
          textareaRef.current?.selectionStart ?? slashCursor,
        );
        if (!query) {
          setContent(reply.text);
        } else {
          const next = content.slice(0, query.start) + reply.text + content.slice(query.end);
          setContent(next);
          requestAnimationFrame(() => {
            const el = textareaRef.current;
            if (!el) return;
            el.focus();
            const pos = query.start + reply.text.length;
            el.setSelectionRange(pos, pos);
            setSlashCursor(pos);
          });
        }
        setSlashMenuDismissed(true);
        setSlashActiveIndex(0);
      } else {
        setContent(reply.text);
        setQuickRepliesModalOpen(false);
        setToolbarOpen(false);
        requestAnimationFrame(() => textareaRef.current?.focus());
      }
    },
    [content, slashCursor],
  );

  if (!activeConversationId || connectionState !== 'ready') return null;

  const conversationId = activeConversationId;

  function clearPendingAttachments() {
    setPendingAttachments((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.url));
      return [];
    });
    setCaption('');
  }

  function removePending(id: string) {
    setPendingAttachments((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((p) => p.id !== id);
    });
  }

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    stageFiles(files);
  }

  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const file = getClipboardAttachmentFile(e.clipboardData);
    if (!file) return;
    e.preventDefault();
    stageFiles([file]);
  }

  async function handleSendText() {
    if (!content.trim() || sending) return;
    const text = content;
    setContent('');
    setSlashMenuDismissed(false);
    setSending(true);
    try {
      await sendMessage(conversationId, text);
    } finally {
      setSending(false);
    }
  }

  async function handleSendAttachments() {
    if (pendingAttachments.length === 0 || sendingAttachment) return;
    setSendingAttachment(true);
    try {
      for (let i = 0; i < pendingAttachments.length; i++) {
        const item = pendingAttachments[i];
        await sendMediaMessage(conversationId, {
          type: attachmentTypeOf(item.file),
          file: item.file,
          caption: i === 0 ? caption : undefined,
        });
      }
      clearPendingAttachments();
    } catch {
      /* toast handled in store */
    } finally {
      setSendingAttachment(false);
    }
  }

  async function handleVoiceSend(result: VoiceRecordingResult) {
    setIsRecording(false);
    setSending(true);
    try {
      const file = new File([result.blob], 'audio.webm', {
        type: result.blob.type || 'audio/webm',
      });
      await sendMediaMessage(conversationId, { type: 'audio', file });
    } catch {
      /* toast handled in store */
    } finally {
      setSending(false);
    }
  }

  function handleContentChange(value: string, cursor: number) {
    setContent(value);
    setSlashCursor(cursor);
    setSlashMenuDismissed(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (slashMenuOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashActiveIndex((prev) =>
          slashMatches.length ? (prev + 1) % slashMatches.length : 0,
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashActiveIndex((prev) =>
          slashMatches.length
            ? (prev - 1 + slashMatches.length) % slashMatches.length
            : 0,
        );
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setSlashMenuDismissed(true);
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const selected = slashMatches[slashActiveIndex];
        if (selected) applyQuickReply(selected, true);
        return;
      }
      if (e.key === 'Tab' && slashMatches[slashActiveIndex]) {
        e.preventDefault();
        applyQuickReply(slashMatches[slashActiveIndex], true);
        return;
      }
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      if (pendingAttachments.length > 0) {
        clearPendingAttachments();
        return;
      }
      if (quickRepliesModalOpen) {
        setQuickRepliesModalOpen(false);
        return;
      }
      useChatpoolStore.getState().closeActiveChat();
      (e.target as HTMLTextAreaElement).blur();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (pendingAttachments.length > 0) {
        void handleSendAttachments();
        return;
      }
      void handleSendText();
    }
  }

  if (isRecording) {
    return (
      <div className="shrink-0 border-t border-border bg-card">
        <VoiceRecorderBar
          onSend={(result) => void handleVoiceSend(result)}
          onCancel={() => setIsRecording(false)}
          onError={(msg) => toast.error(msg)}
        />
      </div>
    );
  }

  const hasPending = pendingAttachments.length > 0;
  const safeSlashIndex = Math.min(slashActiveIndex, Math.max(slashMatches.length - 1, 0));

  return (
    <div className="shrink-0 border-t border-border bg-card">
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />

      {toolbarOpen ? (
        <div className="grid grid-cols-3 gap-2 border-b border-border px-4 py-3">
          <ToolbarAction
            label="Audio"
            color="text-rose-500"
            onClick={() => {
              setIsRecording(true);
              setToolbarOpen(false);
            }}
            icon={<Mic className="h-5 w-5" />}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex flex-col items-center gap-1.5 rounded-lg py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/50"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500/15 text-sky-500">
                  <Paperclip className="h-5 w-5" />
                </span>
                Archivos
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top">
              <DropdownMenuItem onClick={() => imageInputRef.current?.click()}>
                <GallerySvgIcon /> Foto
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'audio/*';
                    fileInputRef.current.click();
                    fileInputRef.current.accept = '';
                  }
                }}
              >
                <MusicNoteSvgIcon /> Audio
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <FileNewSvgIcon /> Documento
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ToolbarAction
            label="Respuestas"
            color="text-violet-500"
            onClick={() => {
              setQuickRepliesModalOpen(true);
              setToolbarOpen(false);
            }}
            icon={<Zap className="h-5 w-5" />}
          />
        </div>
      ) : null}

      <div className="px-4 py-3">
        {hasPending ? (
          <ComposerPendingAttachments
            attachments={pendingAttachments}
            onRemove={removePending}
            onAddImages={() => imageInputRef.current?.click()}
          />
        ) : null}

        <div className="flex items-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn('mb-0.5 h-8 w-8 shrink-0', toolbarOpen && 'border-primary text-primary')}
            onClick={() => setToolbarOpen((v) => !v)}
            title={toolbarOpen ? 'Ocultar acciones' : 'Más acciones'}
          >
            {toolbarOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="mb-0.5 h-8 w-8 shrink-0 text-muted-foreground"
                title="Adjuntar"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top">
              <DropdownMenuItem onClick={() => imageInputRef.current?.click()}>
                <GallerySvgIcon /> Foto
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'audio/*';
                    fileInputRef.current.click();
                    fileInputRef.current.accept = '';
                  }
                }}
              >
                <MusicNoteSvgIcon /> Audio
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <FileNewSvgIcon /> Documento
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="mb-0.5 h-8 w-8 shrink-0 text-muted-foreground"
                title="Emoji"
              >
                <Smile className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-auto border-0 p-0">
              <EmojiGrid
                onSelect={(emoji) =>
                  setContent((prev) => prev + emoji.replace(/\uFE0F/g, ''))
                }
              />
            </PopoverContent>
          </Popover>

          <div className="relative min-w-0 flex-1">
            {!hasPending && slashMenuOpen ? (
              <QuickRepliesSlashMenu
                items={slashMatches}
                activeIndex={safeSlashIndex}
                onHover={setSlashActiveIndex}
                onSelect={(item) => applyQuickReply(item, true)}
              />
            ) : null}

            <Textarea
              ref={textareaRef}
              value={hasPending ? caption : content}
              onChange={(e) => {
                if (hasPending) {
                  setCaption(e.target.value);
                  return;
                }
                handleContentChange(
                  e.target.value,
                  e.target.selectionStart ?? e.target.value.length,
                );
              }}
              onClick={(e) => setSlashCursor(e.currentTarget.selectionStart ?? 0)}
              onKeyUp={(e) => setSlashCursor(e.currentTarget.selectionStart ?? 0)}
              onSelect={(e) => setSlashCursor(e.currentTarget.selectionStart ?? 0)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={
                hasPending
                  ? 'Añade un mensaje...'
                  : 'Escribe un mensaje... o / para respuestas'
              }
              rows={1}
              className="min-h-[42px] max-h-32 resize-none border-transparent bg-muted/50 text-message focus-visible:border-primary"
            />
          </div>

          <Button
            type="button"
            size="icon"
            className="mb-0.5 h-10 w-10 shrink-0 rounded-full"
            onClick={() =>
              hasPending ? void handleSendAttachments() : void handleSendText()
            }
            disabled={
              sending ||
              sendingAttachment ||
              (hasPending ? false : !content.trim())
            }
            title="Enviar"
          >
            {sending || sendingAttachment ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <QuickRepliesModal
        open={quickRepliesModalOpen}
        onClose={() => setQuickRepliesModalOpen(false)}
        onSelect={(reply) => applyQuickReply(reply, false)}
        replies={replies}
        createReply={createReply}
        updateReply={updateReply}
        deleteReply={deleteReply}
      />
    </div>
  );
}

function ToolbarAction({
  label,
  color,
  icon,
  onClick,
}: {
  label: string;
  color: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-lg py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/50"
    >
      <span className={cn('flex h-10 w-10 items-center justify-center rounded-full bg-muted', color)}>
        {icon}
      </span>
      {label}
    </button>
  );
}
