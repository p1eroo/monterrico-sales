import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import type { Opportunity, OpportunityStatus } from '@/types';
import { isLikelyOpportunityCuid } from '@/lib/opportunityApi';

const statusLabels: Record<OpportunityStatus, string> = {
  abierta: 'Abierta',
  ganada: 'Ganada',
  perdida: 'Perdida',
  suspendida: 'Suspendida',
};

export type OpportunityEditSavePayload = {
  title: string;
  amount: number;
  expectedCloseDate: string | null;
  status: OpportunityStatus;
};

export type OpportunityEditDialogProps = {
  opportunity: Opportunity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: OpportunityEditSavePayload) => Promise<void>;
};

export function OpportunityEditDialog({
  opportunity,
  open,
  onOpenChange,
  onSave,
}: OpportunityEditDialogProps) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState(0);
  const [expectedCloseDate, setExpectedCloseDate] = useState('');
  const [status, setStatus] = useState<OpportunityStatus>('abierta');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!opportunity || !open) return;
    setTitle(opportunity.title);
    setAmount(opportunity.amount);
    setExpectedCloseDate(
      opportunity.expectedCloseDate
        ? opportunity.expectedCloseDate.slice(0, 10)
        : '',
    );
    setStatus(opportunity.status);
  }, [opportunity, open]);

  function handleSave() {
    if (!opportunity?.id || !title.trim()) return;
    if (!isLikelyOpportunityCuid(opportunity.id)) {
      toast.error('Solo se pueden editar oportunidades guardadas en el servidor');
      return;
    }
    setSaving(true);
    onOpenChange(false);
    void onSave({
      title: title.trim(),
      amount,
      expectedCloseDate: expectedCloseDate || null,
      status,
    }).catch((e) => {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    }).finally(() => setSaving(false));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar oportunidad</DialogTitle>
          <DialogDescription>Modifica los datos de la oportunidad.</DialogDescription>
        </DialogHeader>
        {saving ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Guardando…</p>
        ) : (
        <>
        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label>Nombre *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Monto (S/)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha estimada de cierre</Label>
              <Input
                type="date"
                value={expectedCloseDate}
                onChange={(e) => setExpectedCloseDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Estado</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as OpportunityStatus)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(statusLabels) as OpportunityStatus[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {statusLabels[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSave()} disabled={!title.trim() || saving}>
            Guardar cambios
          </Button>
        </DialogFooter>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}
