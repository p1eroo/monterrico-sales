import { useNavigate } from 'react-router-dom';
import { User, Building2, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from '@/types';
import { eventTypeConfig } from './eventTypeConfig';
import { getCalendarEventNavPaths } from '@/lib/calendarEventLinks';

interface CalendarEventCardProps {
  event: CalendarEvent;
  compact?: boolean;
  onClick?: (e?: React.MouseEvent) => void;
  className?: string;
}

export function CalendarEventCard({ event, compact, onClick, className }: CalendarEventCardProps) {
  const navigate = useNavigate();
  const config = eventTypeConfig[event.type];
  const Icon = config.icon;
  const links = getCalendarEventNavPaths(event);

  const go = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(path);
  };

  const hasContactRow = Boolean(links.contactPath && links.contactName);
  const hasCompanyRow = Boolean(links.companyPath && links.companyName);
  const hasOpportunityRow = Boolean(links.opportunityPath && links.opportunityTitle);
  const hasLinkedRows = hasContactRow || hasCompanyRow || hasOpportunityRow;

  if (compact) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => { e.stopPropagation(); onClick?.(e); }}
        onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
        className={cn(
          'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-all hover:bg-muted/60 dark:hover:shadow-sm',
          config.bgColor,
          config.color,
          className,
        )}
      >
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate font-medium">{event.title}</span>
        <span className="shrink-0 text-[10px] opacity-80">{event.startTime}</span>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      className={cn(
        'group cursor-pointer rounded-lg border border-border bg-card p-3 shadow-none transition-all hover:border-[#13944C]/30 dark:shadow-sm dark:hover:shadow-md',
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <div className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', config.bgColor, config.color)}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{event.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {event.startTime} - {event.endTime}
          </p>
          {hasLinkedRows && (
            <div className="mt-1.5 flex min-w-0 flex-col gap-1">
              {hasContactRow ? (
                <button
                  type="button"
                  onClick={(e) => go(links.contactPath!, e)}
                  className="flex min-w-0 w-full items-start gap-1.5 text-left text-xs font-medium text-[#13944C] hover:underline"
                >
                  <User className="mt-0.5 size-3 shrink-0 opacity-90" aria-hidden />
                  <span className="min-w-0 break-words">{links.contactName}</span>
                </button>
              ) : null}
              {hasCompanyRow ? (
                <button
                  type="button"
                  onClick={(e) => go(links.companyPath!, e)}
                  className="flex min-w-0 w-full items-start gap-1.5 text-left text-xs font-medium text-[#13944C] hover:underline"
                >
                  <Building2 className="mt-0.5 size-3 shrink-0 opacity-90" aria-hidden />
                  <span className="min-w-0 break-words">{links.companyName}</span>
                </button>
              ) : null}
              {hasOpportunityRow ? (
                <button
                  type="button"
                  onClick={(e) => go(links.opportunityPath!, e)}
                  className="flex min-w-0 w-full items-start gap-1.5 text-left text-xs font-medium text-[#13944C] hover:underline"
                >
                  <Briefcase className="mt-0.5 size-3 shrink-0 opacity-90" aria-hidden />
                  <span className="min-w-0 break-words">{links.opportunityTitle}</span>
                </button>
              ) : null}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-1">{event.assignedToName}</p>
        </div>
      </div>
    </div>
  );
}
