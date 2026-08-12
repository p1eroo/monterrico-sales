import { useState } from 'react';
import { LlamadaSvgIcon } from '@/components/icons/LlamadaSvgIcon';
import { Button, type ButtonProps } from '@/components/ui/button';
import {
  FormDialogActions,
  FormDialogField,
  FormDialogGrid,
  FormDialogShell,
  formDialogInputClass,
  formDialogNestedContentClass,
  formDialogNestedOverlayClass,
  formDialogTextareaClass,
} from '@/components/ui/form-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { flotaLlamadaCreate } from '@/lib/flotaProspectosApi';
import { notifyFlotaProspectosRefresh } from '@/lib/flotaProspectosRealtime';
import { toast } from '@/lib/notify';
import { cn } from '@/lib/utils';

function nowDateParts() {
  const now = new Date();
  return {
    fecha: now.toISOString().split('T')[0],
    hora: now.toTimeString().split(' ')[0].substring(0, 5),
  };
}

interface RegistrarLlamadaButtonProps extends Omit<ButtonProps, 'onClick'> {
  prospectoId: string;
  prospectoNombre: string;
  label?: string;
  shortLabel?: string;
  submitLabel?: string;
  iconOnly?: boolean;
  appearance?: 'toolbar' | 'panel' | 'plain';
  nested?: boolean;
  onSaved?: () => void;
}

export function RegistrarLlamadaButton({
  prospectoId,
  prospectoNombre,
  label = 'Registrar llamada',
  shortLabel = 'Llamada',
  submitLabel = 'Guardar información de la llamada',
  iconOnly = false,
  appearance = 'toolbar',
  nested = false,
  onSaved,
  className,
  variant = 'ghost',
  size = 'sm',
  ...buttonProps
}: RegistrarLlamadaButtonProps) {
  const [open, setOpen] = useState(false);
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);

  function handleOpen() {
    const { fecha: f, hora: h } = nowDateParts();
    setFecha(f);
    setHora(h);
    setNotas('');
    setOpen(true);
  }

  async function handleSave() {
    if (!notas.trim()) return;
    setSaving(true);
    try {
      const fechaHora = new Date(`${fecha}T${hora}:00`);
      await flotaLlamadaCreate(prospectoId, {
        notas: notas.trim(),
        createdAt: fechaHora.toISOString(),
      });
      toast.success('Llamada registrada');
      notifyFlotaProspectosRefresh();
      onSaved?.();
      setOpen(false);
    } catch {
      toast.error('No se pudo registrar la llamada');
    } finally {
      setSaving(false);
    }
  }

  const triggerClass =
    appearance === 'toolbar' || appearance === 'panel'
      ? cn(
          'h-9 shrink-0 gap-2 rounded-lg px-3 shadow-none',
          'border border-primary/25 bg-primary/5 text-primary',
          'text-xs font-medium',
          'hover:bg-primary/10 hover:text-primary',
          'focus-visible:ring-2 focus-visible:ring-primary/20',
          appearance === 'panel' && 'w-full sm:w-auto',
          iconOnly && 'px-2.5',
        )
      : cn('shrink-0 gap-1.5', iconOnly && 'px-2');

  return (
    <>
      <Button
        type="button"
        variant={appearance === 'toolbar' || appearance === 'panel' ? 'ghost' : variant}
        size={size}
        className={cn(triggerClass, className)}
        title={iconOnly ? label : undefined}
        onClick={handleOpen}
        {...buttonProps}
      >
        <LlamadaSvgIcon className="size-4 shrink-0" />
        {!iconOnly ? (
          <>
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{shortLabel}</span>
          </>
        ) : (
          <span className="sr-only">{label}</span>
        )}
      </Button>

      <FormDialogShell
        open={open}
        onOpenChange={setOpen}
        title="Registrar llamada"
        description={`Prospecto: ${prospectoNombre}`}
        maxWidthClassName="sm:max-w-md"
        bodyClassName="pb-2"
        overlayClassName={nested ? formDialogNestedOverlayClass : undefined}
        contentClassName={nested ? formDialogNestedContentClass : undefined}
        footer={
          <FormDialogActions
            onCancel={() => setOpen(false)}
            onSubmit={() => void handleSave()}
            submitLabel={submitLabel}
            submitting={saving}
            submitDisabled={!notas.trim()}
          />
        }
      >
        <FormDialogGrid className="gap-y-4">
          <FormDialogField label="Fecha">
            <Input
              type="date"
              className={formDialogInputClass}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </FormDialogField>
          <FormDialogField label="Hora">
            <Input
              type="time"
              className={formDialogInputClass}
              value={hora}
              onChange={(e) => setHora(e.target.value)}
            />
          </FormDialogField>
        </FormDialogGrid>
        <FormDialogField label="Notas / comentarios" compactControl={false} className="mt-4">
          <Textarea
            className={formDialogTextareaClass}
            placeholder="Comentarios sobre la llamada..."
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
          />
        </FormDialogField>
      </FormDialogShell>
    </>
  );
}
