import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  fetchOperadores,
  flotaProspectoDetail,
  flotaProspectoSetOperador,
  flotaProspectoUpdate,
  getOperatorDisplayName,
  MODALIDAD_OPTIONS,
  type OperadorUser,
} from '@/lib/flotaProspectosApi';
import { toast } from '@/lib/notify';
import { useAppStore } from '@/store';

export type ProspectoEditSaved = {
  nombreCompleto: string;
  celular: string | null;
  operador: string | null;
};

interface ProspectoEditDialogProps {
  prospectoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (data: ProspectoEditSaved) => void;
}

export function ProspectoEditDialog({
  prospectoId,
  open,
  onOpenChange,
  onSaved,
}: ProspectoEditDialogProps) {
  const currentUser = useAppStore((s) => s.currentUser);
  const [operadores, setOperadores] = useState<OperadorUser[]>([]);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [initialOperador, setInitialOperador] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const originalObsRef = useRef('');

  const isOperadorRole = currentUser.role === 'operador';
  const canAssignOperador = !isOperadorRole || !initialOperador;

  useEffect(() => {
    if (!open || !prospectoId) return;
    setLoading(true);
    Promise.all([flotaProspectoDetail(prospectoId), fetchOperadores()])
      .then(([data, ops]) => {
        setOperadores(ops);
        const originalObs = data.observaciones ?? '';
        originalObsRef.current = originalObs;
        const fields: Record<string, string> = {};
        for (const [k, v] of Object.entries(data)) {
          if (v == null) continue;
          if (k === 'observaciones') {
            const entries = originalObs.split('\n---\n');
            fields[k] = entries[0]?.replace(/^\[.+?\]\s*/, '') ?? '';
          } else {
            fields[k] = String(v);
          }
        }
        const resolvedOperador = data.operador
          ? getOperatorDisplayName(data.operador, ops) || data.operador
          : '';
        fields.operador = resolvedOperador;
        setInitialOperador(data.operador);
        setEditData(fields);
      })
      .catch(() => {
        toast.error('No se pudo cargar los datos del prospecto');
        onOpenChange(false);
      })
      .finally(() => setLoading(false));
  }, [open, prospectoId, onOpenChange]);

  async function handleSave() {
    if (!prospectoId) return;
    if (!editData.nombreCompleto?.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }

    setSaving(true);
    const body: Record<string, unknown> = {};
    const allowedFields = [
      'nombreCompleto',
      'celular',
      'movil',
      'edad',
      'distrito',
      'modalidad',
      'redSocial',
      'anioVehiculo',
      'observaciones',
    ] as const;

    for (const k of allowedFields) {
      const v = editData[k];
      if (k === 'edad' || k === 'anioVehiculo') {
        const num = parseInt(v ?? '', 10);
        if (!Number.isNaN(num)) body[k] = num;
      } else if (k === 'observaciones') {
        const currentLatest = originalObsRef.current.split('\n---\n')[0]?.replace(/^(?:\[.+?\]\s*)+/, '') ?? '';
        if (v?.trim() && v.trim() !== currentLatest) {
          const dateStr = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });
          body[k] = `[${dateStr}] ${v.trim()}\n---\n${originalObsRef.current}`;
        } else {
          body[k] = originalObsRef.current || v?.trim() || null;
        }
      } else if (v?.trim()) {
        body[k] = v.trim();
      }
    }

    try {
      const updated = await flotaProspectoUpdate(prospectoId, body);

      const nextOperador = editData.operador?.trim() || null;
      const prevOperador = initialOperador
        ? getOperatorDisplayName(initialOperador, operadores) || initialOperador
        : null;

      if (canAssignOperador && (nextOperador || '') !== (prevOperador || '')) {
        await flotaProspectoSetOperador(prospectoId, nextOperador);
      }

      toast.success('Prospecto actualizado');
      onOpenChange(false);
      onSaved?.({
        nombreCompleto: updated.nombreCompleto,
        celular: updated.celular,
        operador: nextOperador ?? updated.operador,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar prospecto</DialogTitle>
          <DialogDescription>
            Datos del CRM. Al guardar el nombre también se sincroniza con WhatsApp.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-1 col-span-2">
              <Label>Nombre completo *</Label>
              <Input
                value={editData.nombreCompleto ?? ''}
                onChange={(e) => setEditData((prev) => ({ ...prev, nombreCompleto: e.target.value }))}
                placeholder="Nombre completo"
              />
            </div>
            <div className="space-y-1">
              <Label>Celular</Label>
              <Input
                value={editData.celular ?? ''}
                onChange={(e) => setEditData((prev) => ({ ...prev, celular: e.target.value }))}
                placeholder="Celular"
              />
            </div>
            <div className="space-y-1">
              <Label>Móvil</Label>
              <Input
                value={editData.movil ?? ''}
                onChange={(e) => setEditData((prev) => ({ ...prev, movil: e.target.value }))}
                placeholder="Móvil"
              />
            </div>
            <div className="space-y-1">
              <Label>Edad</Label>
              <Input
                type="number"
                value={editData.edad ?? ''}
                onChange={(e) => setEditData((prev) => ({ ...prev, edad: e.target.value }))}
                placeholder="Edad"
              />
            </div>
            <div className="space-y-1">
              <Label>Distrito</Label>
              <Input
                value={editData.distrito ?? ''}
                onChange={(e) => setEditData((prev) => ({ ...prev, distrito: e.target.value }))}
                placeholder="Distrito"
              />
            </div>
            <div className="space-y-1">
              <Label>Operador</Label>
              <Select
                value={editData.operador || '__none__'}
                onValueChange={(v) =>
                  setEditData((prev) => ({ ...prev, operador: v === '__none__' ? '' : v }))
                }
                disabled={!canAssignOperador}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin operador" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin operador</SelectItem>
                  {operadores.map((op) => (
                    <SelectItem key={op.id} value={op.name}>
                      {op.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Modalidad</Label>
              <Select
                value={editData.modalidad || '__none__'}
                onValueChange={(v) =>
                  setEditData((prev) => ({ ...prev, modalidad: v === '__none__' ? '' : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin modalidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin modalidad</SelectItem>
                  {MODALIDAD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                  {editData.modalidad &&
                    !MODALIDAD_OPTIONS.some((o) => o.value === editData.modalidad) && (
                      <SelectItem value={editData.modalidad}>{editData.modalidad}</SelectItem>
                    )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Red social</Label>
              <Input
                value={editData.redSocial ?? ''}
                onChange={(e) => setEditData((prev) => ({ ...prev, redSocial: e.target.value }))}
                placeholder="Red social"
              />
            </div>
            <div className="space-y-1">
              <Label>Año vehículo</Label>
              <Input
                type="number"
                value={editData.anioVehiculo ?? ''}
                onChange={(e) => setEditData((prev) => ({ ...prev, anioVehiculo: e.target.value }))}
                placeholder="Año del vehículo"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Observaciones</Label>
              <Textarea
                value={editData.observaciones ?? ''}
                onChange={(e) => setEditData((prev) => ({ ...prev, observaciones: e.target.value }))}
                placeholder="Observaciones"
                className="min-h-[80px] resize-none"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={saving || loading || !editData.nombreCompleto?.trim()}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
