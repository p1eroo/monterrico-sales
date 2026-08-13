import * as React from 'react';
import { ChevronDown, Lock, X } from 'lucide-react';
import { Buildings2SvgIcon } from '@/components/icons/Buildings2SvgIcon';
import { MoneyBagSvgIcon } from '@/components/icons/MoneyBagSvgIcon';
import { UsersGroupTwoRoundedSvgIcon } from '@/components/icons/UsersGroupTwoRoundedSvgIcon';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export type AssociationChipKind = 'empresa' | 'oportunidad' | 'contacto';

type SvgIcon = React.ComponentType<{ className?: string }>;

const KIND_META: Record<
  AssociationChipKind,
  {
    Icon: SvgIcon;
    chip: string;
    iconWrap: string;
    typeLabel: string;
  }
> = {
  empresa: {
    Icon: Buildings2SvgIcon,
    chip: 'border-[#13944C]/30 bg-[#13944C]/10',
    iconWrap: 'bg-[#13944C]/15 text-[#13944C]',
    typeLabel: 'Empresa',
  },
  oportunidad: {
    Icon: MoneyBagSvgIcon,
    chip: 'border-amber-500/30 bg-amber-500/10',
    iconWrap: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    typeLabel: 'Oportunidad',
  },
  contacto: {
    Icon: UsersGroupTwoRoundedSvgIcon,
    chip: 'border-sky-500/30 bg-sky-500/10',
    iconWrap: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
    typeLabel: 'Contacto',
  },
};

export type AssociationChipProps = {
  kind: AssociationChipKind;
  label: string;
  locked?: boolean;
  onRemove?: () => void;
  /** Si false, no muestra la microetiqueta de tipo (útil cuando el campo ya se llama Empresa/Oportunidad). */
  showTypeLabel?: boolean;
  className?: string;
};

export function AssociationChip({
  kind,
  label,
  locked = false,
  onRemove,
  showTypeLabel = true,
  className,
}: AssociationChipProps) {
  const meta = KIND_META[kind];
  const Icon = meta.Icon;

  return (
    <div
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-lg border px-1.5 py-1 text-xs',
        meta.chip,
        className,
      )}
    >
      <span
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-md',
          meta.iconWrap,
        )}
        aria-hidden
      >
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        {showTypeLabel ? (
          <span className="block text-[10px] font-medium leading-none text-muted-foreground">
            {meta.typeLabel}
          </span>
        ) : null}
        <span
          className={cn(
            'block max-w-[220px] truncate font-medium text-foreground',
            showTypeLabel && 'mt-0.5',
          )}
        >
          {label}
        </span>
      </span>
      {locked ? (
        <Lock className="size-3 shrink-0 text-muted-foreground" aria-label="Bloqueado" />
      ) : onRemove ? (
        <button
          type="button"
          className="shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Quitar ${meta.typeLabel.toLowerCase()}`}
        >
          <X className="size-3.5" strokeWidth={2} />
        </button>
      ) : null}
    </div>
  );
}

/** Contenedor del trigger: chips + fila “Buscar…” en un solo control. */
export const associationPickerFieldClass = cn(
  'box-border !flex h-auto min-h-11 w-full !flex-col !items-stretch gap-2 rounded-lg border border-border bg-background px-2.5 py-2 text-left shadow-none',
  'font-normal hover:bg-background dark:border-border/80 dark:bg-input/30 dark:hover:bg-input/30',
  'focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/25',
);

export type AssociationPickerTriggerProps = React.ComponentPropsWithoutRef<typeof Button> & {
  open?: boolean;
  placeholder?: string;
  chips?: React.ReactNode;
};

/**
 * Trigger compuesto para Popover de asociaciones (chips tipados dentro del borde).
 */
export const AssociationPickerTrigger = React.forwardRef<
  HTMLButtonElement,
  AssociationPickerTriggerProps
>(function AssociationPickerTrigger(
  {
    open = false,
    placeholder = 'Buscar asociaciones',
    chips,
    className,
    ...props
  },
  ref,
) {
  const chipNodes = React.Children.toArray(chips).filter(Boolean);
  const hasChips = chipNodes.length > 0;

  return (
    <Button
      ref={ref}
      type="button"
      variant="outline"
      className={cn(associationPickerFieldClass, className)}
      {...props}
    >
      {hasChips ? (
        <div
          className="flex w-full flex-wrap gap-1.5"
          onPointerDown={(e) => {
            /* quitar chip sin togglear el popover */
            if ((e.target as HTMLElement).closest('button')) e.preventDefault();
          }}
        >
          {chipNodes}
        </div>
      ) : null}
      <div className="flex w-full items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{placeholder}</span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            open ? 'rotate-180' : '',
          )}
        />
      </div>
    </Button>
  );
});

/** Caja estática (sin popover) cuando la asociación está bloqueada. */
export function AssociationPickerStatic({
  chips,
  className,
}: {
  chips: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(associationPickerFieldClass, 'cursor-default hover:bg-background', className)}>
      <div className="flex w-full flex-wrap gap-1.5">{chips}</div>
    </div>
  );
}
