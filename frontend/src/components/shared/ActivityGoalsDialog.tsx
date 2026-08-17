import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FormDialogActions,
  FormDialogShell,
  formDialogBtnOutlineClass,
  formDialogInputClass,
} from '@/components/ui/form-dialog';
import {
  fetchCrmActivityGoals,
  fetchCrmDailyActivityGoals,
  putCrmActivityGoals,
  putCrmDailyActivityGoals,
  type ActivityGoalTargets,
} from '@/lib/crmConfigApi';
import { toast } from '@/lib/notify';
import { cn } from '@/lib/utils';

type AdvisorOption = { id: string; name: string };

const EMPTY_TARGETS: ActivityGoalTargets = {
  contacto: 0,
  noContacto: 0,
  reuniones: 0,
  correos: 0,
};

const COLUMNS_WEEK: { key: keyof ActivityGoalTargets; label: string }[] = [
  { key: 'contacto', label: 'Contacto' },
  { key: 'noContacto', label: 'No contacto' },
  { key: 'reuniones', label: 'Reuniones' },
  { key: 'correos', label: 'Correos' },
];

const COLUMNS_DAY: { key: keyof ActivityGoalTargets; label: string }[] = [
  { key: 'contacto', label: 'Contacto' },
  { key: 'reuniones', label: 'Reuniones' },
];

interface ActivityGoalsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** week = reportes / semanal; day = dashboard operativo. */
  goalPeriod?: 'week' | 'day';
  weekStart?: string | null;
  weekLabel?: string | null;
  dayStart?: string | null;
  dayLabel?: string | null;
  advisors: AdvisorOption[];
  onSaved?: (goals: Record<string, ActivityGoalTargets>) => void;
}

function normalizeTargets(
  raw: Partial<ActivityGoalTargets> | undefined,
  goalPeriod: 'week' | 'day',
): ActivityGoalTargets {
  const normalized = {
    contacto: Math.max(0, Math.round(Number(raw?.contacto) || 0)),
    noContacto: Math.max(0, Math.round(Number(raw?.noContacto) || 0)),
    reuniones: Math.max(0, Math.round(Number(raw?.reuniones) || 0)),
    correos: Math.max(0, Math.round(Number(raw?.correos) || 0)),
  };
  if (goalPeriod === 'day') {
    return { ...normalized, noContacto: 0, correos: 0 };
  }
  return normalized;
}

function advisorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

export function ActivityGoalsDialog({
  open,
  onOpenChange,
  goalPeriod = 'week',
  weekStart = null,
  weekLabel = null,
  dayStart = null,
  dayLabel = null,
  advisors,
  onSaved,
}: ActivityGoalsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [draft, setDraft] = useState<Record<string, ActivityGoalTargets>>({});

  const periodKey =
    goalPeriod === 'day'
      ? dayStart?.slice(0, 10) ?? ''
      : weekStart?.slice(0, 10) ?? '';
  const periodLabel = goalPeriod === 'day' ? dayLabel : weekLabel;
  const columns = goalPeriod === 'day' ? COLUMNS_DAY : COLUMNS_WEEK;

  const advisorRows = useMemo(() => {
    const byId = new Map(advisors.map((a) => [a.id, a.name]));
    const ids = new Set([...byId.keys(), ...Object.keys(draft)]);
    return [...ids]
      .map((id) => ({
        id,
        name: byId.get(id) ?? 'Asesor',
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [advisors, draft]);

  const loadGoals = useCallback(async () => {
    if (goalPeriod === 'week' && !periodKey) return;
    setLoading(true);
    try {
      const data =
        goalPeriod === 'day'
          ? await fetchCrmDailyActivityGoals()
          : await fetchCrmActivityGoals(periodKey);
      setCanEdit(data.canEdit);
      setDraft(data.byUserId ?? {});
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'No se pudieron cargar las metas.',
      );
      setDraft({});
      setCanEdit(false);
    } finally {
      setLoading(false);
    }
  }, [goalPeriod, periodKey]);

  useEffect(() => {
    if (!open) return;
    if (goalPeriod === 'week' && !periodKey) return;
    void loadGoals();
  }, [open, periodKey, loadGoals, goalPeriod]);

  useEffect(() => {
    if (!open) {
      setDraft({});
      setCanEdit(false);
    }
  }, [open]);

  const setTarget = (
    userId: string,
    key: keyof ActivityGoalTargets,
    value: string,
  ) => {
    const parsed = Math.max(0, Math.round(Number(value) || 0));
    setDraft((prev) => ({
      ...prev,
      [userId]: normalizeTargets(
        {
          ...EMPTY_TARGETS,
          ...prev[userId],
          [key]: parsed,
        },
        goalPeriod,
      ),
    }));
  };

  const save = async () => {
    if (goalPeriod === 'week' && !periodKey) return;
    if (!canEdit) return;
    setSaving(true);
    try {
      const byUserId: Record<string, ActivityGoalTargets> = {};
      for (const row of advisorRows) {
        byUserId[row.id] = normalizeTargets(draft[row.id], goalPeriod);
      }
      const data =
        goalPeriod === 'day'
          ? await putCrmDailyActivityGoals({ byUserId })
          : await putCrmActivityGoals({ weekStart: periodKey, byUserId });
      setDraft(data.byUserId ?? {});
      onSaved?.(data.byUserId ?? {});
      toast.success(
        goalPeriod === 'day'
          ? 'Metas diarias guardadas'
          : 'Metas de actividades guardadas',
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'No se pudieron guardar las metas.',
      );
    } finally {
      setSaving(false);
    }
  };

  const description =
    goalPeriod === 'day'
      ? 'Objetivos diarios por asesor (vigentes hasta nuevo cambio). El avance diario usa contacto + reuniones.'
      : periodLabel
        ? `Semana ${periodLabel} · objetivos semanales por asesor y tipo de actividad.`
        : 'Objetivos semanales por asesor y tipo de actividad.';

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      maxWidthClassName="sm:max-w-2xl"
      title="Metas de actividades"
      description={description}
      bodyClassName="mt-0 pb-0"
      footer={
        canEdit ? (
          <FormDialogActions
            cancelLabel="Cancelar"
            submitLabel="Guardar metas"
            submitting={saving}
            submitDisabled={loading || advisorRows.length === 0}
            onCancel={() => onOpenChange(false)}
            onSubmit={() => void save()}
          />
        ) : (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              className={cn('min-w-[7.5rem]', formDialogBtnOutlineClass)}
              onClick={() => onOpenChange(false)}
            >
              Cerrar
            </Button>
          </div>
        )
      }
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin text-primary/70" />
          Cargando metas…
        </div>
      ) : advisorRows.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-16 text-center">
          <p className="text-sm font-medium text-foreground">No hay asesores</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            No hay asesores disponibles para configurar metas en este periodo.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="px-1 py-3 text-left text-sm font-semibold text-foreground/90">
                    Asesor
                  </th>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className="px-2 py-3 text-center text-sm font-semibold text-foreground/90"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {advisorRows.map((row) => {
                  const targets = normalizeTargets(draft[row.id], goalPeriod);
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-border/40 last:border-0"
                    >
                      <td className="py-3 pr-3">
                        <div className="flex min-w-[9rem] items-center gap-2.5">
                          <span
                            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[#13944C]/10 text-[10px] font-semibold text-[#13944C]"
                            aria-hidden
                          >
                            {advisorInitials(row.name)}
                          </span>
                          <span className="truncate font-medium text-foreground">
                            {row.name}
                          </span>
                        </div>
                      </td>
                      {columns.map((col) => (
                        <td key={col.key} className="px-2 py-2 text-center">
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            inputMode="numeric"
                            disabled={!canEdit}
                            aria-label={`${col.label} · ${row.name}`}
                            value={targets[col.key] || ''}
                            placeholder="0"
                            onChange={(e) =>
                              setTarget(row.id, col.key, e.target.value)
                            }
                            className={cn(
                              formDialogInputClass,
                              '!w-[4.5rem] !min-w-[4.5rem] mx-auto text-center tabular-nums',
                              !canEdit && 'cursor-not-allowed opacity-60',
                            )}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!canEdit ? (
            <p className="text-center text-xs text-muted-foreground">
              Solo lectura: no tienes permiso para editar estas metas.
            </p>
          ) : null}
        </div>
      )}
    </FormDialogShell>
  );
}
