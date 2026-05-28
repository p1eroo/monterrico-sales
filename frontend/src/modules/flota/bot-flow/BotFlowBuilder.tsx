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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { BotNodeRenderer } from './BotNodeRenderer';
import FlowToolbar from './FlowToolbar';
import NodeConfigPanel from './NodeConfigPanel';
import FlowValidator, { validateFlow } from './FlowValidator';
import BotTestSimulator from './BotTestSimulator';
import { createMockFlow } from './mockData';
import {
  NODE_COLORS,
  NODE_LABELS,
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
  const accent = isConditional ? '#8b5cf6' : '#94a3b8';

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
        strokeDasharray: isConditional ? '6,4' : undefined,
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

function FlowCanvasInner() {
  const rf = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<BotFlowNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<BotFlowNodeType | null>(null);
  const [validatorOpen, setValidatorOpen] = useState(false);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const initialized = useRef(false);

  const mockData = useMemo(() => createMockFlow(), []);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const flowNodes = mockData.nodes.map((n) => ({
      id: n.id,
      type: 'botNode' as const,
      position: n.position,
      data: n.data,
    }));
    const flowEdges = mockData.edges.map((e) => ({
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
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [mockData, setNodes, setEdges]);

  const nodeTypes = useMemo(() => ({ botNode: BotNodeRenderer }), []);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          { ...params, type: 'botEdge', data: { condition_type: 'always', condition_config: {} } as BotFlowEdgeData },
          eds,
        ),
      );
    },
    [setEdges],
  );

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    const n = params.nodes[0] as BotFlowNodeType | undefined;
    setSelectedNode(n ?? null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedNode(null);
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
    setSelectedNode(null);
    toast.success('Nodo eliminado');
  }, [selectedNode, setNodes, setEdges]);

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
      <div className="flex flex-wrap items-center gap-3 border-b bg-card/90 px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>
          Automatización
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
            className="!bg-muted/25"
            proOptions={{ hideAttribution: true }}
            deleteKeyCode={['Backspace', 'Delete']}
            defaultEdgeOptions={{ type: 'botEdge' }}
            panOnScroll
            selectionOnDrag
          >
            <Background gap={22} size={1} color="var(--workflow-grid-dot, #cbd5e1)" />
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

          <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
            <div className="pointer-events-auto flex items-center gap-1 rounded-xl border bg-card/95 px-2 py-1.5 shadow-xl backdrop-blur-md">
              <FlowToolbar onAddNode={handleAddNode} />
              <div className="mx-0.5 w-px self-stretch bg-border" />
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

        {selectedNode && (
          <NodeConfigPanel
            node={selectedNode}
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

export default function BotFlowBuilder() {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner />
    </ReactFlowProvider>
  );
}
