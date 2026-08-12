import { useEffect, useMemo, useRef } from 'react';
import { Loader2, MessageSquare } from 'lucide-react';
import { useChatpoolStore } from './store';
import { ChatHeader } from './ChatHeader';
import { MessageBubble } from './MessageBubble';
import { findConversationInList, formatDate, getMessagesForConversation } from './utils';
import type { Message } from './types';

export function MessageList() {
  const conversations = useChatpoolStore((s) => s.conversations);
  const activeConversationId = useChatpoolStore((s) => s.activeConversationId);
  const messages = useChatpoolStore((s) => s.messages);
  const messagesLoading = useChatpoolStore((s) => s.messagesLoading);
  const connectionState = useChatpoolStore((s) => s.connectionState);
  const openLightbox = useChatpoolStore((s) => s.openLightbox);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevConversationRef = useRef<string | null>(null);
  const prevLoadingRef = useRef(false);

  const scrollToBottom = (behavior: ScrollBehavior) => {
    const run = () => {
      const container = scrollContainerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
        return;
      }
      bottomRef.current?.scrollIntoView({ behavior, block: 'end' });
    };

    if (behavior === 'instant') {
      requestAnimationFrame(run);
      return;
    }
    run();
  };

  const activeConversation = useMemo(
    () => findConversationInList(conversations, activeConversationId),
    [conversations, activeConversationId],
  );

  const activeMessages = useMemo(
    () => getMessagesForConversation(conversations, messages, activeConversationId),
    [conversations, messages, activeConversationId],
  );

  const isLoadingMessages = activeConversationId ? messagesLoading[activeConversationId] : false;
  const hasCachedBucket =
    activeConversationId != null && messages[activeConversationId] !== undefined;
  const showLoadingSpinner = isLoadingMessages && !hasCachedBucket;

  useEffect(() => {
    const conversationChanged = prevConversationRef.current !== activeConversationId;
    const finishedLoading = prevLoadingRef.current && !isLoadingMessages;
    prevLoadingRef.current = isLoadingMessages;

    if (showLoadingSpinner) {
      if (conversationChanged) prevConversationRef.current = activeConversationId;
      return;
    }

    if (conversationChanged || finishedLoading) {
      prevConversationRef.current = activeConversationId;
      scrollToBottom('instant');
      return;
    }

    if (activeMessages.length > 0) scrollToBottom('smooth');
  }, [activeConversationId, activeMessages.length, isLoadingMessages, showLoadingSpinner]);

  if (!activeConversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <p className="text-muted-foreground text-sm">
            {connectionState === 'ready'
              ? 'Selecciona una conversación para empezar'
              : 'Conecta Evolution GO para ver conversaciones'}
          </p>
        </div>
      </div>
    );
  }

  const messageGroups = activeMessages.reduce<{ date: string; messages: Message[] }[]>((groups, msg) => {
    const dateKey = formatDate(msg.createdAt);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.date === dateKey) {
      lastGroup.messages.push(msg);
    } else {
      groups.push({ date: dateKey, messages: [msg] });
    }
    return groups;
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ChatHeader conversation={activeConversation} />
      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto py-3 bg-muted/20 scrollbar-thin">
        {showLoadingSpinner ? (
          <div className="flex h-full min-h-[200px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messageGroups.length === 0 ? (
          <div className="flex h-full min-h-[200px] items-center justify-center px-6 text-center">
            <p className="text-sm text-muted-foreground">Sin mensajes en esta conversación</p>
          </div>
        ) : (
          messageGroups.map((group) => (
            <div key={group.date}>
              <div className="flex justify-center my-3">
                <span className="text-[11px] text-muted-foreground bg-muted px-3 py-1 rounded-full">
                  {group.date}
                </span>
              </div>
              {group.messages.map((msg, i) => {
                const next = group.messages[i + 1];
                const isLastInGroup = !next || next.senderType !== msg.senderType || next.senderType === 'system';
                return (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    contactName={activeConversation.contact.name}
                    isLastInGroup={isLastInGroup}
                    onImageClick={openLightbox}
                  />
                );
              })}
            </div>
          ))
        )}
        {activeConversation.isTyping && (
          <div className="px-4 mb-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.15s]" />
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.3s]" />
              </span>
              {activeConversation.contact.name} está escribiendo...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
