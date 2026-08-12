import {
  MessageCircle,
  Mail,
  MessageCircleMore,
  Camera,
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatpoolAvatar } from './ui/Avatar';
import { ChatpoolBadge } from './ui/Badge';
import { ChatpoolLabelChip } from './ui/LabelChip';
import { formatTime } from './utils';
import type { Conversation } from './types';

const channelIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  whatsapp: MessageCircle,
  email: Mail,
  facebook: MessageCircleMore,
  instagram: Camera,
  website: Globe,
};

const channelColors: Record<string, string> = {
  whatsapp: 'text-emerald-500',
  email: 'text-blue-500',
  facebook: 'text-blue-600',
  instagram: 'text-pink-500',
  website: 'text-violet-500',
};

interface ConversationCardProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}

export function ConversationCard({ conversation, isActive, onClick }: ConversationCardProps) {
  const { contact, lastMessage, unreadCount, channelType, assignee, isTyping, labels, prospectoActivo } =
    conversation;
  const visibleLabels = prospectoActivo !== false ? labels : [];
  const ChannelIcon = channelIcons[channelType] || Globe;
  const channelColor = channelColors[channelType] || 'text-muted-foreground';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3 border-b border-border transition-colors duration-150',
        isActive
          ? 'bg-primary/10 border-l-[3px] border-l-primary'
          : unreadCount > 0
            ? 'border-l-[3px] border-l-amber-500 bg-amber-500/10 hover:bg-amber-500/15'
            : 'border-l-[3px] border-l-transparent hover:bg-muted/50',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <ChatpoolAvatar name={contact.name} size="md" />
          <div
            className={cn(
              'absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center bg-card',
              channelColor,
            )}
          >
            <ChannelIcon className="w-2.5 h-2.5" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-sm font-medium text-foreground truncate">{contact.name}</span>
            <span className="text-[11px] text-muted-foreground shrink-0 ml-2">
              {lastMessage
                ? formatTime(lastMessage.createdAt)
                : formatTime(conversation.lastMessageAt ?? conversation.updatedAt)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isTyping ? (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 italic flex items-center gap-1">
                <span>escribiendo</span>
                <span className="flex gap-0.5">
                  <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce" />
                  <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.15s]" />
                  <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.3s]" />
                </span>
              </p>
            ) : (
              <p
                className={cn(
                  'text-xs truncate flex-1',
                  unreadCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground',
                )}
              >
                {lastMessage
                  ? lastMessage.contentType === 'file'
                    ? `📎 ${lastMessage.fileName ?? 'Archivo'}`
                    : lastMessage.content
                  : 'Sin mensajes'}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1.5">
            {visibleLabels.length > 0 && (
              <div className="flex items-center gap-1 flex-1 min-w-0">
                {visibleLabels.slice(0, 2).map((label) => (
                  <ChatpoolLabelChip key={label.id} label={label} />
                ))}
              </div>
            )}
            <div className="flex items-center gap-1.5 ml-auto shrink-0">
              {prospectoActivo !== false ? (
                assignee ? (
                  <ChatpoolAvatar name={assignee.name} size="xs" />
                ) : (
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    sin asignar
                  </span>
                )
              ) : null}
              <ChatpoolBadge count={unreadCount} />
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
