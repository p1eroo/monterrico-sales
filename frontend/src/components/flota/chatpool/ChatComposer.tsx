import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent, type ReactNode } from 'react';
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
  StopCircle,
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
import { formatFileSize } from './utils';

type PendingAttachment = {
  type: 'image' | 'audio' | 'document';
  file: File;
  previewUrl?: string;
  caption: string;
};

export function ChatComposer() {
  const activeConversationId = useChatpoolStore((s) => s.activeConversationId);
  const connectionState = useChatpoolStore((s) => s.connectionState);
  const sendMessage = useChatpoolStore((s) => s.sendMessage);
  const sendMediaMessage = useChatpoolStore((s) => s.sendMediaMessage);

  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [quickRepliesOpen, setQuickRepliesOpen] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const [sendingAttachment, setSendingAttachment] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (!activeConversationId || connectionState !== 'ready') return null;

  function clearPendingAttachment() {
    setPendingAttachment((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  }

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    queueAttachment(file);
  }

  function queueAttachment(file: File) {
    const isImage = file.type.startsWith('image/');
    const isAudio = file.type.startsWith('audio/');
    clearPendingAttachment();
    setPendingAttachment({
      type: isImage ? 'image' : isAudio ? 'audio' : 'document',
      file,
      previewUrl: isImage ? URL.createObjectURL(file) : undefined,
      caption: '',
    });
    setToolbarOpen(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) queueAttachment(file);
  }

  async function handleSendText() {
    if (!content.trim() || sending) return;
    const text = content;
    setContent('');
    setSending(true);
    try {
      await sendMessage(activeConversationId, text);
    } finally {
      setSending(false);
    }
  }

  async function handleSendAttachment() {
    if (!pendingAttachment || sendingAttachment) return;
    setSendingAttachment(true);
    try {
      await sendMediaMessage(activeConversationId, {
        type: pendingAttachment.type,
        file: pendingAttachment.file,
        caption: pendingAttachment.caption,
      });
      clearPendingAttachment();
    } catch {
      /* toast handled in store */
    } finally {
      setSendingAttachment(false);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];
      recordingChunksRef.current = chunks;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mimeType });
        void sendAudioBlob(blob);
      };
      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
      setToolbarOpen(false);
    } catch {
      toast.error('No se pudo acceder al micrófono.');
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder?.state === 'recording') recorder.stop();
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
    setIsRecording(false);
    setRecordingDuration(0);
  }

  async function sendAudioBlob(blob: Blob) {
    if (!activeConversationId) return;
    const file = new File([blob], 'audio.webm', { type: blob.type });
    setSending(true);
    try {
      await sendMediaMessage(activeConversationId, { type: 'audio', file });
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
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

  if (pendingAttachment) {
    return (
      <div className="shrink-0 border-t border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <span className="text-sm font-medium">
            {pendingAttachment.type === 'image'
              ? 'Enviar foto'
              : pendingAttachment.type === 'audio'
                ? 'Enviar audio'
                : 'Enviar documento'}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={clearPendingAttachment}
            disabled={sendingAttachment}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-col items-center gap-3 px-4 py-4">
          {pendingAttachment.type === 'image' && pendingAttachment.previewUrl ? (
            <img
              src={pendingAttachment.previewUrl}
              alt="Vista previa"
              className="max-h-64 rounded-lg object-contain"
            />
          ) : null}
          {pendingAttachment.type === 'audio' ? (
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3">
              <Music2 className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{pendingAttachment.file.name}</span>
            </div>
          ) : null}
          {pendingAttachment.type === 'document' ? (
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium max-w-[300px]">{pendingAttachment.file.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(pendingAttachment.file.size)}</p>
              </div>
            </div>
          ) : null}
          <div className="flex w-full items-end gap-2">
            <Textarea
              value={pendingAttachment.caption}
              onChange={(e) =>
                setPendingAttachment((prev) => (prev ? { ...prev, caption: e.target.value } : null))
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSendAttachment();
                }
              }}
              placeholder="Añade un mensaje..."
              className="min-h-[44px] max-h-32 flex-1 resize-none bg-muted/50 border-transparent"
              rows={1}
              disabled={sendingAttachment}
            />
            <Button
              type="button"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-full"
              onClick={() => void handleSendAttachment()}
              disabled={sendingAttachment}
            >
              {sendingAttachment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="shrink-0 border-t border-border bg-card"
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={handleDrop}
    >
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />

      <Popover open={quickRepliesOpen} onOpenChange={setQuickRepliesOpen}>
      {toolbarOpen ? (
        <div className="grid grid-cols-3 gap-2 border-b border-border px-4 py-3">
          <ToolbarAction
            label="Audio"
            color="text-rose-500"
            onClick={() => void startRecording()}
            icon={<Mic className="h-5 w-5" />}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex flex-col items-center gap-1.5 rounded-lg py-1 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
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
        {isRecording ? (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
            <span className="text-sm font-medium text-destructive">Grabando...</span>
            <span className="text-sm tabular-nums text-muted-foreground">
              {Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, '0')}
            </span>
            <div className="flex-1" />
            <Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={stopRecording}>
              <StopCircle className="h-5 w-5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <PopoverAnchor asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={cn('h-8 w-8 shrink-0 mb-0.5', toolbarOpen && 'border-primary text-primary')}
                onClick={() => setToolbarOpen((v) => !v)}
                title={toolbarOpen ? 'Ocultar acciones' : 'Más acciones'}
              >
                {toolbarOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              </Button>
            </PopoverAnchor>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 mb-0.5 text-muted-foreground" title="Adjuntar">
                  <Paperclip className="w-4 h-4" />
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
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 mb-0.5 text-muted-foreground" title="Emoji">
                  <Smile className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-auto border-0 p-0">
                <EmojiGrid onSelect={(emoji) => setContent((prev) => prev + emoji.replace(/\uFE0F/g, ''))} />
              </PopoverContent>
            </Popover>

            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe un mensaje... o / para respuestas"
              rows={1}
              className="min-h-[42px] max-h-32 resize-none bg-muted/50 border-transparent focus-visible:border-primary text-message"
            />

            <Button
              type="button"
              size="icon"
              className="h-10 w-10 shrink-0 mb-0.5 rounded-full"
              onClick={() => void handleSendText()}
              disabled={!content.trim() || sending}
              title="Enviar"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        )}
      </div>

      <PopoverContent side="top" align="start" className="w-80 p-2">
        <p className="mb-2 px-2 text-xs font-medium text-muted-foreground">Respuestas rápidas</p>
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {(showSlashHint ? filteredReplies : FLOTA_QUICK_REPLIES).map((reply) => (
            <button
              key={reply.id}
              type="button"
              className="w-full rounded-lg px-2 py-2 text-left hover:bg-muted transition-colors"
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
      className="flex flex-col items-center gap-1.5 rounded-lg py-1 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
    >
      <span className={cn('flex h-10 w-10 items-center justify-center rounded-full bg-muted', color)}>{icon}</span>
      {label}
    </button>
  );
}
