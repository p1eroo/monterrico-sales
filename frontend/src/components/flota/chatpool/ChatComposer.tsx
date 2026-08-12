import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  FileText,
  ImageIcon,
  Loader2,
  Mic,
  Music2,
  Paperclip,
  Plus,
  Send,
  Smile,
  X,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { EmojiGrid } from '@/components/EmojiGrid';
import { toast } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { useChatpoolStore } from './store';
import { FLOTA_QUICK_REPLIES } from './quickReplies';
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
  const [quickRepliesOpen, setQuickRepliesOpen] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<ComposerPendingAttachment[]>([]);
  const [caption, setCaption] = useState('');
  const [sendingAttachment, setSendingAttachment] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
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

  function applyQuickReply(text: string) {
    setContent(text);
    setQuickRepliesOpen(false);
    setToolbarOpen(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (pendingAttachments.length > 0) {
        clearPendingAttachments();
        return;
      }
      if (quickRepliesOpen) {
        setQuickRepliesOpen(false);
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
      return;
    }
    if (e.key === '/' && content === '') {
      setQuickRepliesOpen(true);
    }
  }

  const showSlashHint = content.startsWith('/');
  const filteredReplies = showSlashHint
    ? FLOTA_QUICK_REPLIES.filter(
        (r) =>
          r.label.toLowerCase().includes(content.slice(1).toLowerCase()) ||
          r.text.toLowerCase().includes(content.slice(1).toLowerCase()),
      )
    : FLOTA_QUICK_REPLIES;

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

      <Popover open={quickRepliesOpen} onOpenChange={setQuickRepliesOpen}>
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
                  <ImageIcon className="mr-2 h-4 w-4" /> Foto
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
                  <Music2 className="mr-2 h-4 w-4" /> Audio
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                  <FileText className="mr-2 h-4 w-4" /> Documento
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ToolbarAction
              label="Respuestas"
              color="text-violet-500"
              onClick={() => setQuickRepliesOpen(true)}
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
            <PopoverAnchor asChild>
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
            </PopoverAnchor>

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
                  <ImageIcon className="mr-2 h-4 w-4" /> Foto
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
                  <Music2 className="mr-2 h-4 w-4" /> Audio
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                  <FileText className="mr-2 h-4 w-4" /> Documento
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

            <Textarea
              value={hasPending ? caption : content}
              onChange={(e) =>
                hasPending ? setCaption(e.target.value) : setContent(e.target.value)
              }
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

        <PopoverContent side="top" align="start" className="w-80 p-2">
          <p className="mb-2 px-2 text-xs font-medium text-muted-foreground">Respuestas rápidas</p>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {(showSlashHint ? filteredReplies : FLOTA_QUICK_REPLIES).map((reply) => (
              <button
                key={reply.id}
                type="button"
                className="w-full rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted"
                onClick={() => applyQuickReply(reply.text)}
              >
                <p className="text-sm font-medium">{reply.label}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{reply.text}</p>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
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
