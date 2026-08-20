import { Button } from '@/components/ui/button';
import {
  FormDialogShell,
  formDialogBtnOutlineClass,
  formDialogBtnPrimaryClass,
  formDialogNestedContentClass,
  formDialogNestedOverlayClass,
} from '@/components/ui/form-dialog';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  onConfirm: () => void;
  variant?: 'default' | 'destructive';
  confirmLabel?: string;
  /** Encima de FormDialogShell (z-201), p. ej. confirmación dentro de un modal de detalle. */
  nested?: boolean;
  contentClassName?: string;
  overlayClassName?: string;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title = 'Confirmar',
  description,
  onConfirm,
  variant = 'default',
  confirmLabel,
  nested = false,
  contentClassName,
  overlayClassName,
}: ConfirmDialogProps) {
  function handleConfirm() {
    onConfirm();
    onOpenChange(false);
  }

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      maxWidthClassName="sm:max-w-md"
      overlayClassName={
        overlayClassName ?? (nested ? formDialogNestedOverlayClass : undefined)
      }
      contentClassName={cn(
        nested && `!fixed ${formDialogNestedContentClass}`,
        contentClassName,
      )}
      bodyClassName="mt-0 pb-0"
      footer={
        <div className="flex flex-row justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            className={cn('min-w-[7.5rem]', formDialogBtnOutlineClass)}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            className={cn(
              'min-w-[7.5rem] px-6',
              variant === 'destructive'
                ? 'h-10 rounded-lg bg-destructive px-6 text-destructive-foreground shadow-none hover:bg-destructive/90'
                : formDialogBtnPrimaryClass,
            )}
          >
            {confirmLabel ?? 'Confirmar'}
          </Button>
        </div>
      }
    >
      {null}
    </FormDialogShell>
  );
}
