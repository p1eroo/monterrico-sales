import { useSearchParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import {
  Bot,
  MoreHorizontal,
  Copy,
  Pencil,
  Trash2,
  GitBranch,
  LayoutGrid,
  Sparkles,
  Eye,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAgentesIaStore } from './store';
import { apiRowToMockKnowledge, fetchKnowledgeBases } from './knowledgeApi';
import { toast } from 'sonner';
import { NewAgentDialog } from './flows/NewAgentDialog';
import { NewKnowledgeDialog } from './flows/NewKnowledgeDialog';
import { NewRuleDialog } from './flows/NewRuleDialog';
import { LogDetailSheet } from './flows/LogDetailSheet';
import type { MockLog } from './mockData';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useChartTheme } from '@/hooks/useChartTheme';
import { cn } from '@/lib/utils';

const TAB_KEYS = [
  'agentes',
  'conocimiento',
  'router',
  'contactos',
  'supervision',
  'entrenamiento',
  'logs',
  'reengagement',
  'stats',
  'config',
] as const;

type TabKey = (typeof TAB_KEYS)[number];

function isTabKey(s: string | null): s is TabKey {
  return s !== null && (TAB_KEYS as readonly string[]).includes(s);
}

export function AgentesIaModule() {
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab');
  const tab: TabKey = isTabKey(tabParam) ? tabParam : 'agentes';
  const navigate = useNavigate();

  const setTab = (v: string) => {
    const next = new URLSearchParams(params);
    next.set('tab', v);
    setParams(next, { replace: true });
  };

  const agents = useAgentesIaStore((s) => s.agents);
  const knowledge = useAgentesIaStore((s) => s.knowledge);
  const setKnowledge = useAgentesIaStore((s) => s.setKnowledge);
  const routerRules = useAgentesIaStore((s) => s.routerRules);
  const aiContacts = useAgentesIaStore((s) => s.aiContacts);
  const supervision = useAgentesIaStore((s) => s.supervision);
  const datasets = useAgentesIaStore((s) => s.datasets);
  const logs = useAgentesIaStore((s) => s.logs);
  const reengage = useAgentesIaStore((s) => s.reengage);
  const moduleConfig = useAgentesIaStore((s) => s.moduleConfig);
  const setModuleConfig = useAgentesIaStore((s) => s.setModuleConfig);
  const removeAgent = useAgentesIaStore((s) => s.removeAgent);
  const duplicateAgent = useAgentesIaStore((s) => s.duplicateAgent);
  const toggleAgentStatus = useAgentesIaStore((s) => s.toggleAgentStatus);

  const [newAgentOpen, setNewAgentOpen] = useState(false);
  const [newKbOpen, setNewKbOpen] = useState(false);
  const [knowledgeLoading, setKnowledgeLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchKnowledgeBases();
        if (!cancelled) {
          setKnowledge(list.map(apiRowToMockKnowledge));
        }
      } catch {
        if (!cancelled) {
          toast.error('No se pudo cargar el conocimiento', {
            description: 'Inicia sesión y comprueba que el backend esté en marcha.',
          });
        }
      } finally {
        if (!cancelled) setKnowledgeLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setKnowledge]);
  const [newRuleOpen, setNewRuleOpen] = useState(false);
  const [logDetail, setLogDetail] = useState<MockLog | null>(null);
  const [logSheetOpen, setLogSheetOpen] = useState(false);

  const [logType, setLogType] = useState<string>('all');
  const [logMode, setLogMode] = useState<string>('all');

  const chartTheme = useChartTheme();

  const filteredLogs = logs.filter((l) => {
    if (logType !== 'all' && l.type !== logType) return false;
    if (logMode !== 'all' && l.mode !== logMode) return false;
    return true;
  });

  const decisionsData = [
    { name: 'Lun', router: 120, inferencia: 240, tool: 90 },
    { name: 'Mar', router: 132, inferencia: 260, tool: 100 },
    { name: 'Mié', router: 101, inferencia: 220, tool: 85 },
    { name: 'Jue', router: 140, inferencia: 280, tool: 110 },
    { name: 'Vie', router: 118, inferencia: 250, tool: 95 },
  ];

  const perfData = [
    { t: '00:00', ms: 420 },
    { t: '04:00', ms: 380 },
    { t: '08:00', ms: 510 },
    { t: '12:00', ms: 640 },
    { t: '16:00', ms: 520 },
    { t: '20:00', ms: 450 },
  ];

  function openLog(l: MockLog) {
    setLogDetail(l);
    setLogSheetOpen(true);
  }

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6">
      <PageHeader
        title="Agentes IA"
        description="Orquestación, conocimiento, enrutamiento y supervisión de asistentes en un solo espacio operativo."
      >
        <Badge variant="outline" className="shrink-0 gap-1">
          <Sparkles className="size-3 text-[#13944C]" />
          v2 · Conocimiento en API
        </Badge>
      </PageHeader>

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <div className="relative -mx-1 overflow-x-auto pb-1">
          <TabsList
            variant="line"
            className="h-auto w-full min-w-max flex-wrap justify-start gap-0 rounded-none border-b border-border bg-transparent p-0"
          >
            {(
              [
                ['agentes', 'Agentes'],
                ['conocimiento', 'Conocimiento'],
                ['router', 'Router Rules'],
                ['contactos', 'Contactos'],
                ['supervision', 'Supervisión'],
                ['entrenamiento', 'Entrenamiento'],
                ['logs', 'Logs'],
                ['reengagement', 'Re-engagement'],
                ['stats', 'Stats'],
                ['config', 'Configuración'],
              ] as const
            ).map(([k, label]) => (
              <TabsTrigger
                key={k}
                value={k}
                className="shrink-0 rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 py-2 text-muted-foreground data-[state=active]:border-[#13944C] data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="agentes" className="mt-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Catálogo de agentes desplegables y versionados.
            </p>
            <Button
              className="bg-[#13944C] hover:bg-[#0f7a3d]"
              onClick={() => setNewAgentOpen(true)}
            >
              <Bot className="mr-2 size-4" />
              Nuevo Agente
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {agents.map((a) => (
              <Card
                key={a.id}
                className="border-border/80 transition-shadow hover:shadow-md"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base leading-tight">
                        {a.name}
                      </CardTitle>
                      <CardDescription className="mt-1 line-clamp-2">
                        {a.description}
                      </CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            navigate(`/agentes-ia/workflow/${a.id}`)
                          }
                        >
                          <LayoutGrid className="mr-2 size-4" />
                          Canvas
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            toast.info('Editor de agente', {
                              description:
                                'Flujo de edición completo en versión productiva.',
                            })
                          }
                        >
                          <Pencil className="mr-2 size-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => duplicateAgent(a.id)}>
                          <Copy className="mr-2 size-4" />
                          Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleAgentStatus(a.id)}>
                          Activar / Desactivar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            removeAgent(a.id);
                            toast.success('Agente eliminado (demo)');
                          }}
                        >
                          <Trash2 className="mr-2 size-4" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge
                      variant={a.status === 'activo' ? 'default' : 'secondary'}
                      className={cn(
                        a.status === 'activo' &&
                          'bg-[#13944C] hover:bg-[#0f7a3d]',
                      )}
                    >
                      {a.status}
                    </Badge>
                    <Badge variant="outline">{a.model}</Badge>
                    <Badge variant="outline">v{a.version}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {a.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-md bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => navigate(`/agentes-ia/workflow/${a.id}`)}
                  >
                    <GitBranch className="mr-2 size-3.5" />
                    Abrir canvas
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="conocimiento" className="mt-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Fuentes indexadas y sincronización con agentes.
            </p>
            <Button
              className="bg-[#13944C] hover:bg-[#0f7a3d]"
              onClick={() => setNewKbOpen(true)}
            >
              Nueva base de conocimiento
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Chunks</TableHead>
                  <TableHead>Agente</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {knowledgeLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      Cargando bases de conocimiento…
                    </TableCell>
                  </TableRow>
                ) : knowledge.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      No hay bases aún. Crea una con «Nueva base de conocimiento».
                    </TableCell>
                  </TableRow>
                ) : (
                  knowledge.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell className="font-medium">{k.title}</TableCell>
                      <TableCell>{k.type}</TableCell>
                      <TableCell className="text-right">{k.chunks}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {k.agentName}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                        {format(new Date(k.updatedAt), 'dd MMM yyyy', {
                          locale: es,
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{k.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="router" className="mt-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Políticas de enrutamiento y precedencia.
            </p>
            <Button
              className="bg-[#13944C] hover:bg-[#0f7a3d]"
              onClick={() => setNewRuleOpen(true)}
            >
              Nueva regla
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Condiciones</TableHead>
                  <TableHead className="text-right">Prioridad</TableHead>
                  <TableHead>Agente</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routerRules.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.title}</TableCell>
                    <TableCell className="max-w-[320px] truncate text-xs text-muted-foreground">
                      {r.conditions}
                    </TableCell>
                    <TableCell className="text-right">{r.priority}</TableCell>
                    <TableCell className="max-w-[180px] truncate">
                      {r.agentName}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="contactos" className="mt-0 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Contactos enlazados</CardTitle>
              <CardDescription>
                Conversaciones atendidas o co-atendidas por agentes.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ref. externa</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Agente asignado</TableHead>
                    <TableHead>Última interacción</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aiContacts.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">
                        {c.externalRef}
                      </TableCell>
                      <TableCell>{c.channel}</TableCell>
                      <TableCell className="max-w-[220px] truncate">
                        {c.agentName}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {format(new Date(c.lastInteraction), 'PPp', {
                          locale: es,
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{c.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="supervision" className="mt-0 space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            {(
              [
                ['revision', 'Respuestas a revisar'],
                ['baja_confianza', 'Baja confianza'],
                ['escalacion', 'Escalaciones'],
              ] as const
            ).map(([kind, title]) => (
              <Card key={kind}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {supervision
                    .filter((s) => s.kind === kind)
                    .map((s) => (
                      <div
                        key={s.id}
                        className="rounded-lg border border-border bg-muted/30 p-3 text-sm"
                      >
                        <p className="font-medium leading-snug">{s.summary}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {s.agentName}
                        </p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <Badge variant="outline" className="text-[10px]">
                            conf. {(s.confidence * 100).toFixed(0)}%
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() =>
                              toast.message('Cola de revisión', {
                                description:
                                  'Asignado a supervisor en turno (demo).',
                              })
                            }
                          >
                            Revisar
                          </Button>
                        </div>
                      </div>
                    ))}
                  {supervision.filter((s) => s.kind === kind).length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Sin elementos en esta categoría.
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="entrenamiento" className="mt-0 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Datasets y ejemplos</CardTitle>
              <CardDescription>
                Lotes para evaluación, few-shot y afinación supervisada.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="text-right">Ejemplos</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Actualizado</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datasets.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-right">{d.examples}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{d.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(d.updatedAt), 'dd/MM/yyyy', {
                          locale: es,
                        })}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-8 text-xs">
                          <Eye className="mr-1 size-3.5" />
                          Abrir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-0 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-2">
              <Label className="text-xs">Tipo</Label>
              <Select value={logType} onValueChange={setLogType}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="inferencia">Inferencia</SelectItem>
                  <SelectItem value="router">Router</SelectItem>
                  <SelectItem value="tool">Tool</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label className="text-xs">Modo</Label>
              <Select value={logMode} onValueChange={setLogMode}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Modo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="prod">Producción</SelectItem>
                  <SelectItem value="simulacion">Simulación</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Conversación</TableHead>
                  <TableHead>Agente</TableHead>
                  <TableHead>Decisión</TableHead>
                  <TableHead className="text-right">Conf.</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Latencia</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {format(new Date(l.at), 'dd/MM HH:mm', { locale: es })}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {l.conversationId}
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate text-xs">
                      {l.agentName}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-xs">
                      {l.decision}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {(l.confidence * 100).toFixed(0)}%
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {l.tokens}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {l.latencyMs} ms
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => openLog(l)}
                      >
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="reengagement" className="mt-0 space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {reengage.map((r) => (
              <Card key={r.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-tight">
                      {r.name}
                    </CardTitle>
                    <Badge variant="outline">{r.status}</Badge>
                  </div>
                  <CardDescription>{r.channel}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Disparador
                    </p>
                    <p className="mt-0.5 leading-snug">{r.trigger}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1"
                      onClick={() =>
                        toast.message('Automatización', {
                          description:
                            'Editor de secuencias y delays (demo no persistente).',
                        })
                      }
                    >
                      Automatización
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() =>
                        toast.message('Estados', {
                          description:
                            'Diagrama de estados de la campaña de re-engagement.',
                        })
                      }
                    >
                      Estados
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="stats" className="mt-0 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ['Conversaciones', '12.4k', '+8.2% vs 7d'],
                ['Tokens (M)', '3.1', '+1.1%'],
                ['Costo (USD)', '842', 'presupuesto OK'],
                ['Latencia p95', '620 ms', '-12 ms'],
              ] as const
            ).map(([k, v, sub]) => (
              <Card key={k}>
                <CardHeader className="pb-1">
                  <CardDescription>{k}</CardDescription>
                  <CardTitle className="text-2xl font-bold tracking-tight">
                    {v}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Decisiones por tipo</CardTitle>
                <CardDescription>Volumen agregado por categoría</CardDescription>
              </CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={decisionsData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={chartTheme.gridStroke}
                    />
                    <XAxis dataKey="name" tick={{ fill: chartTheme.axisColor, fontSize: 11 }} />
                    <YAxis tick={{ fill: chartTheme.axisColor, fontSize: 11 }} />
                    <RTooltip
                      contentStyle={{
                        backgroundColor: chartTheme.tooltipBg,
                        border: `1px solid ${chartTheme.tooltipBorder}`,
                        borderRadius: 8,
                      }}
                    />
                    <Bar dataKey="router" name="Router" fill="#64748b" radius={4} />
                    <Bar dataKey="inferencia" name="Inferencia" fill="#13944C" radius={4} />
                    <Bar dataKey="tool" name="Tool" fill="#3b82f6" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Rendimiento (latencia)</CardTitle>
                <CardDescription>Promedio móvil simulado</CardDescription>
              </CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={perfData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={chartTheme.gridStroke}
                    />
                    <XAxis dataKey="t" tick={{ fill: chartTheme.axisColor, fontSize: 11 }} />
                    <YAxis tick={{ fill: chartTheme.axisColor, fontSize: 11 }} />
                    <RTooltip
                      contentStyle={{
                        backgroundColor: chartTheme.tooltipBg,
                        border: `1px solid ${chartTheme.tooltipBorder}`,
                        borderRadius: 8,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="ms"
                      name="ms"
                      stroke="#13944C"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="config" className="mt-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Comportamiento del módulo</CardTitle>
              <CardDescription>
                Valores por defecto para nuevos agentes y políticas globales
                (solo demo local).
              </CardDescription>
            </CardHeader>
            <CardContent className="grid max-w-xl gap-4">
              <div className="grid gap-2">
                <Label>Modelo por defecto</Label>
                <Input
                  value={moduleConfig.defaultModel}
                  onChange={(e) =>
                    setModuleConfig({ defaultModel: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Temperatura global</Label>
                <Input
                  type="number"
                  step="0.05"
                  value={moduleConfig.globalTemperature}
                  onChange={(e) =>
                    setModuleConfig({
                      globalTemperature: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Máximo de tokens por defecto</Label>
                <Input
                  type="number"
                  value={moduleConfig.maxTokensDefault}
                  onChange={(e) =>
                    setModuleConfig({
                      maxTokensDefault: parseInt(e.target.value, 10) || 0,
                    })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Retención de auditoría (días)</Label>
                <Input
                  type="number"
                  value={moduleConfig.auditRetentionDays}
                  onChange={(e) =>
                    setModuleConfig({
                      auditRetentionDays: parseInt(e.target.value, 10) || 0,
                    })
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Modo simulación global</p>
                  <p className="text-xs text-muted-foreground">
                    Enruta tráfico de prueba sin efectos en CRM.
                  </p>
                </div>
                <Switch
                  checked={moduleConfig.simulationMode}
                  onCheckedChange={(c) =>
                    setModuleConfig({ simulationMode: c })
                  }
                />
              </div>
              <Button
                className="w-fit bg-[#13944C] hover:bg-[#0f7a3d]"
                onClick={() =>
                  toast.success('Preferencias del módulo guardadas (demo)')
                }
              >
                Guardar configuración
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <NewAgentDialog open={newAgentOpen} onOpenChange={setNewAgentOpen} />
      <NewKnowledgeDialog open={newKbOpen} onOpenChange={setNewKbOpen} />
      <NewRuleDialog open={newRuleOpen} onOpenChange={setNewRuleOpen} />
      <LogDetailSheet
        log={logDetail}
        open={logSheetOpen}
        onOpenChange={setLogSheetOpen}
      />
    </div>
  );
}
