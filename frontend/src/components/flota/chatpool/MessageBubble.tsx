import { Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatpoolAvatar } from './ui/Avatar';
import { MessageAttachmentView } from './MessageAttachmentView';
import { formatMessageTime } from './utils';
import type { Message } from './types';

interface MessageBubbleProps {
  message: Message;
  contactName: string;
  agentFallbackName?: string | null;
  isLastInGroup: boolean;
  onImageClick?: (messageId: string) => void;
}

function StatusIcon({ status, onColoredBubble }: { status?: Message['status']; onColoredBubble?: boolean }) {
  const mutedClass = onColoredBubble ? 'text-white/70' : 'text-muted-foreground';
  if (status === 'read') return <CheckCheck className="w-3.5 h-3.5 text-sky-300 dark:text-sky-400" />;
  if (status === 'delivered' || status === 'sent') return <CheckCheck className={cn('w-3.5 h-3.5', mutedClass)} />;
  if (status === 'pending') return <Check className={cn('w-3.5 h-3.5', mutedClass)} />;
  return null;
}

const PLACEHOLDER_BODIES = new Set(['[Imagen]', '[Documento]', '[Video]', '[Audio]', '[Sticker]']);

export function MessageBubble({ message, contactName, agentFallbackName, isLastInGroup, onImageClick }: MessageBubbleProps) {
  if (message.senderType === 'system') {
    return (
      <div className="flex justify-center my-3 px-4">
        <span className="max-w-[min(100%,28rem)] text-center text-xs leading-snug font-medium text-muted-foreground bg-card border border-border px-3.5 py-1.5 rounded-full dark:bg-muted/50">
          {message.content}
        </span>
      </div>
    );
  }

  const isAgent = message.senderType === 'agent' || message.senderType === 'bot';
  const senderName = isAgent ? (message.senderName ?? agentFallbackName ?? 'Agente') : contactName;
  const hasAttachment = message.contentType !== 'text';
  const isImageMessage = message.contentType === 'image';
  const isAudioMessage = message.contentType === 'audio';
  const showText =
    message.content.trim().length > 0 &&
    !isAudioMessage &&
    !(hasAttachment && PLACEHOLDER_BODIES.has(message.content.trim())) &&
    !(hasAttachment && message.fileName && message.content.trim() === message.fileName);

  return (
    <div
      className={cn(
        'group flex px-4 gap-2',
        isAgent ? 'justify-end' : 'justify-start',
        isLastInGroup ? 'mb-3' : 'mb-0.5',
      )}
    >
      {!isAgent && isLastInGroup && <ChatpoolAvatar name={contactName} size="sm" className="self-end" />}
      {!isAgent && !isLastInGroup && <div className="w-7 shrink-0" />}

      <div className={cn('flex flex-col max-w-[85%]', isAgent ? 'items-end' : 'items-start')}>
        {isLastInGroup && (
          <span className="text-[10px] text-muted-foreground mb-0.5 px-1">{senderName}</span>
        )}

        <div
          className={cn(
            'rounded-2xl',
            isImageMessage ? 'p-1.5' : 'px-3 py-2 min-w-[120px]',
            isAgent
              ? 'bg-chat-bubble-outbound text-chat-bubble-outbound-foreground rounded-br-sm shadow-none dark:shadow-sm'
              : 'bg-chat-bubble-inbound text-foreground border border-border rounded-bl-sm shadow-none dark:border-transparent dark:bg-muted dark:shadow-sm',
          )}
        >
          {hasAttachment ? (
            <MessageAttachmentView message={message} isAgent={isAgent} onImageClick={onImageClick} />
          ) : null}
          {showText ? (
            <p
              className={cn(
                'text-[13px] leading-relaxed whitespace-pre-wrap break-words text-message',
                hasAttachment && 'mt-2',
              )}
            >
              {message.content}
            </p>
          ) : null}
          {!isImageMessage ? (
            <div
              className={cn(
                'flex items-center justify-end gap-1 mt-1',
                isAgent ? 'text-chat-bubble-outbound-foreground/70' : 'text-muted-foreground',
              )}
            >
              <span className="text-[10px]">{formatMessageTime(message.createdAt)}</span>
              {isAgent && <StatusIcon status={message.status} onColoredBubble />}
            </div>
          ) : null}
        </div>

        {isImageMessage && isLastInGroup ? (
          <div className={cn('flex items-center gap-1 mt-1 px-1', isAgent ? 'justify-end' : 'justify-start')}>
            <span className="text-[10px] text-muted-foreground">{formatMessageTime(message.createdAt)}</span>
            {isAgent && <StatusIcon status={message.status} onColoredBubble />}
          </div>
        ) : null}
      </div>

      {isAgent && isLastInGroup && <ChatpoolAvatar name={senderName} size="sm" className="self-end" variant="agent" />}
      {isAgent && !isLastInGroup && <div className="w-7 shrink-0" />}
    </div>
  );
}
