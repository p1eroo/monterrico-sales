import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';

const HOVER_OPEN_DELAY_MS = 120;
const CLOSE_DELAY_MS = 200;

/** Panel flyout del sidebar colapsado: mismo fondo que el sidebar. */
const sidebarFlyoutSurfaceClass = cn(
  'z-[200] w-auto min-w-[11rem] overflow-hidden rounded-2xl p-1.5',
  'border border-sidebar-border bg-sidebar text-sidebar-foreground',
  'shadow-[0_12px_40px_rgba(0,0,0,0.22)]',
);

type CollapsedSidebarFlyoutProps = {
  itemKey: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  isActive?: boolean;
  children: ReactNode;
};

export function CollapsedSidebarFlyout({
  itemKey,
  label,
  icon: Icon,
  isActive = false,
  children,
}: CollapsedSidebarFlyoutProps) {
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const clearOpenTimer = useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }, []);

  const clearAllTimers = useCallback(() => {
    clearCloseTimer();
    clearOpenTimer();
  }, [clearCloseTimer, clearOpenTimer]);

  const openNow = useCallback(() => {
    clearAllTimers();
    setOpen(true);
  }, [clearAllTimers]);

  const scheduleOpen = useCallback(() => {
    clearOpenTimer();
    clearCloseTimer();
    openTimerRef.current = setTimeout(openNow, HOVER_OPEN_DELAY_MS);
  }, [clearCloseTimer, clearOpenTimer, openNow]);

  const scheduleClose = useCallback(() => {
    clearOpenTimer();
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  }, [clearCloseTimer, clearOpenTimer]);

  useEffect(() => () => clearAllTimers(), [clearAllTimers]);

  return (
    <SidebarMenuItem className="relative">
      <Popover
        open={open}
        modal={false}
        onOpenChange={(next) => {
          clearAllTimers();
          setOpen(next);
        }}
      >
        <PopoverTrigger asChild>
          <SidebarMenuButton
            isActive={isActive}
            data-state={open ? 'open' : undefined}
            aria-haspopup="menu"
            aria-expanded={open}
            data-sidebar-flyout-trigger={itemKey}
            onPointerEnter={scheduleOpen}
            onPointerLeave={scheduleClose}
            onClick={(event) => {
              clearAllTimers();
              event.preventDefault();
              setOpen(true);
            }}
            className={cn(
              'w-full outline-none focus-visible:outline-none focus-visible:ring-0',
              isActive && 'text-sidebar-accent-foreground',
            )}
          >
            <Icon />
            <span>{label}</span>
          </SidebarMenuButton>
        </PopoverTrigger>

        <PopoverContent
          side="right"
          align="start"
          sideOffset={2}
          collisionPadding={12}
          data-sidebar-flyout={itemKey}
          className={sidebarFlyoutSurfaceClass}
          onPointerEnter={openNow}
          onPointerLeave={scheduleClose}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="flex flex-col gap-0.5">{children}</div>
        </PopoverContent>
      </Popover>
    </SidebarMenuItem>
  );
}
