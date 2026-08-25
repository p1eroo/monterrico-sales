import { cn } from '@/lib/utils';
import type { QuickReply } from './quickReplies';

interface QuickRepliesSlashMenuProps {
  items: QuickReply[];
  activeIndex: number;
  onHover: (index: number) => void;
  onSelect: (item: QuickReply) => void;
}

export function QuickRepliesSlashMenu({
  items,
  activeIndex,
  onHover,
  onSelect,
}: QuickRepliesSlashMenuProps) {
  if (items.length === 0) {
    return (
      <div className="absolute bottom-full left-0 right-0 z-40 mb-2 rounded-xl border border-border bg-card px-4 py-3 shadow-xl">
        <p className="text-sm text-muted-foreground">No hay respuestas que coincidan</p>
      </div>
    );
  }

  return (
    <div className="absolute bottom-full left-0 right-0 z-40 mb-2 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
      <div className="border-b border-border px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Respuestas rápidas
        </p>
      </div>
      <div className="max-h-56 overflow-y-auto py-1">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onMouseEnter={() => onHover(index)}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(item);
            }}
            className={cn(
              'mx-1 w-[calc(100%-0.5rem)] rounded-lg px-3 py-2 text-left transition-colors',
              index === activeIndex
                ? 'bg-primary/10 ring-1 ring-inset ring-primary/50'
                : 'hover:bg-muted/70',
            )}
          >
            <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{item.text}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
