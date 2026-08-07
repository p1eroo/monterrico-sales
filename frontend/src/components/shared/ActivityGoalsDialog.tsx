import { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  fetchCrmActivityGoals,
  putCrmActivityGoals,
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

const COLUMNS: { key: keyof ActivityGoalTargets; label: string }[] = [
  { key: 'contacto', label: 'Contacto' },
  { key: 'noContacto', label: 'No contacto' },
  { key: 'reuniones', label: 'Reuniones' },
  { key: 'correos', label: 'Correos' },
];

interface ActivityGoalsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weekStart: string | null;
  weekLabel: string | null;
  advisors: AdvisorOption[];
  onSaved?: (goals: Record<string, ActivityGoalTargets>) => void;
}

function normalizeTargets(raw: Partial<ActivityGoalTargets> | undefined): ActivityGoalTargets {
  return {
    contacto: Math.max(0, Math.round(Number(raw?.contacto) || 0)),
    noContacto: Math.max(0, Math.round(Number(raw?.noContacto) || 0)),
    reuniones: Math.max(0, Math.round(Number(raw?.reuniones) || 0)),
    correos: Math.max(0, Math.round(Number(raw?.correos) || 0)),
  };
}

export function ActivityGoalsDialog({
  open,
  onOpenChange,
  weekStart,
  weekLabel,
  advisors,
  onSaved,
}: ActivityGoalsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [draft, setDraft] = useState<Record<string, ActivityGoalTargets>>({});

  const weekStartKey = weekStart?.slice(0, 10) ?? '';

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
    if (!weekStartKey) return;
    setLoading(true);
    try {
      const data = await fetchCrmActivityGoals(weekStartKey);
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
  }, [weekStartKey]);

  useEffect(() => {
    if (!open || !weekStartKey) return;
    void loadGoals();
  }, [open, weekStartKey, loadGoals]);

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
      [userId]: normalizeTargets({
        ...EMPTY_TARGETS,
        ...prev[userId],
        [key]: parsed,
      }),
    }));
  };

  const save = async () => {
    if (!weekStartKey || !canEdit) return;
    setSaving(true);
    try {
      const byUserId: Record<string, ActivityGoalTargets> = {};
      for (const row of advisorRows) {
        byUserId[row.id] = normalizeTargets(draft[row.id]);
      }
      const data = await putCrmActivityGoals({
        weekStart: weekStartKey,
        byUserId,
      });
      setDraft(data.byUserId ?? {});
      onSaved?.(data.byUserId ?? {});
      toast.success('Metas de actividades guardadas');
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'No se pudieron guardar las metas.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Metas de actividades</DialogTitle>
          <DialogDescription>
            {weekLabel
              ? `Semana ${weekLabel} · objetivos semanales por asesor`
              : 'Objetivos semanales por asesor'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Cargando metas…
            </div>
          ) : advisorRows.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No hay asesores para configurar metas.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/70">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/40 text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2.5 font-medium">Asesor</th>
                    {COLUMNS.map((col) => (
                      <th key={col.key} className="px-2 py-2.5 font-medium">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {advisorRows.map((row) => {
                    const targets = normalizeTargets(draft[row.id]);
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-border/50 last:border-0"
                      >
                        <td className="px-3 py-2 font-medium text-foreground">
                          {row.name}
                        </td>
                        {COLUMNS.map((col) => (
                          <td key={col.key} className="px-2 py-1.5">
                            <Input
                              type="number"
                              min={0}
                              step={1}
                              disabled={!canEdit}
                              value={targets[col.key] || ''}
                              onChange={(e) =>
                                setTarget(row.id, col.key, e.target.value)
                              }
                              className={cn(
                                'h-8 w-16 px-2 text-center text-xs',
                                !canEdit && 'opacity-70',
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
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cerrar
          </Button>
          {canEdit ? (
            <Button type="button" onClick={() => void save()} disabled={saving || loading}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                'Guardar metas'
              )}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
