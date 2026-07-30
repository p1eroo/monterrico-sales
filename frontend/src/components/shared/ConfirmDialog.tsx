import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  formDialogNestedContentClass,
  formDialogNestedOverlayClass,
} from '@/components/ui/form-dialog';
import { Button } from '@/components/ui/button';
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName={
          overlayClassName ?? (nested ? formDialogNestedOverlayClass : undefined)
        }
        className={cn(nested && `!fixed ${formDialogNestedContentClass}`, contentClassName)}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            className={cn(variant === 'destructive' && 'bg-destructive text-destructive-foreground hover:bg-destructive/90')}
          >
            {confirmLabel ?? "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
