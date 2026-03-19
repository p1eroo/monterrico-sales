import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  Eye,
  Calendar,
  ExternalLink,
  Trash2,
  MoreHorizontal,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { NotificationItem } from '@/types';
import { useNotificationStore } from '@/store/notificationStore';

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: string; bg: string; text: string }
> = {
  lead: { label: 'Lead', icon: '👤', bg: 'bg-blue-100', text: 'text-blue-700' },
  sistema: {
    label: 'Sistema',
    icon: '⚙',
    bg: 'bg-purple-100',
    text: 'text-purple-700',
  },
  exito: {
    label: 'Éxito',
    icon: '✓',
    bg: 'bg-emerald-100',
    text: 'text-emerald-700',
  },
  alerta: {
    label: 'Alerta',
    icon: '⚠',
    bg: 'bg-amber-100',
    text: 'text-amber-700',
  },
  error: {
    label: 'Error',
    icon: '✕',
    bg: 'bg-red-100',
    text: 'text-red-700',
  },
  info: { label: 'Info', icon: 'ℹ', bg: 'bg-blue-100', text: 'text-blue-700' },
  warning: {
    label: 'Alerta',
    icon: '⚠',
    bg: 'bg-amber-100',
    text: 'text-amber-700',
  },
  success: {
    label: 'Éxito',
    icon: '✓',
    bg: 'bg-emerald-100',
    text: 'text-emerald-700',
  },
};

const PRIORITY_CONFIG: Record<string, { label: string; dot: string }> = {
  alta: { label: 'Alta', dot: 'bg-red-500' },
  media: { label: 'Media', dot: 'bg-amber-500' },
  baja: { label: 'Baja', dot: 'bg-gray-400' },
};

interface NotificationCardProps {
  notification: NotificationItem;
  variant?: 'compact' | 'full';
  showActions?: boolean;
}

export function NotificationCard({
  notification,
  variant = 'full',
  showActions = true,
}: NotificationCardProps) {
  const navigate = useNavigate();
  const { markAsRead, remove } = useNotificationStore();
  const [isHovered, setIsHovered] = useState(false);

  const typeKey = notification.type as string;
  const typeConfig = TYPE_CONFIG[typeKey] ?? TYPE_CONFIG.info;
  const priorityConfig = notification.priority
    ? PRIORITY_CONFIG[notification.priority]
    : null;

  const handleMarkRead = () => markAsRead(notification.id);
  const handleViewContact = () => {
    if (notification.contactId) {
      markAsRead(notification.id);
      navigate(`/contactos/${notification.contactId}`);
    }
  };
  const handleViewOpportunity = () => {
    if (notification.opportunityId) {
      markAsRead(notification.id);
      navigate(`/opportunities/${notification.opportunityId}`);
    }
  };
  const handleReschedule = () => {
    if (notification.activityId) {
      markAsRead(notification.id);
      navigate('/calendario');
    }
  };
  const handleDelete = () => remove(notification.id);

  const actionsVisible = showActions && (variant === 'full' ? isHovered : true);

  return (
    <div
      className={cn(
        'group relative rounded-lg border bg-card p-3 transition-all duration-200',
        !notification.read && 'border-l-4 border-l-[#13944C] bg-[#13944C]/[0.02]',
        notification.important && 'ring-1 ring-amber-200',
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex gap-3">
        <div
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg text-sm',
            typeConfig.bg,
            typeConfig.text,
          )}
        >
          {typeConfig.icon}
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'text-sm leading-tight',
              !notification.read && 'font-semibold text-foreground',
            )}
          >
            {notification.title}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {notification.description}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              {notification.time}
            </span>
            <span
              className={cn(
                'rounded px-1.5 py-0.5 text-[10px] font-medium',
                typeConfig.bg,
                typeConfig.text,
              )}
            >
              {typeConfig.label}
            </span>
            {priorityConfig && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span
                  className={cn('size-1.5 rounded-full', priorityConfig.dot)}
                />
                {priorityConfig.label}
              </span>
            )}
          </div>
        </div>

        {showActions && (
          <div
            className={cn(
              'flex shrink-0 items-start gap-0.5 transition-opacity',
              variant === 'compact' && 'opacity-0 group-hover:opacity-100',
              variant === 'full' && !actionsVisible && 'opacity-0',
            )}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="size-7 text-muted-foreground hover:text-foreground"
                >
                  <MoreHorizontal className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {!notification.read && (
                  <DropdownMenuItem onClick={handleMarkRead}>
                    <Check className="size-3.5" />
                    Marcar como leída
                  </DropdownMenuItem>
                )}
                {notification.contactId && (
                  <DropdownMenuItem onClick={handleViewContact}>
                    <Eye className="size-3.5" />
                    Ver contacto
                  </DropdownMenuItem>
                )}
                {notification.opportunityId && (
                  <DropdownMenuItem onClick={handleViewOpportunity}>
                    <ExternalLink className="size-3.5" />
                    Ver oportunidad
                  </DropdownMenuItem>
                )}
                {notification.activityId && (
                  <DropdownMenuItem onClick={handleReschedule}>
                    <Calendar className="size-3.5" />
                    Reprogramar
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  variant="destructive"
                  onClick={handleDelete}
                  className="text-destructive"
                >
                  <Trash2 className="size-3.5" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </div>
  );
}
