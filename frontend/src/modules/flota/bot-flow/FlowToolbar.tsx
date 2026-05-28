import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  BOT_NODE_TYPES,
  NODE_LABELS,
  NODE_DESCRIPTIONS,
  NODE_COLORS,
  type BotNodeType,
} from './types';

const SVG_ICONS: Record<string, React.ReactNode> = {
  start: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  message: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  question: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>,
  condition: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>,
  ai_extract: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a8 8 0 0 0-8 8c0 2.5 1.5 4.8 3 6.5V20a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3.5c1.5-1.7 3-4 3-6.5a8 8 0 0 0-8-8z"/><circle cx="12" cy="11" r="3"/></svg>,
  crm_action: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  human_handoff: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/></svg>,
  end: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>,
};

interface FlowToolbarProps {
  onAddNode: (type: BotNodeType) => void;
}

export default function FlowToolbar({ onAddNode }: FlowToolbarProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? BOT_NODE_TYPES.filter((t) =>
        NODE_LABELS[t].toLowerCase().includes(search.toLowerCase()) ||
        NODE_DESCRIPTIONS[t].toLowerCase().includes(search.toLowerCase()),
      )
    : BOT_NODE_TYPES;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          className="h-9 w-9 rounded-full bg-primary p-0 text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90"
        >
          <Plus className="size-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={10}
        className="w-[280px] p-1.5"
      >
        <div className="mb-1 rounded-md bg-muted/50 px-2 py-1.5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nodo..."
            className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
            autoFocus
          />
        </div>
        <div className="max-h-[320px] space-y-0.5 overflow-y-auto">
          {filtered.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                onAddNode(type);
                setOpen(false);
                setSearch('');
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-accent"
            >
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${NODE_COLORS[type]}18`, color: NODE_COLORS[type] }}
              >
                {SVG_ICONS[type]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground">{NODE_LABELS[type]}</p>
                <p className="truncate text-[10px] text-muted-foreground">{NODE_DESCRIPTIONS[type]}</p>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="py-6 text-center text-[11px] text-muted-foreground">Sin resultados</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
