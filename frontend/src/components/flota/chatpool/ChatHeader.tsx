import { useState } from 'react';
import { MessageCircle, MoreVertical, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChatpoolAvatar } from './ui/Avatar';
import type { Conversation } from './types';

interface ChatHeaderProps {
  conversation: Conversation;
}

export function ChatHeader({ conversation }: ChatHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const { contact } = conversation;

  return (
    <div className="h-14 bg-card border-b border-border flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <div className="relative">
          <ChatpoolAvatar name={contact.name} size="md" />
          {contact.lastSeen && (
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-card" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">{contact.name}</h2>
            <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full flex items-center gap-1">
              <MessageCircle className="w-3 h-3" />
              WhatsApp
            </span>
          </div>
          {contact.lastSeen && (
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400">En línea</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-8 w-8', menuOpen && 'bg-muted')}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MoreVertical className="w-4 h-4" />
          </Button>
          {menuOpen && (
            <div className="absolute top-full right-0 mt-1 w-48 bg-popover border border-border rounded-lg shadow-lg z-50 py-1">
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-muted-foreground hover:bg-muted"
              >
                <Globe className="w-4 h-4 shrink-0" />
                Más opciones próximamente
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
