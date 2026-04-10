import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Building2, Globe, GitBranch, Flag,
  Activity, Settings as SettingsIcon,
  Plus, Trash2, GripVertical, Phone, Mail,
  MapPin, Save, Video, FileText,
  MessageCircle, Bell, Moon, Link2, CheckCircle2,
  Target, CalendarDays, Calendar, ChevronUp, ChevronDown,
  Loader2,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { useGoalsStore, hydrateGoalsFromBundle } from '@/store/goalsStore';
import { useUsers } from '@/hooks/useUsers';
import { usePermissions } from '@/hooks/usePermissions';
import { useCrmConfigStore } from '@/store/crmConfigStore';
import {
  fetchCrmConfig,
  patchCrmOrganization,
  putCrmLeadSources,
  putCrmStages,
  putCrmPriorities,
  putCrmActivityTypes,
  putCrmSalesGoals,
} from '@/lib/crmConfigApi';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Card, CardContent, CardHeader,
  CardTitle, CardDescription,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const MONTH_SHORT_ES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
] as const;

function labelYearMonthEs(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTH_SHORT_ES[(m ?? 1) - 1]} ${y}`;
}

/** Doce claves YYYY-MM para un año calendario (UTC). */
function yearMonthKeysUtc(year: number): string[] {
  const keys: string[] = [];
  for (let month = 1; month <= 12; month++) {
    keys.push(`${year}-${String(month).padStart(2, '0')}`);
  }
  return keys;
}

function utcCalendarYearNow(): number {
  return new Date().getUTCFullYear();
}

/** Años elegibles en el selector (ancla al año UTC actual en cada render). */
function teamGoalYearSelectRange(): number[] {
  const y = utcCalendarYearNow();
  return Array.from({ length: 8 }, (_, i) => y - 3 + i);
}

/**
 * Diff completo para PUT: incluye cambios en cualquier mes, no solo los visibles.
 * Omite entradas que no cambiarían el estado en servidor.
 */
function buildMonthlyGoalsPatch(
  monthlyOrgByYm: Record<string, number>,
  lastSyncedMonthlyByYm: Record<string, number>,
): Record<string, number> {
  const keys = new Set([
    ...Object.keys(monthlyOrgByYm),
    ...Object.keys(lastSyncedMonthlyByYm),
  ]);
  const monthlyPatch: Record<string, number> = {};
  for (const ym of keys) {
    const edited = monthlyOrgByYm[ym];
    const was = lastSyncedMonthlyByYm[ym];
    if (edited !== undefined) {
      if (edited <= 0) {
        if (was !== undefined) monthlyPatch[ym] = 0;
      } else if (edited !== was) {
        monthlyPatch[ym] = edited;
      }
    } else if (was !== undefined) {
      monthlyPatch[ym] = 0;
    }
  }
  return monthlyPatch;
}

function buildAdvisorMonthlyGoalsPatch(
  draft: Record<string, Record<string, number>>,
  synced: Record<string, Record<string, number>>,
): Record<string, Record<string, number>> | undefined {
  const userIds = new Set([...Object.keys(draft), ...Object.keys(synced)]);
  const out: Record<string, Record<string, number>> = {};
  for (const uid of userIds) {
    const d = draft[uid] ?? {};
    const s = synced[uid] ?? {};
    const keys = new Set([...Object.keys(d), ...Object.keys(s)]);
    const innerPatch: Record<string, number> = {};
    for (const ym of keys) {
      const edited = d[ym];
      const was = s[ym];
      if (edited !== undefined) {
        if (edited <= 0) {
          if (was !== undefined) innerPatch[ym] = 0;
        } else if (edited !== was) {
          innerPatch[ym] = edited;
        }
      } else if (was !== undefined) {
        innerPatch[ym] = 0;
      }
    }
    if (Object.keys(innerPatch).length > 0) {
      out[uid] = innerPatch;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

const NAV_SECTIONS = [
  { id: 'general', label: 'General', icon: Building2 },
  { id: 'metas', label: 'Metas', icon: Target },
  { id: 'integraciones', label: 'Integraciones', icon: Link2 },
  { id: 'fuentes', label: 'Fuentes de Contactos', icon: Globe },
  { id: 'pipeline', label: 'Etapas', icon: GitBranch },
  { id: 'prioridades', label: 'Prioridades', icon: Flag },
  { id: 'actividades', label: 'Tipos de Actividad', icon: Activity },
  { id: 'preferencias', label: 'Preferencias', icon: SettingsIcon },
] as const;

const ACTIVITY_TYPE_ICONS: Record<string, typeof Phone> = {
  llamada: Phone,
  reunion: Video,
  tarea: FileText,
  correo: Mail,
  whatsapp: MessageCircle,
};

function GoalsSettingsCard() {
  const { users } = useUsers();
  const { currentUser } = useAppStore();
  const bundle = useCrmConfigStore((s) => s.bundle);
  const canView = bundle?.permissions.canViewTeamGoals ?? false;
  const canEditGoals = bundle?.permissions.canEditSalesGoals ?? false;

  const {
    globalWeeklyGoal,
    userWeeklyGoals,
    monthlyOrgByYm,
    setGlobalWeeklyGoal,
    setUserWeeklyGoal,
    setMonthlyOrgForYm,
    advisorMonthlyByYm,
    setAdvisorMonthlyForUserYm,
  } = useGoalsStore();

  const setBundle = useCrmConfigStore((s) => s.setBundle);

  const [teamGoalYear, setTeamGoalYear] = useState(utcCalendarYearNow);
  const [advisorMonthYear, setAdvisorMonthYear] = useState(utcCalendarYearNow);
  const [advisorPickerId, setAdvisorPickerId] = useState('');
  const monthKeysForYear = useMemo(
    () => yearMonthKeysUtc(teamGoalYear),
    [teamGoalYear],
  );
  const teamGoalYearOptions = useMemo(() => {
    const base = teamGoalYearSelectRange();
    const set = new Set(base);
    set.add(teamGoalYear);
    return [...set].sort((a, b) => a - b);
  }, [teamGoalYear]);

  const roleUsers = users.filter((u) => u.role === 'asesor');

  useEffect(() => {
    if (roleUsers.length === 0) return;
    if (!advisorPickerId || !roleUsers.some((u) => u.id === advisorPickerId)) {
      setAdvisorPickerId(roleUsers[0].id);
    }
  }, [roleUsers, advisorPickerId]);

  const advisorMonthKeysForYear = useMemo(
    () => yearMonthKeysUtc(advisorMonthYear),
    [advisorMonthYear],
  );
  const advisorGoalYearOptions = useMemo(() => {
    const base = teamGoalYearSelectRange();
    const set = new Set(base);
    set.add(advisorMonthYear);
    return [...set].sort((a, b) => a - b);
  }, [advisorMonthYear]);

  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!canEditGoals) return;
    setSaving(true);
    try {
      const byUserId: Record<string, { weekly?: number; monthly?: number }> = {};
      for (const u of roleUsers) {
        byUserId[u.id] = { weekly: userWeeklyGoals[u.id] ?? 0 };
      }
      const {
        monthlyOrgByYm: mo,
        lastSyncedMonthlyByYm: synced,
        advisorMonthlyByYm: advDraft,
        lastSyncedAdvisorMonthlyByYm: advSynced,
      } = useGoalsStore.getState();
      const monthlyPatch = buildMonthlyGoalsPatch(mo, synced);
      const advisorPatch = buildAdvisorMonthlyGoalsPatch(advDraft, advSynced);
      const b = await putCrmSalesGoals({
        globalWeekly: globalWeeklyGoal,
        byUserId,
        ...(Object.keys(monthlyPatch).length > 0 ? { monthlyByYm: monthlyPatch } : {}),
        ...(advisorPatch ? { advisorMonthlyByYm: advisorPatch } : {}),
      });
      setBundle(b);
      hydrateGoalsFromBundle(b, currentUser.id);
      toast.success('Metas guardadas');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar metas.');
    } finally {
      setSaving(false);
    }
  };

  if (!canView) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Metas</CardTitle>
          <CardDescription>
            Solo quien tiene permiso de ver configuración puede editar las metas del equipo. Consulta con un administrador.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Metas</CardTitle>
        <CardDescription>
          Metas de ventas del equipo y por asesor (S/). Se guardan en el servidor.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="semana" className="w-full">
          <TabsList className="mb-4 h-10 w-full sm:w-auto">
            <TabsTrigger value="semana" className="gap-2">
              <CalendarDays className="size-4" />
              Semana
            </TabsTrigger>
            <TabsTrigger value="mes" className="gap-2">
              <Calendar className="size-4" />
              Mes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="semana" className="mt-0 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="global-weekly">Meta global del equipo (S/ por semana)</Label>
              <Input
                id="global-weekly"
                type="number"
                min={0}
                disabled={!canEditGoals}
                value={globalWeeklyGoal}
                onChange={(e) => setGlobalWeeklyGoal(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label className="mb-3 block">Meta semanal por asesor (S/ por semana)</Label>
              <div className="space-y-3">
                {roleUsers.map((u) => (
                  <div key={`weekly-${u.id}`} className="flex items-center justify-between gap-4 rounded-lg border p-3">
                    <span className="text-sm font-medium">{u.name}</span>
                    <Input
                      type="number"
                      min={0}
                      disabled={!canEditGoals}
                      className="w-32"
                      value={userWeeklyGoals[u.id] ?? 0}
                      onChange={(e) => setUserWeeklyGoal(u.id, Number(e.target.value) || 0)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="mes" className="mt-0 space-y-6">
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-1">
                  <Label className="text-base">Meta del equipo por mes calendario</Label>
                  <p className="text-sm text-muted-foreground">
                    Elige el año (UTC, mismo criterio que reportes). Mes vacío = sin meta para ese mes.
                    Puedes editar varios años y guardar una vez: se envían todos los cambios pendientes.
                  </p>
                </div>
                <div className="space-y-1.5 sm:w-44">
                  <Label htmlFor="team-goal-year" className="text-muted-foreground">
                    Año
                  </Label>
                  <Select
                    value={String(teamGoalYear)}
                    onValueChange={(v) => setTeamGoalYear(Number(v))}
                  >
                    <SelectTrigger id="team-goal-year" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {teamGoalYearOptions.map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {monthKeysForYear.map((ym) => (
                  <div
                    key={ym}
                    className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2"
                  >
                    <span className="text-sm font-medium tabular-nums text-muted-foreground">
                      {labelYearMonthEs(ym)}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      disabled={!canEditGoals}
                      className="w-40"
                      placeholder="0"
                      value={monthlyOrgByYm[ym] ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '') {
                          setMonthlyOrgForYm(ym, undefined);
                          return;
                        }
                        const n = Number(raw);
                        if (!Number.isFinite(n)) return;
                        setMonthlyOrgForYm(ym, n);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <div className="space-y-1">
                <Label className="text-base">Meta por mes y por asesor</Label>
                <p className="text-sm text-muted-foreground">
                  UTC (igual que reportes). En &quot;Ventas cerradas por mes&quot; con filtro por asesor,
                  cada barra usa el monto de ese mes; sin valor guardado, la meta de ese mes es 0. La meta
                  mensual del dashboard personal también toma el mes calendario actual desde aquí.
                </p>
              </div>
              {roleUsers.length > 0 && advisorPickerId ? (
                <>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Label htmlFor="advisor-pick-monthly" className="text-muted-foreground">
                        Asesor
                      </Label>
                      <Select
                        value={advisorPickerId}
                        onValueChange={setAdvisorPickerId}
                      >
                        <SelectTrigger id="advisor-pick-monthly" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roleUsers.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 sm:w-44">
                      <Label htmlFor="advisor-goal-year" className="text-muted-foreground">
                        Año
                      </Label>
                      <Select
                        value={String(advisorMonthYear)}
                        onValueChange={(v) => setAdvisorMonthYear(Number(v))}
                      >
                        <SelectTrigger id="advisor-goal-year" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {advisorGoalYearOptions.map((y) => (
                            <SelectItem key={y} value={String(y)}>
                              {y}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {advisorMonthKeysForYear.map((ym) => (
                      <div
                        key={`${advisorPickerId}-${ym}`}
                        className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2"
                      >
                        <span className="text-sm font-medium tabular-nums text-muted-foreground">
                          {labelYearMonthEs(ym)}
                        </span>
                        <Input
                          type="number"
                          min={0}
                          disabled={!canEditGoals}
                          className="w-40"
                          placeholder="0"
                          value={advisorMonthlyByYm[advisorPickerId]?.[ym] ?? ''}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === '') {
                              setAdvisorMonthlyForUserYm(advisorPickerId, ym, undefined);
                              return;
                            }
                            const n = Number(raw);
                            if (!Number.isFinite(n)) return;
                            setAdvisorMonthlyForUserYm(advisorPickerId, ym, n);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </TabsContent>
        </Tabs>

        {canEditGoals && (
          <div className="mt-6 flex justify-end">
            <Button
              className="bg-primary text-white hover:bg-primary/90"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Guardar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type LeadRow = { slug: string; name: string; enabled: boolean };
type StageRow = {
  slug: string;
  name: string;
  color: string;
  probability: number;
  enabled: boolean;
  isSystem: boolean;
};
type PriorityRow = {
  slug: string;
  name: string;
  color: string;
  description: string;
  enabled: boolean;
};
type ActivityRow = { slug: string; name: string; enabled: boolean };

export default function Settings() {
  const [searchParams] = useSearchParams();
  const gmailConnected = useAppStore((s) => s.gmailConnected);
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('configuracion.editar');

  const bundle = useCrmConfigStore((s) => s.bundle);
  const setBundle = useCrmConfigStore((s) => s.setBundle);

  const tabFromUrl = searchParams.get('tab');
  const normalizedTab =
    tabFromUrl === 'estados' ? 'pipeline' : tabFromUrl;
  const [activeTab, setActiveTab] = useState(
    normalizedTab && NAV_SECTIONS.some((s) => s.id === normalizedTab) ? normalizedTab : 'general',
  );

  const [loadError, setLoadError] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState('');
  const [companyDesc, setCompanyDesc] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');

  const [leadSources, setLeadSources] = useState<LeadRow[]>([]);
  const [newSourceName, setNewSourceName] = useState('');

  const [pipelineStages, setPipelineStages] = useState<StageRow[]>([]);
  const [addStageOpen, setAddStageOpen] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState('#64748b');

  const [priorities, setPriorities] = useState<PriorityRow[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityRow[]>([]);

  const [emailNotif, setEmailNotif] = useState(true);
  const [pushNotif, setPushNotif] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const [savingGeneral, setSavingGeneral] = useState(false);

  const refreshBundle = useCallback(async () => {
    try {
      setLoadError(null);
      const b = await fetchCrmConfig();
      setBundle(b);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Error al cargar configuración');
    }
  }, [setBundle]);

  useEffect(() => {
    if (!bundle) {
      void refreshBundle();
    }
  }, [bundle, refreshBundle]);

  useEffect(() => {
    if (!bundle?.organization) return;
    const o = bundle.organization;
    setCompanyName(o.name);
    setCompanyDesc(o.description);
    setContactEmail(o.contactEmail);
    setContactPhone(o.contactPhone);
    setAddress(o.address);
  }, [bundle?.organization]);

  useEffect(() => {
    if (!bundle?.catalog) return;
    const c = bundle.catalog;
    setLeadSources(
      [...c.leadSources].sort((a, b) => a.sortOrder - b.sortOrder).map((r) => ({
        slug: r.slug,
        name: r.name,
        enabled: r.enabled,
      })),
    );
    setPipelineStages(
      [...c.stages].sort((a, b) => a.sortOrder - b.sortOrder).map((r) => ({
        slug: r.slug,
        name: r.name,
        color: r.color,
        probability: r.probability,
        enabled: r.enabled,
        isSystem: r.isSystem,
      })),
    );
    setPriorities(
      [...c.priorities].sort((a, b) => a.sortOrder - b.sortOrder).map((r) => ({
        slug: r.slug,
        name: r.name,
        color: r.color,
        description: r.description,
        enabled: r.enabled,
      })),
    );
    setActivityTypes(
      [...c.activityTypes].sort((a, b) => a.sortOrder - b.sortOrder).map((r) => ({
        slug: r.slug,
        name: r.name,
        enabled: r.enabled,
      })),
    );
  }, [bundle?.catalog]);

  function slugify(name: string): string {
    const base = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
    return base || 'item';
  }

  function addLeadSource() {
    const trimmed = newSourceName.trim();
    if (!trimmed) return;
    const base = slugify(trimmed);
    const used = new Set(leadSources.map((s) => s.slug));
    let slug = base;
    let n = 1;
    while (used.has(slug)) {
      slug = `${base}_${n}`;
      n++;
    }
    setLeadSources((prev) => [...prev, { slug, name: trimmed, enabled: true }]);
    setNewSourceName('');
  }

  function removeLeadSource(slug: string) {
    setLeadSources((prev) => prev.filter((s) => s.slug !== slug));
  }

  function toggleLeadSource(slug: string) {
    setLeadSources((prev) =>
      prev.map((s) => (s.slug === slug ? { ...s, enabled: !s.enabled } : s)),
    );
  }

  function togglePipelineStage(slug: string) {
    setPipelineStages((prev) =>
      prev.map((s) => (s.slug === slug ? { ...s, enabled: !s.enabled } : s)),
    );
  }

  function setStageProbability(slug: string, probability: number) {
    setPipelineStages((prev) =>
      prev.map((s) => (s.slug === slug ? { ...s, probability } : s)),
    );
  }

  function movePipelineStage(index: number, delta: number) {
    setPipelineStages((prev) => {
      const j = index + delta;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      const t = next[index];
      next[index] = next[j]!;
      next[j] = t!;
      return next;
    });
  }

  function addPipelineStage() {
    const trimmed = newStageName.trim();
    if (!trimmed) return;
    const base = slugify(trimmed);
    const existing = new Set(pipelineStages.map((s) => s.slug));
    let slug = base;
    let n = 1;
    while (existing.has(slug)) {
      slug = `${base}_${n}`;
      n++;
    }
    setPipelineStages((prev) => [
      ...prev,
      {
        slug,
        name: trimmed,
        color: newStageColor,
        probability: 0,
        enabled: true,
        isSystem: false,
      },
    ]);
    setNewStageName('');
    setNewStageColor('#64748b');
    setAddStageOpen(false);
  }

  function removePipelineStage(slug: string) {
    setPipelineStages((prev) => prev.filter((s) => s.slug !== slug));
  }

  function toggleActivityType(slug: string) {
    setActivityTypes((prev) =>
      prev.map((a) => (a.slug === slug ? { ...a, enabled: !a.enabled } : a)),
    );
  }

  function togglePriority(slug: string) {
    setPriorities((prev) =>
      prev.map((p) => (p.slug === slug ? { ...p, enabled: !p.enabled } : p)),
    );
  }

  function setPriorityDescription(slug: string, description: string) {
    setPriorities((prev) =>
      prev.map((p) => (p.slug === slug ? { ...p, description } : p)),
    );
  }

  async function saveGeneral() {
    if (!canEdit) return;
    setSavingGeneral(true);
    try {
      await patchCrmOrganization({
        name: companyName,
        description: companyDesc,
        contactEmail,
        contactPhone,
        address,
      });
      await refreshBundle();
      toast.success('Datos generales guardados');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSavingGeneral(false);
    }
  }

  async function saveLeadSources() {
    if (!canEdit) return;
    try {
      const b = await putCrmLeadSources(leadSources);
      setBundle(b);
      toast.success('Fuentes guardadas');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar fuentes');
    }
  }

  async function savePipeline() {
    if (!canEdit) return;
    try {
      const b = await putCrmStages(
        pipelineStages.map((s) => ({
          slug: s.slug,
          name: s.name,
          color: s.color,
          probability: s.probability,
          enabled: s.enabled,
          isSystem: s.isSystem,
        })),
      );
      setBundle(b);
      toast.success('Etapas guardadas');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar etapas');
    }
  }

  async function savePriorities() {
    if (!canEdit) return;
    try {
      const b = await putCrmPriorities(priorities);
      setBundle(b);
      toast.success('Prioridades guardadas');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar prioridades');
    }
  }

  async function saveActivityTypes() {
    if (!canEdit) return;
    try {
      const b = await putCrmActivityTypes(activityTypes);
      setBundle(b);
      toast.success('Tipos de actividad guardados');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    }
  }

  if (loadError && !bundle) {
    return (
      <div className="space-y-6">
        <PageHeader title="Configuración" description="Administra la configuración del CRM" />
        <Card>
          <CardContent className="py-8 text-center text-sm text-destructive">
            {loadError}
            <div className="mt-4">
              <Button variant="outline" onClick={() => void refreshBundle()}>
                Reintentar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuración"
        description="Administra la configuración del CRM"
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        <nav className="flex gap-1 overflow-x-auto pb-2 lg:w-56 lg:shrink-0 lg:flex-col lg:gap-0.5 lg:pb-0">
          {NAV_SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveTab(section.id)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm whitespace-nowrap transition-colors text-left',
                  activeTab === section.id
                    ? 'bg-[#13944C]/10 text-[#13944C] font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="size-4 shrink-0" />
                {section.label}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1">
          {activeTab === 'general' && (
            <Card>
              <CardHeader>
                <CardTitle>Información General</CardTitle>
                <CardDescription>Datos de la empresa y configuración básica</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="company-name">Nombre de la empresa</Label>
                    <Input
                      id="company-name"
                      disabled={!canEdit}
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="company-desc">Descripción</Label>
                    <Textarea
                      id="company-desc"
                      rows={3}
                      disabled={!canEdit}
                      value={companyDesc}
                      onChange={(e) => setCompanyDesc(e.target.value)}
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="contact-email" className="flex items-center gap-1.5">
                      <Mail className="size-3.5" /> Email de contacto
                    </Label>
                    <Input
                      id="contact-email"
                      disabled={!canEdit}
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-phone" className="flex items-center gap-1.5">
                      <Phone className="size-3.5" /> Teléfono
                    </Label>
                    <Input
                      id="contact-phone"
                      disabled={!canEdit}
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="address" className="flex items-center gap-1.5">
                      <MapPin className="size-3.5" /> Dirección
                    </Label>
                    <Input
                      id="address"
                      disabled={!canEdit}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>
                </div>

                {canEdit && (
                  <div className="flex justify-end">
                    <Button
                      className="bg-[#13944C] text-white hover:bg-[#0f7a3d]"
                      disabled={savingGeneral}
                      onClick={() => void saveGeneral()}
                    >
                      {savingGeneral ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                      Guardar Cambios
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'metas' && <GoalsSettingsCard />}

          {activeTab === 'integraciones' && (
            <Card>
              <CardHeader>
                <CardTitle>Integraciones activas</CardTitle>
                <CardDescription>
                  Vista del estado de las integraciones en el sistema. Para conectar tu cuenta, ve a Mi perfil → Integraciones.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex size-12 items-center justify-center rounded-lg bg-[#ea4335]/10">
                      <svg className="size-7" viewBox="0 0 24 24">
                        <path
                          fill="#EA4335"
                          d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L12 9.883l8.073-6.39C21.69 2.28 24 3.434 24 5.457z"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium">Gmail</p>
                      <p className="text-sm text-muted-foreground">
                        Sincronización de correos con el módulo de Correo del CRM
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {gmailConnected ? (
                      <span className="flex items-center gap-1.5 text-sm text-[#13944C] font-medium">
                        <CheckCircle2 className="size-4" />
                        Conectado
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        No conectado
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Cada usuario conecta su propia cuenta de Gmail desde Mi perfil → Integraciones.
                </p>
              </CardContent>
            </Card>
          )}

          {activeTab === 'fuentes' && (
            <Card>
              <CardHeader>
                <CardTitle>Fuentes de Contactos</CardTitle>
                <CardDescription>
                  Fuentes de captación (persistidas en base de datos).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Nueva fuente de contactos..."
                    value={newSourceName}
                    disabled={!canEdit}
                    onChange={(e) => setNewSourceName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addLeadSource()}
                  />
                  <Button
                    type="button"
                    onClick={addLeadSource}
                    disabled={!canEdit}
                    className="shrink-0 bg-[#13944C] text-white hover:bg-[#0f7a3d]"
                  >
                    <Plus className="size-4" />
                    Agregar
                  </Button>
                </div>

                <div className="space-y-2">
                  {leadSources.map((source) => (
                    <div
                      key={source.slug}
                      className="flex items-center justify-between rounded-lg border px-4 py-3"
                    >
                      <span
                        className={cn(
                          'text-sm font-medium',
                          !source.enabled && 'text-muted-foreground line-through',
                        )}
                      >
                        {source.name}
                      </span>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={source.enabled}
                          disabled={!canEdit}
                          onCheckedChange={() => toggleLeadSource(source.slug)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={!canEdit}
                          className="text-muted-foreground hover:text-red-600"
                          onClick={() => removeLeadSource(source.slug)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                {canEdit && (
                  <div className="flex justify-end">
                    <Button className="bg-[#13944C] text-white hover:bg-[#0f7a3d]" onClick={() => void saveLeadSources()}>
                      <Save className="size-4" />
                      Guardar fuentes
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'pipeline' && (
            <Card>
              <CardHeader>
                <CardTitle>Etapas</CardTitle>
                <CardDescription>
                  Una sola definición para contactos, empresas y oportunidades. El % indica probabilidad sugerida en oportunidades.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex justify-end">
                  <Button
                    type="button"
                    onClick={() => setAddStageOpen(true)}
                    disabled={!canEdit}
                    className="bg-[#13944C] text-white hover:bg-[#0f7a3d]"
                  >
                    <Plus className="size-4" />
                    Añadir etapa
                  </Button>
                </div>
                <div className="space-y-2">
                  {pipelineStages.map((stage, idx) => (
                    <div
                      key={stage.slug}
                      className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-3 sm:gap-3"
                    >
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0"
                          disabled={!canEdit || idx === 0}
                          onClick={() => movePipelineStage(idx, -1)}
                        >
                          <ChevronUp className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0"
                          disabled={!canEdit || idx === pipelineStages.length - 1}
                          onClick={() => movePipelineStage(idx, 1)}
                        >
                          <ChevronDown className="size-4" />
                        </Button>
                      </div>
                      <GripVertical className="size-4 shrink-0 text-muted-foreground" />
                      <div
                        className="size-3 shrink-0 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      <span
                        className={cn(
                          'min-w-0 flex-1 text-sm font-medium',
                          !stage.enabled && 'text-muted-foreground line-through',
                        )}
                      >
                        {stage.name}
                        {stage.isSystem && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">(sistema)</span>
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground whitespace-nowrap">%</Label>
                        <Input
                          type="number"
                          className="h-8 w-16"
                          disabled={!canEdit}
                          value={stage.probability}
                          onChange={(e) =>
                            setStageProbability(stage.slug, Number(e.target.value) || 0)}
                        />
                      </div>
                      <Switch
                        checked={stage.enabled}
                        disabled={!canEdit}
                        onCheckedChange={() => togglePipelineStage(stage.slug)}
                      />
                      {!stage.isSystem && canEdit && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-red-600"
                          onClick={() => removePipelineStage(stage.slug)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                {canEdit && (
                  <div className="mt-4 flex justify-end">
                    <Button className="bg-[#13944C] text-white hover:bg-[#0f7a3d]" onClick={() => void savePipeline()}>
                      <Save className="size-4" />
                      Guardar etapas
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Dialog open={addStageOpen} onOpenChange={setAddStageOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Añadir etapa</DialogTitle>
                <DialogDescription>
                  Nueva etapa personalizada (no sistema). Aparecerá en contactos, empresas y oportunidades.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="stage-name">Nombre de la etapa</Label>
                  <Input
                    id="stage-name"
                    placeholder="Ej: Cotización enviada"
                    value={newStageName}
                    onChange={(e) => setNewStageName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addPipelineStage()}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stage-color">Color</Label>
                  <div className="flex items-center gap-3">
                    <input
                      id="stage-color"
                      type="color"
                      value={newStageColor}
                      onChange={(e) => setNewStageColor(e.target.value)}
                      className="h-10 w-14 cursor-pointer rounded border border-input"
                    />
                    <Input
                      value={newStageColor}
                      onChange={(e) => setNewStageColor(e.target.value)}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddStageOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={addPipelineStage}
                  disabled={!newStageName.trim()}
                  className="bg-[#13944C] text-white hover:bg-[#0f7a3d]"
                >
                  <Plus className="size-4" />
                  Añadir
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {activeTab === 'prioridades' && (
            <Card>
              <CardHeader>
                <CardTitle>Niveles de Prioridad</CardTitle>
                <CardDescription>
                  Prioridades para oportunidades (y UI del CRM). Las tres base no se pueden eliminar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {priorities.map((priority) => (
                    <div
                      key={priority.slug}
                      className="rounded-lg border p-4"
                    >
                      <div className="flex flex-wrap items-start gap-4">
                        <div
                          className="size-4 shrink-0 rounded-full mt-1"
                          style={{ backgroundColor: priority.color }}
                        />
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold">{priority.name}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Activa</span>
                              <Switch
                                checked={priority.enabled}
                                disabled={!canEdit}
                                onCheckedChange={() => togglePriority(priority.slug)}
                              />
                            </div>
                          </div>
                          <Input
                            placeholder="Descripción"
                            disabled={!canEdit}
                            value={priority.description}
                            onChange={(e) => setPriorityDescription(priority.slug, e.target.value)}
                            className="text-sm"
                          />
                        </div>
                        <div
                          className="rounded-md px-3 py-1 text-xs font-medium"
                          style={{
                            backgroundColor: `${priority.color}15`,
                            color: priority.color,
                          }}
                        >
                          {priority.name}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {canEdit && (
                  <div className="flex justify-end">
                    <Button className="bg-[#13944C] text-white hover:bg-[#0f7a3d]" onClick={() => void savePriorities()}>
                      <Save className="size-4" />
                      Guardar prioridades
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'actividades' && (
            <Card>
              <CardHeader>
                <CardTitle>Tipos de Actividad</CardTitle>
                <CardDescription>
                  Tipos disponibles al registrar actividades (persistidos en BD).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {activityTypes.map((at) => {
                    const Icon = ACTIVITY_TYPE_ICONS[at.slug];
                    return (
                      <div
                        key={at.slug}
                        className="flex items-center gap-3 rounded-lg border px-4 py-3"
                      >
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                          {Icon && <Icon className="size-4" />}
                        </div>
                        <span
                          className={cn(
                            'flex-1 text-sm font-medium',
                            !at.enabled && 'text-muted-foreground line-through',
                          )}
                        >
                          {at.name}
                        </span>
                        <Switch
                          checked={at.enabled}
                          disabled={!canEdit}
                          onCheckedChange={() => toggleActivityType(at.slug)}
                        />
                      </div>
                    );
                  })}
                </div>
                {canEdit && (
                  <div className="flex justify-end">
                    <Button className="bg-[#13944C] text-white hover:bg-[#0f7a3d]" onClick={() => void saveActivityTypes()}>
                      <Save className="size-4" />
                      Guardar tipos
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'preferencias' && (
            <Card>
              <CardHeader>
                <CardTitle>Preferencias</CardTitle>
                <CardDescription>
                  Ajustes locales de interfaz (aún no sincronizados con el servidor).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold">Notificaciones</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                          <Mail className="size-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Notificaciones por email</p>
                          <p className="text-xs text-muted-foreground">
                            Recibir alertas y resúmenes por correo electrónico
                          </p>
                        </div>
                      </div>
                      <Switch checked={emailNotif} onCheckedChange={setEmailNotif} />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                          <Bell className="size-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Notificaciones push</p>
                          <p className="text-xs text-muted-foreground">
                            Recibir notificaciones en tiempo real en el navegador
                          </p>
                        </div>
                      </div>
                      <Switch checked={pushNotif} onCheckedChange={setPushNotif} />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="text-sm font-semibold">Apariencia</h4>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                        <Moon className="size-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Modo oscuro</p>
                        <p className="text-xs text-muted-foreground">
                          Cambiar el tema de la interfaz
                        </p>
                      </div>
                    </div>
                    <Switch checked={darkMode} onCheckedChange={setDarkMode} />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="text-sm font-semibold">Regional</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Idioma</Label>
                      <Select defaultValue="es">
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="es">Español</SelectItem>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="pt">Português</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Zona horaria</Label>
                      <Select defaultValue="america_lima">
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="america_lima">America/Lima (UTC-5)</SelectItem>
                          <SelectItem value="america_bogota">America/Bogota (UTC-5)</SelectItem>
                          <SelectItem value="america_mexico">America/Mexico City (UTC-6)</SelectItem>
                          <SelectItem value="america_santiago">America/Santiago (UTC-3)</SelectItem>
                          <SelectItem value="america_buenos_aires">America/Buenos Aires (UTC-3)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-end">
                  <Button type="button" className="bg-[#13944C] text-white hover:bg-[#0f7a3d]">
                    <Save className="size-4" />
                    Guardar Preferencias
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
