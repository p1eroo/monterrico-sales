import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from '@/types';
import { eventTypeConfig } from './eventTypeConfig';
import {
  companyDetailHref,
  contactDetailHref,
  opportunityDetailHref,
} from '@/lib/detailRoutes';

interface CalendarEventCardProps {
  event: CalendarEvent;
  compact?: boolean;
  onClick?: (e?: React.MouseEvent) => void;
  className?: string;
}

function getEntityLink(event: CalendarEvent): string | null {
  if (!event.relatedEntityType || !event.relatedEntityId) return null;
  switch (event.relatedEntityType) {
    case 'contact':
      return contactDetailHref({ id: event.relatedEntityId });
    case 'company':
      if (event.relatedEntityId) {
        return companyDetailHref({ id: event.relatedEntityId });
      }
      if (event.relatedEntityName) {
        return `/empresas/${encodeURIComponent(event.relatedEntityName)}`;
      }
      return null;
    case 'opportunity':
      return opportunityDetailHref({ id: event.relatedEntityId });
    default:
      return null;
  }
}

export function CalendarEventCard({ event, compact, onClick, className }: CalendarEventCardProps) {
  const navigate = useNavigate();
  const config = eventTypeConfig[event.type];
  const Icon = config.icon;
  const link = getEntityLink(event);

  const handleEntityClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (link) navigate(link);
  };

  if (compact) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => { e.stopPropagation(); onClick?.(e); }}
        onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
        className={cn(
          'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-all hover:shadow-sm cursor-pointer',
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
        'group rounded-lg border bg-card p-3 shadow-sm transition-all hover:shadow-md hover:border-[#13944C]/30 cursor-pointer',
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
          {event.relatedEntityName && (
            <button
              type="button"
              onClick={handleEntityClick}
              className="mt-1.5 text-xs text-[#13944C] hover:underline font-medium truncate block text-left"
            >
              {event.relatedEntityType === 'contact' && '👤 '}
              {event.relatedEntityType === 'company' && '🏢 '}
              {event.relatedEntityType === 'opportunity' && '💼 '}
              {event.relatedEntityName}
            </button>
          )}
          <p className="text-xs text-muted-foreground mt-1">{event.assignedToName}</p>
        </div>
      </div>
    </div>
  );
}
