import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Archive, Mail, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type InboxContextMenuItem = {
  id: string;
  label: string;
  icon: typeof Archive;
  onSelect: () => void;
  destructive?: boolean;
};

type InboxThreadContextMenuProps = {
  open: boolean;
  x: number;
  y: number;
  items: InboxContextMenuItem[];
  onClose: () => void;
};

const MENU_WIDTH = 220;
const MENU_ITEM_HEIGHT = 36;
const MENU_PADDING = 8;

function clampPosition(x: number, y: number, itemCount: number) {
  const menuHeight = itemCount * MENU_ITEM_HEIGHT + MENU_PADDING * 2;
  const padding = 8;
  return {
    x: Math.max(padding, Math.min(x, window.innerWidth - MENU_WIDTH - padding)),
    y: Math.max(padding, Math.min(y, window.innerHeight - menuHeight - padding)),
  };
}

export function InboxThreadContextMenu({
  open,
  x,
  y,
  items,
  onClose,
}: InboxThreadContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });

  useLayoutEffect(() => {
    if (!open) return;
    setPosition(clampPosition(x, y, items.length));
  }, [open, x, y, items.length]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      onClose();
    };

    const handleScroll = () => onClose();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', onClose);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, [open, onClose]);

  if (!open || items.length === 0) return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-[100] min-w-[220px] rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
      style={{ left: position.x, top: position.y }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            className={cn(
              'flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-2 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground',
              item.destructive && 'text-destructive hover:bg-destructive/10 hover:text-destructive',
            )}
            onClick={() => {
              item.onSelect();
              onClose();
            }}
          >
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            {item.label}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}

export function useInboxThreadContextMenu() {
  const [state, setState] = useState<{
    open: boolean;
    x: number;
    y: number;
    threadId: string | null;
  }>({ open: false, x: 0, y: 0, threadId: null });

  const openMenu = useCallback((event: React.MouseEvent, threadId: string) => {
    event.preventDefault();
    event.stopPropagation();
    setState({ open: true, x: event.clientX, y: event.clientY, threadId });
  }, []);

  const closeMenu = useCallback(() => {
    setState((prev) => ({ ...prev, open: false, threadId: null }));
  }, []);

  return { ...state, openMenu, closeMenu };
}
