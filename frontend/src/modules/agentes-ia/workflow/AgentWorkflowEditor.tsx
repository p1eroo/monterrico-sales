import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import '@xyflow/react/dist/style.css';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Connection,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import {
  ArrowLeft,
  Play,
  Plus,
  Save,
  Maximize2,
  LayoutGrid,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAgentesIaStore } from '../store';
import { buildInitialFlow, emptyToolNode } from './buildInitialFlow';
import { FlowCanvasNode } from './FlowCanvasNode';
import { WorkflowInspectorPanel } from './WorkflowInspectorPanel';
import { WorkflowLabeledEdge } from './WorkflowLabeledEdge';
import { AddToolSidePanel } from './AddToolSidePanel';
import type { FlowNodeType, FlowNodeData } from './flowTypes';
import type { ToolChoice } from '../flows/AddToolDialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { MockAgent } from '../mockData';

const LIVE_SESSIONS = 2;

function statusBadgeVariant(
  status: MockAgent['status'] | undefined,
): 'default' | 'secondary' | 'outline' {
  if (status === 'activo') return 'default';
  if (status === 'borrador') return 'secondary';
  return 'outline';
}

function WorkflowCanvasInner({
  agentLabel,
  agentRecord,
}: {
  agentLabel: string;
  agentRecord: MockAgent | undefined;
}) {
  const navigate = useNavigate();
  const { screenToFlowPosition, fitView, setNodes: rfSetNodes } = useReactFlow();
  const initial = useMemo(
    () => buildInitialFlow(agentLabel),
    [agentLabel],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const [selected, setSelected] = useState<FlowNodeType | null>(null);
  const [toolPanelOpen, setToolPanelOpen] = useState(false);

  const nodeTypes = useMemo(
    () => ({
      orchestrationNode: FlowCanvasNode,
    }),
    [],
  );

  const edgeTypes = useMemo(
    () => ({
      workflowEdge: WorkflowLabeledEdge,
    }),
    [],
  );

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: 'workflowEdge',
            animated: true,
            data: { accent: 'var(--muted-foreground)' },
          },
          eds,
        ),
      ),
    [setEdges],
  );

  const onSelectionChange = useCallback((p: OnSelectionChangeParams) => {
    const n = p.nodes[0] as FlowNodeType | undefined;
    if (n) setToolPanelOpen(false);
    setSelected(n ?? null);
  }, []);

  const clearInspector = useCallback(() => {
    setSelected(null);
    rfSetNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
  }, [rfSetNodes]);

  const onPatchNode = useCallback(
    (nodeId: string, data: FlowNodeData) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...data } } : (n as FlowNodeType),
        ),
      );
      toast.success('Configuración guardada en el lienzo (demo)');
    },
    [setNodes],
  );

  const minimapNodeColor = useCallback((n: { data?: unknown }) => {
    const k = (n.data as FlowNodeData | undefined)?.kind;
    const map: Record<string, string> = {
      llm: '#8b5cf6',
      memory: '#34d399',
      agent: '#fb923c',
      knowledge: '#f97316',
      database: '#c084fc',
      api: '#22d3ee',
      static: '#2dd4bf',
    };
    return k ? map[k] ?? '#64748b' : '#64748b';
  }, []);

  const appendTool = useCallback(
    (c: ToolChoice) => {
      const id = `n-${crypto.randomUUID().slice(0, 8)}`;
      const pos = screenToFlowPosition({
        x: window.innerWidth * 0.38,
        y: 240,
      });
      setNodes((nds) => [...nds, emptyToolNode(id, c, pos)]);
      toast.success('Herramienta colocada en el lienzo');
    },
    [screenToFlowPosition, setNodes],
  );

  const autoLayout = useCallback(() => {
    const order: FlowNodeData['kind'][] = [
      'llm',
      'memory',
      'agent',
      'knowledge',
      'database',
      'api',
      'static',
    ];
    setNodes((nds) => {
      const sorted = [...nds].sort(
        (a, b) =>
          order.indexOf(a.data.kind) - order.indexOf(b.data.kind),
      );
      return sorted.map((n, i) => ({
        ...n,
        position: {
          x: 48 + (i % 3) * 340,
          y: 48 + Math.floor(i / 3) * 220,
        },
      }));
    });
    setTimeout(() => fitView({ padding: 0.2 }), 50);
    toast.message('Orden aplicado', {
      description: 'Disposición en cuadrícula sugerida.',
    });
  }, [setNodes, fitView]);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
      <header className="sticky top-0 z-20 flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-card/90 px-4 py-2.5 backdrop-blur-md">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          onClick={() => navigate('/agentes-ia?tab=agentes')}
        >
          <ArrowLeft className="size-4" />
          Volver
        </Button>
        <div className="hidden h-6 w-px bg-border sm:block" />

        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {agentLabel}
            </p>
            <p className="text-[10px] text-muted-foreground">
              Builder de orquestación
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-success/35 bg-success/10 px-2.5 py-1">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-55" />
                <span className="relative inline-flex size-2 rounded-full bg-success shadow-[0_0_6px_var(--success)]" />
              </span>
              <span className="text-[11px] font-semibold tracking-tight text-success">
                {LIVE_SESSIONS} en vivo
              </span>
            </div>
            <Badge
              variant={statusBadgeVariant(agentRecord?.status)}
              className={cn(
                'border-border capitalize',
                agentRecord?.status === 'activo' &&
                  'border-success/40 bg-success/15 text-success',
              )}
            >
              {agentRecord?.status ?? 'borrador'}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-border bg-muted/50 text-foreground hover:bg-accent"
            onClick={() =>
              toast.message('Simulación', {
                description:
                  'Ejecución sandbox: sin efectos en CRM ni en contactos reales.',
              })
            }
          >
            <Play className="mr-1.5 size-3.5" />
            Simular
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-primary font-semibold text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary/90"
            onClick={() =>
              toast.success('Flujo publicado (demo)', {
                description: 'Snapshot versionado en almacén local.',
              })
            }
          >
            <Save className="mr-1.5 size-3.5" />
            Guardar
          </Button>
        </div>
      </header>

      <div className="relative flex min-h-0 min-w-0 flex-1">
        <div className="relative min-h-0 min-w-0 flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onSelectionChange={onSelectionChange}
            fitView
            className="!bg-muted/35 dark:!bg-card/50"
            proOptions={{ hideAttribution: true }}
            deleteKeyCode={['Backspace', 'Delete']}
            defaultEdgeOptions={{
              type: 'workflowEdge',
            }}
          >
            <Background
              gap={22}
              size={1}
              color="var(--workflow-grid-dot)"
            />
            <Controls
              className="!border-border !bg-card/95 !shadow-lg [&_button]:!border-border [&_button]:!bg-muted [&_button]:!fill-muted-foreground [&_button:hover]:!bg-accent"
              showInteractive={false}
            />
            <MiniMap
              className="!border-border !bg-card/90"
              nodeStrokeWidth={2}
              nodeColor={minimapNodeColor}
              maskColor="var(--workflow-minimap-mask)"
              pannable
              zoomable
            />
          </ReactFlow>

          <div className="pointer-events-none absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 gap-2">
            <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-border bg-card/95 px-1.5 py-1.5 shadow-xl backdrop-blur-md">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 gap-1.5 text-foreground hover:bg-accent"
                onClick={() => fitView({ padding: 0.22 })}
              >
                <Maximize2 className="size-3.5" />
                Centrar
              </Button>
              <div className="mx-0.5 w-px self-stretch bg-border" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 gap-1.5 text-foreground hover:bg-accent"
                onClick={autoLayout}
              >
                <LayoutGrid className="size-3.5" />
                Ordenar
              </Button>
              <div className="mx-0.5 w-px self-stretch bg-border" />
              <Button
                type="button"
                size="sm"
                className="h-9 gap-1.5 bg-info px-3 font-semibold text-info-foreground hover:bg-info/90"
                onClick={() => {
                  clearInspector();
                  setToolPanelOpen(true);
                }}
              >
                <Plus className="size-3.5" />
                Agregar herramienta
              </Button>
            </div>
          </div>
        </div>

        {toolPanelOpen ? (
          <AddToolSidePanel
            open={toolPanelOpen}
            onOpenChange={(v) => {
              setToolPanelOpen(v);
              if (!v) clearInspector();
            }}
            onConfirm={(c) => appendTool(c)}
          />
        ) : selected ? (
          <WorkflowInspectorPanel
            node={selected}
            onSave={onPatchNode}
            onClose={clearInspector}
            className="max-lg:fixed max-lg:inset-0 max-lg:z-30"
          />
        ) : null}
      </div>
    </div>
  );
}

export function AgentWorkflowEditor() {
  const { agentId } = useParams<{ agentId: string }>();
  const agent = useAgentesIaStore((s) =>
    s.agents.find((a) => a.id === agentId),
  );
  const label = agent?.name ?? 'Agente sin título';

  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner agentLabel={label} agentRecord={agent} />
    </ReactFlowProvider>
  );
}
