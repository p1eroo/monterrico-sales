import type { ComponentType } from 'react';
import { Buildings2SvgIcon } from '@/components/icons/Buildings2SvgIcon';
import { MoneyBagSvgIcon } from '@/components/icons/MoneyBagSvgIcon';
import { UsersGroupTwoRoundedSvgIcon } from '@/components/icons/UsersGroupTwoRoundedSvgIcon';
import { cn } from '@/lib/utils';

type SvgIcon = ComponentType<{ className?: string }>;

const variantConfig = {
  company: {
    Icon: Buildings2SvgIcon,
    boxClass: 'bg-primary/10',
    iconClass: 'text-primary',
  },
  opportunity: {
    Icon: MoneyBagSvgIcon,
    boxClass: 'bg-primary/10',
    iconClass: 'text-primary',
  },
  contact: {
    Icon: UsersGroupTwoRoundedSvgIcon,
    boxClass: 'bg-primary/10',
    iconClass: 'text-primary',
  },
} as const;

export type LinkedEntityItemHeaderVariant = keyof typeof variantConfig;

export interface LinkedEntityItemHeaderProps {
  variant: LinkedEntityItemHeaderVariant;
  /** Línea pequeña encima del título (p. ej. “Principal”). */
  overline?: string | null;
  title: string;
  titleHint?: string;
  subtitle?: string | null;
  subtitleHint?: string;
  trailing?: React.ReactNode;
  /** Sustituye el icono por defecto del variant (casos poco frecuentes) */
  icon?: SvgIcon;
}

/**
 * Cabecera compacta para ítems en tarjetas de entidades vinculadas:
 * icono en contenedor redondeado + nombre + subtítulo opcional.
 */
export function LinkedEntityItemHeader({
  variant,
  overline,
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
          {overline ? (
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              {overline}
            </p>
          ) : null}
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
