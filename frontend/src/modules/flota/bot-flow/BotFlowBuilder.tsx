import { useCallback, useMemo, useState, useRef, useEffect } from 'react';
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
  BaseEdge,
  getSmoothStepPath,
  type Connection,
  type OnSelectionChangeParams,
  type Node,
  type Edge,
  type EdgeProps,
} from '@xyflow/react';
import {
  Save,
  Play,
  Maximize2,
  LayoutGrid,
  CheckCircle2,
  Copy,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Search,
  X,
  CornerUpLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { BotNodeRenderer } from './BotNodeRenderer';
import FlowToolbar from './FlowToolbar';
import NodeConfigPanel from './NodeConfigPanel';
import FlowValidator, { validateFlow } from './FlowValidator';
import BotTestSimulator from './BotTestSimulator';
import { createMockFlow } from './mockData';
import {
  NODE_COLORS,
  NODE_LABELS,
  NODE_DESCRIPTIONS,
  BOT_NODE_TYPES,
  getDefaultConfig,
  type BotFlowNodeType,
  type BotFlowNodeData,
  type BotFlowEdgeData,
  type BotNodeType,
  type BotNodeConfig,
  type SerializedBotNode,
  type SerializedBotEdge,
} from './types';

function flowToSerialized(
  ns: Node<BotFlowNodeData>[],
  es: Edge[],
): { nodes: SerializedBotNode[]; edges: SerializedBotEdge[] } {
  return {
    nodes: ns.map((n) => ({
      id: n.id,
      type: n.data.nodeType,
      position_x: Math.round(n.position.x),
      position_y: Math.round(n.position.y),
      config: n.data.config as Record<string, unknown>,
      enabled: n.data.enabled,
    })),
    edges: es.map((e) => ({
      id: e.id,
      source_node_id: e.source,
      target_node_id: e.target,
      condition_type: ((e.data as BotFlowEdgeData)?.condition_type) ?? 'always',
      condition_config: ((e.data as BotFlowEdgeData)?.condition_config) ?? {},
    })),
  };
}

function BotEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected }: EdgeProps) {
  const edgeData = data as BotFlowEdgeData | undefined;
  const isConditional = edgeData?.condition_type === 'conditional';
  const label = edgeData?.label;
  const isAffirmative = label?.toLowerCase() === 'sí' || label?.toLowerCase() === 'si' || label?.toLowerCase() === 'yes' || label?.toLowerCase() === 'true';
  const accent = isConditional
    ? (isAffirmative ? '#10b981' : '#8b5cf6')
    : '#94a3b8';

  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  return (
    <BaseEdge
      id={id}
      path={path}
      labelX={labelX}
      labelY={labelY}
      label={label}
      style={{
        stroke: selected ? accent : `${accent}60`,
        strokeWidth: selected ? 2.5 : 1.75,
        strokeDasharray: isConditional ? (isAffirmative ? undefined : '6,4') : undefined,
        strokeLinecap: 'round',
      }}
      labelStyle={{
        fill: accent,
        fontWeight: 600,
        fontSize: 10,
      }}
      labelShowBg
      labelBgStyle={{
        fill: 'var(--card)',
        stroke: `${accent}40`,
        strokeWidth: 1,
      }}
      labelBgPadding={[6, 3]}
      labelBgBorderRadius={10}
      interactionWidth={16}
    />
  );
}

const edgeTypes = { botEdge: BotEdge };

interface FlowCanvasInnerProps {
  botName?: string;
  initialNodes?: { id: string; type: 'botNode'; position: { x: number; y: number }; data: BotFlowNodeData }[];
  initialEdges?: { id: string; source: string; target: string; type: 'botEdge'; data: BotFlowEdgeData }[];
  onBack?: () => void;
}

function FlowCanvasInner({ botName, initialNodes, initialEdges, onBack }: FlowCanvasInnerProps) {
  const rf = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<BotFlowNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<BotFlowNodeType | null>(null);
  const [configPanelNode, setConfigPanelNode] = useState<BotFlowNodeType | null>(null);
  const [validatorOpen, setValidatorOpen] = useState(false);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [nodePickerOpen, setNodePickerOpen] = useState(false);
  const [nodePickerSearch, setNodePickerSearch] = useState('');
  const initialized = useRef<string | null>(null);

  const mockData = useMemo(() => {
    if (initialNodes && initialEdges) return { nodes: initialNodes, edges: initialEdges, id: 'custom' };
    return { ...createMockFlow(), id: 'mock' };
  }, [initialNodes, initialEdges]);

  useEffect(() => {
    const key = `${mockData.nodes.length}-${mockData.edges.length}`;
    if (initialized.current === key) return;
    initialized.current = key;
    const flowNodes = mockData.nodes.map((n) => ({
      id: n.id,
      type: 'botNode' as const,
      position: n.position,
      data: n.data,
    }));
    const flowEdges = mockData.edges.map((e: any) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'botEdge' as const,
      data: {
        condition_type: e.condition_type ?? e.data?.condition_type ?? 'always',
        condition_config: e.condition_config ?? e.data?.condition_config ?? {},
        label: e.label ?? e.data?.label,
      } as BotFlowEdgeData,
    }));
    setNodes(flowNodes);
    setEdges(flowEdges);
    setTimeout(() => rf.fitView({ padding: 0.22 }), 100);
  }, [mockData, setNodes, setEdges, rf]);

  const nodeTypes = useMemo(() => ({ botNode: BotNodeRenderer }), []);

  const onConnect = useCallback(
    (params: Connection) => {
      const edgeData: BotFlowEdgeData = { condition_type: 'always', condition_config: {} };
      const sourceNode = nodes.find((n) => n.id === params.source);
      if (sourceNode?.data.nodeType === 'condition' && params.sourceHandle) {
        const config = sourceNode.data.config as { rules?: { id: string; output_label?: string }[] };
        const idx = parseInt(params.sourceHandle.replace('out-', ''), 10);
        const rule = config.rules?.[idx];
        if (rule) {
          edgeData.condition_type = 'conditional';
          edgeData.condition_config = { rule_id: rule.id };
          edgeData.label = rule.output_label || `Regla ${idx + 1}`;
        }
      }
      setEdges((eds) =>
        addEdge(
          { ...params, type: 'botEdge', data: edgeData },
          eds,
        ),
      );
    },
    [setEdges, nodes],
  );

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    const n = params.nodes[0] as BotFlowNodeType | undefined;
    setSelectedNode(n ?? null);
  }, []);

  const onNodeDoubleClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setConfigPanelNode(node as BotFlowNodeType);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedNode(null);
    setConfigPanelNode(null);
  }, []);

  const handleSaveNode = useCallback(
    (nodeId: string, config: BotNodeConfig, label: string) => {
      setNodes((nds) =>
        nds.map((n: any) =>
          n.id === nodeId ? { ...n, data: { ...n.data, config, label } } : n,
        ),
      );
      toast.success('Configuración guardada');
    },
    [setNodes],
  );

  const handleSave = useCallback(() => {
    const errs = validateFlow(nodes, edges);
    if (errs.some((e) => e.type === 'error')) {
      toast.error('Corregí los errores antes de guardar');
      setValidatorOpen(true);
      return;
    }
    console.log('Saving flow (mock):', JSON.stringify(flowToSerialized(nodes, edges), null, 2));
    toast.success('Flujo guardado (mock)');
  }, [nodes, edges]);

  const handleAddNode = useCallback(
    (type: BotNodeType) => {
      const id = `n-${crypto.randomUUID().slice(0, 8)}`;
      const center = rf.screenToFlowPosition({
        x: window.innerWidth * 0.35,
        y: window.innerHeight * 0.35,
      });
      setNodes((nds: Node<BotFlowNodeData>[]) => [
        ...nds,
        {
          id,
          type: 'botNode',
          position: center,
          data: {
            nodeType: type,
            config: getDefaultConfig(type),
            label: NODE_LABELS[type],
            enabled: true,
          },
        },
      ]);
      toast.success(`${NODE_LABELS[type]} agregado`);
    },
    [rf, setNodes],
  );

  const handleDuplicateNode = useCallback(() => {
    if (!selectedNode) return;
    const id = `n-${crypto.randomUUID().slice(0, 8)}`;
    setNodes((nds: Node<BotFlowNodeData>[]) => [
      ...nds,
      {
        id,
        type: 'botNode',
        position: { x: selectedNode.position.x + 50, y: selectedNode.position.y + 50 },
        data: JSON.parse(JSON.stringify(selectedNode.data)),
      },
    ]);
    toast.success('Nodo duplicado');
  }, [selectedNode, setNodes]);

  const handleDeleteNode = useCallback(() => {
    if (!selectedNode) return;
    setNodes((nds: Node<BotFlowNodeData>[]) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds: Edge[]) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
    if (configPanelNode?.id === selectedNode.id) setConfigPanelNode(null);
    setSelectedNode(null);
    toast.success('Nodo eliminado');
  }, [selectedNode, configPanelNode, setNodes, setEdges]);

  const handleToggleNode = useCallback(() => {
    if (!selectedNode) return;
    setNodes((nds: Node<BotFlowNodeData>[]) =>
      nds.map((n) =>
        n.id === selectedNode.id ? { ...n, data: { ...n.data, enabled: !n.data.enabled } } : n,
      ),
    );
    toast.success(selectedNode.data.enabled ? 'Nodo desactivado' : 'Nodo activado');
  }, [selectedNode, setNodes]);

  const autoLayout = useCallback(() => {
    const order: BotNodeType[] = ['start', 'message', 'question', 'condition', 'ai_extract', 'crm_action', 'human_handoff', 'end'];
    setNodes((nds: Node<BotFlowNodeData>[]) => {
      const sorted = [...nds].sort(
        (a, b) => order.indexOf(a.data.nodeType) - order.indexOf(b.data.nodeType),
      );
      return sorted.map((n, i) => ({
        ...n,
        position: { x: 48 + (i % 3) * 340, y: 48 + Math.floor(i / 3) * 220 },
      }));
    });
    setTimeout(() => rf.fitView({ padding: 0.2 }), 50);
    toast.success('Disposición organizada');
  }, [setNodes, rf]);

  const minimapNodeColor = useCallback((node: { data?: unknown }) => {
    const d = node.data as BotFlowNodeData | undefined;
    return d ? NODE_COLORS[d.nodeType] : '#64748b';
  }, []);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-card">
      <div className="flex flex-wrap items-center gap-3 bg-card/90 px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          {onBack && (
            <button onClick={onBack} className="inline-flex items-center rounded-md border border-primary p-1.5 text-primary hover:bg-primary/10">
              <CornerUpLeft className="size-4" />
            </button>
          )}
        </div>
        <div className="flex-1" />
        <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => setValidatorOpen(true)}>
          <CheckCircle2 className="size-3.5" /> Validar
        </Button>
        <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => setSimulatorOpen(true)}>
          <Play className="size-3.5" /> Simular
        </Button>
        <Button size="sm" className="h-8 gap-1 text-xs" onClick={handleSave}>
          <Save className="size-3.5" /> Guardar
        </Button>
      </div>

      <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
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
            onNodeDoubleClick={onNodeDoubleClick}
            fitView
            className="!bg-muted/25"
            proOptions={{ hideAttribution: true }}
            deleteKeyCode={['Backspace', 'Delete']}
            defaultEdgeOptions={{ type: 'botEdge' }}
            panOnDrag={[1]}
            selectionOnDrag
          >
            <Background gap={22} size={1.5} color="var(--workflow-grid-dot, #94a3b8)" />
            <Controls
              className="!border-border !bg-card/95 !shadow-lg [&_button]:!border-border [&_button]:!bg-muted"
              showInteractive={false}
            />
            <MiniMap
              className="!border-border !bg-card/90"
              nodeStrokeWidth={2}
              nodeColor={minimapNodeColor}
              maskColor="var(--workflow-minimap-mask, rgba(0,0,0,0.1))"
              pannable
              zoomable
            />
          </ReactFlow>

          <div className="pointer-events-none absolute top-4 left-4 z-10">
            <div className="pointer-events-auto">
              <FlowToolbar onClick={() => setNodePickerOpen(true)} />
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
            <div className="pointer-events-auto flex items-center gap-1 rounded-xl border bg-card/95 px-2 py-1.5 shadow-xl backdrop-blur-md">
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => rf.fitView({ padding: 0.22 })}>
                <Maximize2 className="size-3.5" /> Centrar
              </Button>
              <div className="mx-0.5 w-px self-stretch bg-border" />
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={autoLayout}>
                <LayoutGrid className="size-3.5" /> Ordenar
              </Button>
              {selectedNode && (
                <>
                  <div className="mx-0.5 w-px self-stretch bg-border" />
                  <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={handleDuplicateNode}>
                    <Copy className="size-3.5" /> Duplicar
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={handleToggleNode}>
                    {selectedNode.data.enabled ? <ToggleRight className="size-3.5" /> : <ToggleLeft className="size-3.5" />}
                    {selectedNode.data.enabled ? 'Desactivar' : 'Activar'}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs text-destructive hover:text-destructive" onClick={handleDeleteNode}>
                    <Trash2 className="size-3.5" /> Eliminar
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {nodePickerOpen && (
        <div
          className={cn(
            'absolute left-3 top-20 z-50 flex w-[340px] max-h-[calc(100vh-14rem)] flex-col border bg-card shadow-2xl rounded-xl animate-in slide-in-from-left-4 duration-200',
          )}
        >
          <div className="flex items-center justify-between border-b border-muted px-4 py-3">
            <h3 className="text-base font-semibold">Agregar nodo</h3>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => { setNodePickerOpen(false); setNodePickerSearch(''); }}>
              <X className="size-4" />
            </Button>
          </div>

          <div className="px-3 py-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={nodePickerSearch}
                onChange={(e) => setNodePickerSearch(e.target.value)}
                placeholder="Buscar nodo..."
                className="h-8 pl-8 text-sm"
                autoFocus
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
            {(nodePickerSearch.trim()
              ? BOT_NODE_TYPES.filter((t) =>
                  NODE_LABELS[t].toLowerCase().includes(nodePickerSearch.toLowerCase()) ||
                  NODE_DESCRIPTIONS[t].toLowerCase().includes(nodePickerSearch.toLowerCase()),
                )
              : BOT_NODE_TYPES
            ).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  handleAddNode(type);
                  setNodePickerOpen(false);
                  setNodePickerSearch('');
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2.5 text-left transition-colors hover:bg-accent"
              >
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${NODE_COLORS[type]}18`, color: NODE_COLORS[type] }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {type === 'start' && <polygon points="5 3 19 12 5 21 5 3"/>}
                    {type === 'message' && <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>}
                    {type === 'question' && <><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></>}
                    {type === 'condition' && <><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></>}
                    {type === 'ai_extract' && <><path d="M12 2a8 8 0 0 0-8 8c0 2.5 1.5 4.8 3 6.5V20a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3.5c1.5-1.7 3-4 3-6.5a8 8 0 0 0-8-8z"/><circle cx="12" cy="11" r="3"/></>}
                    {type === 'crm_action' && <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>}
                    {type === 'human_handoff' && <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/></>}
                    {type === 'end' && <><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></>}
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{NODE_LABELS[type]}</p>
                  <p className="truncate text-xs text-muted-foreground">{NODE_DESCRIPTIONS[type]}</p>
                </div>
              </button>
            ))}
            {nodePickerSearch.trim() && BOT_NODE_TYPES.filter((t) =>
              NODE_LABELS[t].toLowerCase().includes(nodePickerSearch.toLowerCase()) ||
              NODE_DESCRIPTIONS[t].toLowerCase().includes(nodePickerSearch.toLowerCase()),
            ).length === 0 && (
              <p className="py-6 text-center text-[11px] text-muted-foreground">Sin resultados</p>
            )}
          </div>
        </div>
        )}

        {configPanelNode && (
          <NodeConfigPanel
            node={configPanelNode}
            onSave={handleSaveNode}
            onClose={clearSelection}
            className="max-lg:fixed max-lg:inset-0 max-lg:z-30"
          />
        )}
      </div>

      <FlowValidator nodes={nodes} edges={edges} open={validatorOpen} onOpenChange={setValidatorOpen} />
      <BotTestSimulator nodes={nodes} edges={edges} open={simulatorOpen} onOpenChange={setSimulatorOpen} />
    </div>
  );
}

export default function BotFlowBuilder({ botAgent, onBack }: { botAgent?: { id: string; name: string; flow: { nodes: any[]; edges: any[] } }; onBack?: () => void }) {
  const nodes = botAgent?.flow.nodes.map((n) => ({
    id: n.id,
    type: 'botNode' as const,
    position: n.position,
    data: n.data,
  }));
  const edges = botAgent?.flow.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: 'botEdge' as const,
    data: {
      condition_type: e.condition_type ?? 'always',
      condition_config: e.condition_config ?? {},
      label: e.label,
    } as BotFlowEdgeData,
  }));

  return (
    <ReactFlowProvider>
      <FlowCanvasInner key={botAgent?.id || 'default'} botName={botAgent?.name} initialNodes={nodes} initialEdges={edges} onBack={onBack} />
    </ReactFlowProvider>
  );
}
