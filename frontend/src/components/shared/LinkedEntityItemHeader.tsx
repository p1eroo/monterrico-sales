import type { LucideIcon } from 'lucide-react';
import { Building2, Briefcase, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const variantConfig = {
  company: {
    Icon: Building2,
    boxClass: 'bg-primary/10',
    iconClass: 'text-primary',
  },
  opportunity: {
    Icon: Briefcase,
    boxClass: 'bg-primary/10',
    iconClass: 'text-primary',
  },
  contact: {
    Icon: User,
    boxClass: 'bg-primary/10',
    iconClass: 'text-primary',
  },
} as const;

export type LinkedEntityItemHeaderVariant = keyof typeof variantConfig;

export interface LinkedEntityItemHeaderProps {
  variant: LinkedEntityItemHeaderVariant;
  title: string;
  titleHint?: string;
  subtitle?: string | null;
  subtitleHint?: string;
  trailing?: React.ReactNode;
  /** Sustituye el icono por defecto del variant (casos poco frecuentes) */
  icon?: LucideIcon;
}

/**
 * Cabecera compacta para ítems en tarjetas de entidades vinculadas:
 * icono en contenedor redondeado + nombre + subtítulo opcional.
 */
export function LinkedEntityItemHeader({
  variant,
  title,
  titleHint,
  subtitle,
  subtitleHint,
  trailing,
  icon: IconOverride,
}: LinkedEntityItemHeaderProps) {
  const { Icon: DefaultIcon, boxClass, iconClass } = variantConfig[variant];
  const Icon = IconOverride ?? DefaultIcon;

  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex min-w-0 flex-1 gap-2.5">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
            boxClass,
          )}
        >
          <Icon className={cn('size-4', iconClass)} />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="min-w-0 truncate text-sm font-medium leading-snug tracking-normal text-text-primary normal-case"
            title={titleHint ?? title}
          >
            {title}
          </p>
          {subtitle ? (
            <p
              className="mt-0.5 truncate text-xs leading-snug text-text-tertiary"
              title={subtitleHint ?? subtitle}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {trailing}
    </div>
  );
}
