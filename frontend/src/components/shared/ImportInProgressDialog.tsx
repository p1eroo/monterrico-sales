'use client';

import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export type ImportInProgressDialogProps = {
  open: boolean;
  title: string;
  description: string;
  /** Texto opcional (p. ej. filas válidas en vista previa). */
  rowHint?: string;
};

/**
 * Modal bloqueante mientras el servidor procesa un CSV de importación (un solo POST).
 * Sin barra de progreso real: indicación indeterminada + mensaje claro.
 */
export function ImportInProgressDialog({
  open,
  title,
  description,
  rowHint,
}: ImportInProgressDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) return;
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="flex flex-col gap-4"
        >
          <span className="sr-only">
            {title}. {description}
            {rowHint ? ` ${rowHint}` : ''}
          </span>
          <DialogHeader className="space-y-4 text-left">
            <div className="flex gap-4">
              <Loader2
                className="size-10 shrink-0 animate-spin text-primary"
                aria-hidden
              />
              <div className="min-w-0 space-y-2">
                <DialogTitle className="text-left">{title}</DialogTitle>
                <DialogDescription asChild>
                  <div className="space-y-2 text-left">
                    <p>{description}</p>
                    {rowHint ? (
                      <p className="text-muted-foreground">{rowHint}</p>
                    ) : null}
                  </div>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div
            className="relative h-2 w-full overflow-hidden rounded-full bg-muted"
            aria-hidden
          >
            <div className="h-full w-full origin-left animate-pulse bg-primary/35" />
          </div>
          <p className="text-xs text-muted-foreground">
            Espera a que termine; no cierres ni recargues la pestaña.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
