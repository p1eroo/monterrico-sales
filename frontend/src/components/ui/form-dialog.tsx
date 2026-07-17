import * as React from 'react';
import { ChevronLeft, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/** Altura unificada (44px) para inputs, selects y pickers del modal. */
const formDialogControlSize =
  'box-border h-11 min-h-11 max-h-11 w-full px-3 text-sm';

/** Inputs planos estilo modal de integración (sin sombra pesada). */
export const formDialogInputClass = cn(
  formDialogControlSize,
  '!h-11 !min-h-11 !max-h-11 !py-0 rounded-lg border border-slate-300/80 bg-background shadow-none',
  'focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/25',
  '[&::-webkit-calendar-picker-indicator]:m-0 [&::-webkit-calendar-picker-indicator]:size-4',
);

export const formDialogSelectTriggerClass = cn(
  formDialogControlSize,
  '!flex items-center justify-between rounded-lg border border-slate-300/80 bg-background !py-0 shadow-none',
  'data-[size=default]:!h-11 data-[size=sm]:!h-11',
  'focus-visible:ring-1 focus-visible:ring-ring/25',
);

export const formDialogPickerTriggerClass = cn(
  formDialogControlSize,
  '!flex items-center justify-between rounded-lg border border-slate-300/80 bg-background font-normal text-muted-foreground shadow-none hover:bg-background',
);

export const formDialogTextareaClass = cn(
  'min-h-[6.5rem] w-full resize-y rounded-lg border border-slate-300/80 bg-background px-3 py-2.5 text-sm shadow-none',
  'focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/25',
);

/** Botón selector de entidad (contacto, empresa, etc.). */
export const formDialogLinkPickerClass = cn(
  formDialogControlSize,
  '!flex items-center justify-start gap-2 rounded-lg border border-slate-300/80 bg-background px-3 font-normal shadow-none hover:bg-background',
);

export const formDialogBtnOutlineClass =
  'h-10 rounded-lg border-border/80 bg-background px-5 shadow-none hover:bg-muted/30';

export const formDialogBtnPrimaryClass =
  'h-10 rounded-lg bg-[#13944C] px-6 shadow-none hover:bg-[#0f7a3d]';

/** Lista con scroll siempre visible (p. ej. plantillas WhatsApp). */
export const formDialogScrollListClass =
  'max-h-56 overflow-y-scroll overscroll-contain pr-1 [scrollbar-gutter:stable] scrollbar-thin';

/** Popover anclado dentro de FormDialogShell (por encima del modal z-[201]). */
export const formDialogPopoverContentClass =
  'z-[210] w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-xl border border-border/80 bg-popover p-0 shadow-lg';

/** Diálogo secundario abierto encima de FormDialogShell (p. ej. picker de empresa). */
export const formDialogNestedOverlayClass = 'z-[205]';
export const formDialogNestedContentClass = 'z-[210]';

export function FormDialogFieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="text-xs text-destructive">{children}</p>;
}

const formDialogControlSlotClass =
  'h-11 [&_[data-slot=input]]:h-full [&_[data-slot=input]]:min-h-0 [&_[data-slot=input]]:max-h-full [&_[data-slot=select-trigger]]:h-full [&_[data-slot=select-trigger]]:min-h-0 [&_[data-slot=select-trigger]]:max-h-full [&_button]:h-full [&_button]:min-h-0 [&_button]:max-h-full';

export function FormDialogField({
  label,
  required,
  children,
  className,
  hint,
  compactControl = true,
}: {
  label: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
  hint?: React.ReactNode;
  /** false para bloques con varios controles (p. ej. asociaciones con badges). */
  compactControl?: boolean;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label className="text-sm font-semibold text-foreground/90">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {compactControl ? (
        <div className={formDialogControlSlotClass}>{children}</div>
      ) : (
        children
      )}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function FormDialogGrid({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('grid grid-cols-1 items-start gap-x-6 gap-y-6 sm:grid-cols-2', className)}>
      {children}
    </div>
  );
}

export function FormDialogActions({
  onCancel,
  submitLabel = 'Guardar',
  onSubmit,
  submitting,
  submitDisabled,
  cancelLabel = 'Cancelar',
  className,
}: {
  onCancel: () => void;
  submitLabel?: string;
  onSubmit: () => void;
  submitting?: boolean;
  submitDisabled?: boolean;
  cancelLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-row justify-end gap-3', className)}>
      <Button
        type="button"
        variant="outline"
        className={cn('min-w-[7.5rem]', formDialogBtnOutlineClass)}
        onClick={onCancel}
        disabled={submitting}
      >
        {cancelLabel}
      </Button>
      <Button
        type="button"
        className={cn('min-w-[7.5rem]', formDialogBtnPrimaryClass)}
        onClick={onSubmit}
        disabled={submitting || submitDisabled}
      >
        {submitLabel}
      </Button>
    </div>
  );
}

export function FormDialogWizardFooter({
  showBack,
  onBack,
  onCancel,
  onPrimary,
  primaryLabel,
  submitting,
  primaryDisabled,
  primaryIcon,
}: {
  showBack?: boolean;
  onBack?: () => void;
  onCancel: () => void;
  onPrimary: () => void;
  primaryLabel: React.ReactNode;
  submitting?: boolean;
  primaryDisabled?: boolean;
  primaryIcon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-row items-center justify-between gap-3">
      <div>
        {showBack ? (
          <Button
            type="button"
            variant="outline"
            className={formDialogBtnOutlineClass}
            disabled={submitting}
            onClick={onBack}
          >
            <ChevronLeft className="size-4" />
            Anterior
          </Button>
        ) : null}
      </div>
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          className={formDialogBtnOutlineClass}
          disabled={submitting}
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          className={formDialogBtnPrimaryClass}
          disabled={submitting || primaryDisabled}
          onClick={onPrimary}
        >
          {primaryIcon}
          {primaryLabel}
        </Button>
      </div>
    </div>
  );
}

export function FormDialogShell({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  maxWidthClassName = 'sm:max-w-2xl',
  footerClassName,
  bodyClassName,
  contentClassName,
  appendContent,
  overlayClassName = 'z-[200]',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer: React.ReactNode;
  maxWidthClassName?: string;
  footerClassName?: string;
  bodyClassName?: string;
  contentClassName?: string;
  appendContent?: React.ReactNode;
  overlayClassName?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName={overlayClassName}
        className={cn(
          '!fixed z-[201] flex max-h-[90vh] w-full min-w-[min(100%,20rem)] flex-col gap-0 overflow-hidden rounded-3xl border border-border/60 bg-background p-0 shadow-xl',
          'opacity-100 data-[state=open]:opacity-100',
          maxWidthClassName,
          contentClassName,
        )}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-8 pt-8 scrollbar-thin [scrollbar-gutter:stable]">
          <div className="flex items-start justify-between gap-4">
            <DialogHeader className="gap-1 p-0 text-left">
              <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                {title}
              </DialogTitle>
              {description ? (
                <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                  {description}
                </DialogDescription>
              ) : null}
            </DialogHeader>
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 shrink-0 rounded-full bg-muted/70 text-muted-foreground shadow-none hover:bg-muted"
              >
                <X className="size-4" />
                <span className="sr-only">Cerrar</span>
              </Button>
            </DialogClose>
          </div>
          <div className={cn('mt-6 pb-2', bodyClassName)}>{children}</div>
        </div>
        {footer ? (
          <div className={cn('shrink-0 border-t border-border/60 bg-background px-8 py-5', footerClassName)}>
            {footer}
          </div>
        ) : null}
        {appendContent}
      </DialogContent>
    </Dialog>
  );
}
