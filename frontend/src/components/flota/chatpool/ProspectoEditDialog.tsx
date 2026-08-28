import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  FormDialogActions,
  FormDialogField,
  FormDialogGrid,
  FormDialogShell,
  formDialogInputClass,
  formDialogSelectTriggerClass,
  formDialogTextareaClass,
} from '@/components/ui/form-dialog';
import {
  CIUDAD_OPTIONS,
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

const AIRE_ACONDICIONADO_OPTIONS = [
  { label: 'SI', value: 'SI' },
  { label: 'No', value: 'No' },
];

const ASISTENCIA_OPTIONS = [
  { label: 'Asistió', value: 'Asistió' },
  { label: 'No Asistió', value: 'No Asistió' },
];

function parseFechaCitaInputs(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  const time = d.toLocaleTimeString('en-GB', {
    timeZone: 'America/Lima',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return { date, time };
}

function formatDateLocal(iso: string): string {
  return new Date(iso).toLocaleDateString('es-PE', { timeZone: 'America/Lima' });
}

function FormSection({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <h3 className="mb-4 text-[13px] font-semibold text-foreground">
        {title}
      </h3>
      <FormDialogGrid className="gap-x-4 gap-y-4 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-5">
        {children}
      </FormDialogGrid>
    </section>
  );
}

export type ProspectoEditSaved = {
  nombreCompleto: string;
  celular: string | null;
  operador: string | null;
  estado?: string | null;
  fechaCita?: string | null;
  asistencia?: string | null;
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
  const [prospectoEstado, setProspectoEstado] = useState('');
  const [fechaAfiliacion, setFechaAfiliacion] = useState<string | null>(null);
  const [initialOperador, setInitialOperador] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const originalObsRef = useRef('');

  const isCitado = prospectoEstado === 'Citado';
  const showFechaAfiliacion = prospectoEstado === 'Afiliado' || !!fechaAfiliacion;

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
        if (data.fechaCita) {
          const { date, time } = parseFechaCitaInputs(data.fechaCita);
          fields.fechaCitaDate = date;
          fields.fechaCitaTime = time;
        }
        setProspectoEstado(data.estado ?? '');
        setFechaAfiliacion(data.fechaAfiliacion ?? null);
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
      'dni',
      'celular',
      'movil',
      'edad',
      'distrito',
      'ciudad',
      'modalidad',
      'placa',
      'aireAcondicionado',
      'categoriaVehiculo',
      'marca',
      'modelo',
      'color',
      'combustible',
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

    if (isCitado && editData.fechaCitaDate?.trim()) {
      const time = editData.fechaCitaTime?.trim() || '00:00';
      body.fechaCita = new Date(`${editData.fechaCitaDate}T${time}:00`).toISOString();
    }

    if (isCitado && editData.asistencia?.trim()) {
      body.asistencia = editData.asistencia.trim();
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
        estado: updated.estado ?? prospectoEstado,
        fechaCita: updated.fechaCita ?? (isCitado ? (body.fechaCita as string | undefined) ?? null : null),
        asistencia: updated.asistencia ?? (isCitado ? editData.asistencia?.trim() || null : null),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Editar prospecto"
      description="Modifica los datos del prospecto. El nombre se sincroniza con WhatsApp al guardar."
      maxWidthClassName="sm:max-w-2xl"
      bodyClassName="pb-2"
      footer={
        <FormDialogActions
          onCancel={() => onOpenChange(false)}
          onSubmit={() => void handleSave()}
          submitting={saving}
          submitDisabled={loading || !editData.nombreCompleto?.trim()}
        />
      }
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
          <p className="text-sm">Cargando datos…</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 sm:gap-5">
          <FormSection title="Datos personales">
            <FormDialogField label="Nombre completo" required className="sm:col-span-2">
              <Input
                className={formDialogInputClass}
                value={editData.nombreCompleto ?? ''}
                onChange={(e) => setEditData((prev) => ({ ...prev, nombreCompleto: e.target.value }))}
                placeholder="Nombres y apellidos"
              />
            </FormDialogField>
            <FormDialogField label="DNI">
              <Input
                className={formDialogInputClass}
                value={editData.dni ?? ''}
                onChange={(e) => setEditData((prev) => ({ ...prev, dni: e.target.value }))}
                placeholder="DNI"
              />
            </FormDialogField>
            <FormDialogField label="Edad">
              <Input
                type="number"
                className={formDialogInputClass}
                value={editData.edad ?? ''}
                onChange={(e) => setEditData((prev) => ({ ...prev, edad: e.target.value }))}
                placeholder="Edad"
              />
            </FormDialogField>
            <FormDialogField label="Celular">
              <Input
                className={formDialogInputClass}
                value={editData.celular ?? ''}
                onChange={(e) => setEditData((prev) => ({ ...prev, celular: e.target.value }))}
                placeholder="Celular"
              />
            </FormDialogField>
            <FormDialogField label="Móvil">
              <Input
                className={formDialogInputClass}
                value={editData.movil ?? ''}
                onChange={(e) => setEditData((prev) => ({ ...prev, movil: e.target.value }))}
                placeholder="Móvil"
              />
            </FormDialogField>
          </FormSection>

          <FormSection title="Vehículo">
            <FormDialogField label="Placa">
              <Input
                className={formDialogInputClass}
                value={editData.placa ?? ''}
                onChange={(e) => setEditData((prev) => ({ ...prev, placa: e.target.value }))}
                placeholder="ABC-123"
              />
            </FormDialogField>
            <FormDialogField label="Año vehículo">
              <Input
                type="number"
                className={formDialogInputClass}
                value={editData.anioVehiculo ?? ''}
                onChange={(e) => setEditData((prev) => ({ ...prev, anioVehiculo: e.target.value }))}
                placeholder="2024"
              />
            </FormDialogField>
            <FormDialogField label="Modalidad">
              <Select
                value={editData.modalidad || '__none__'}
                onValueChange={(v) =>
                  setEditData((prev) => ({ ...prev, modalidad: v === '__none__' ? '' : v }))
                }
              >
                <SelectTrigger className={formDialogSelectTriggerClass}>
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
            </FormDialogField>
            <FormDialogField label="Aire acondicionado">
              <Select
                value={editData.aireAcondicionado || '__none__'}
                onValueChange={(v) =>
                  setEditData((prev) => ({
                    ...prev,
                    aireAcondicionado: v === '__none__' ? '' : v,
                  }))
                }
              >
                <SelectTrigger className={formDialogSelectTriggerClass}>
                  <SelectValue placeholder="Sin dato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin dato</SelectItem>
                  {AIRE_ACONDICIONADO_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                  {editData.aireAcondicionado &&
                    !AIRE_ACONDICIONADO_OPTIONS.some((o) => o.value === editData.aireAcondicionado) && (
                      <SelectItem value={editData.aireAcondicionado}>
                        {editData.aireAcondicionado}
                      </SelectItem>
                    )}
                </SelectContent>
              </Select>
            </FormDialogField>
            <FormDialogField label="Categoría">
              <Input
                className={formDialogInputClass}
                value={editData.categoriaVehiculo ?? ''}
                onChange={(e) =>
                  setEditData((prev) => ({ ...prev, categoriaVehiculo: e.target.value }))
                }
                placeholder="Ej. M1"
              />
            </FormDialogField>
            <FormDialogField label="Marca">
              <Input
                className={formDialogInputClass}
                value={editData.marca ?? ''}
                onChange={(e) => setEditData((prev) => ({ ...prev, marca: e.target.value }))}
                placeholder="Marca"
              />
            </FormDialogField>
            <FormDialogField label="Modelo">
              <Input
                className={formDialogInputClass}
                value={editData.modelo ?? ''}
                onChange={(e) => setEditData((prev) => ({ ...prev, modelo: e.target.value }))}
                placeholder="Modelo"
              />
            </FormDialogField>
            <FormDialogField label="Color">
              <Input
                className={formDialogInputClass}
                value={editData.color ?? ''}
                onChange={(e) => setEditData((prev) => ({ ...prev, color: e.target.value }))}
                placeholder="Color"
              />
            </FormDialogField>
            <FormDialogField label="Combustible">
              <Input
                className={formDialogInputClass}
                value={editData.combustible ?? ''}
                onChange={(e) => setEditData((prev) => ({ ...prev, combustible: e.target.value }))}
                placeholder="Gasolina, GNV…"
              />
            </FormDialogField>
          </FormSection>

          <FormSection title="Ubicación y seguimiento">
            <FormDialogField label="Distrito">
              <Input
                className={formDialogInputClass}
                value={editData.distrito ?? ''}
                onChange={(e) => setEditData((prev) => ({ ...prev, distrito: e.target.value }))}
                placeholder="Distrito"
              />
            </FormDialogField>
            <FormDialogField label="Ciudad">
              <Select
                value={editData.ciudad || '__none__'}
                onValueChange={(v) =>
                  setEditData((prev) => ({ ...prev, ciudad: v === '__none__' ? '' : v }))
                }
              >
                <SelectTrigger className={formDialogSelectTriggerClass}>
                  <SelectValue placeholder="Sin ciudad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin ciudad</SelectItem>
                  {CIUDAD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                  {editData.ciudad &&
                    !CIUDAD_OPTIONS.some((o) => o.value === editData.ciudad) && (
                      <SelectItem value={editData.ciudad}>{editData.ciudad}</SelectItem>
                    )}
                </SelectContent>
              </Select>
            </FormDialogField>
            <FormDialogField label="Operador">
              <Select
                value={editData.operador || '__none__'}
                onValueChange={(v) =>
                  setEditData((prev) => ({ ...prev, operador: v === '__none__' ? '' : v }))
                }
                disabled={!canAssignOperador}
              >
                <SelectTrigger className={formDialogSelectTriggerClass}>
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
            </FormDialogField>
            <FormDialogField label="Red social">
              <Input
                className={formDialogInputClass}
                value={editData.redSocial ?? ''}
                onChange={(e) => setEditData((prev) => ({ ...prev, redSocial: e.target.value }))}
                placeholder="Facebook, TikTok…"
              />
            </FormDialogField>
          </FormSection>

          {isCitado ? (
            <FormSection title="Cita">
              <FormDialogField label="F. cita">
                <Input
                  type="date"
                  className={formDialogInputClass}
                  value={editData.fechaCitaDate ?? ''}
                  onChange={(e) =>
                    setEditData((prev) => ({ ...prev, fechaCitaDate: e.target.value }))
                  }
                />
              </FormDialogField>
              <FormDialogField label="Hora cita">
                <Input
                  type="time"
                  className={formDialogInputClass}
                  value={editData.fechaCitaTime ?? ''}
                  onChange={(e) =>
                    setEditData((prev) => ({ ...prev, fechaCitaTime: e.target.value }))
                  }
                />
              </FormDialogField>
              <FormDialogField label="Asistencia">
                <Select
                  value={editData.asistencia || '__none__'}
                  onValueChange={(v) =>
                    setEditData((prev) => ({
                      ...prev,
                      asistencia: v === '__none__' ? '' : v,
                    }))
                  }
                >
                  <SelectTrigger className={formDialogSelectTriggerClass}>
                    <SelectValue placeholder="Sin registrar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin registrar</SelectItem>
                    {ASISTENCIA_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormDialogField>
            </FormSection>
          ) : null}

          {showFechaAfiliacion ? (
            <FormSection title="Afiliación">
              <FormDialogField
                label="F. afiliación"
                className="sm:col-span-2"
                hint="Se registra automáticamente al cambiar el estado a Afiliado."
              >
                <Input
                  readOnly
                  className={`${formDialogInputClass} cursor-default bg-muted/40`}
                  value={fechaAfiliacion ? formatDateLocal(fechaAfiliacion) : '—'}
                />
              </FormDialogField>
            </FormSection>
          ) : null}

          <section>
            <h3 className="mb-4 text-[13px] font-semibold text-foreground">
              Observaciones
            </h3>
            <Textarea
              className={formDialogTextareaClass}
              value={editData.observaciones ?? ''}
              onChange={(e) => setEditData((prev) => ({ ...prev, observaciones: e.target.value }))}
              placeholder="Notas del prospecto"
            />
          </section>
        </div>
      )}
    </FormDialogShell>
  );
}
