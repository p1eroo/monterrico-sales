import { type Node, type Edge } from '@xyflow/react';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BotFlowNodeData, BotNodeType, ValidationError } from './types';

function findStartNode(nodes: Node<BotFlowNodeData>[]): Node<BotFlowNodeData> | undefined {
  return nodes.find((n) => n.data.nodeType === 'start');
}

function findReachableNodeIds(nodes: Node<BotFlowNodeData>[], edges: Edge[]): Set<string> {
  const start = findStartNode(nodes);
  if (!start) return new Set();

  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const list = adjacency.get(edge.source) ?? [];
    list.push(edge.target);
    adjacency.set(edge.source, list);
  }

  const visited = new Set<string>();
  const queue = [start.id];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const neighbor of adjacency.get(id) ?? []) {
      if (!visited.has(neighbor)) queue.push(neighbor);
    }
  }
  return visited;
}

export function validateFlow(nodes: Node<BotFlowNodeData>[], edges: Edge[]): ValidationError[] {
  const errors: ValidationError[] = [];

  // 1. Must have a start node
  const startNode = findStartNode(nodes);
  if (!startNode) {
    errors.push({ type: 'error', message: 'El flujo debe tener un nodo de inicio (start).' });
    return errors;
  }

  const reachable = findReachableNodeIds(nodes, edges);

  // 2. All nodes should be reachable (no orphans)
  for (const node of nodes) {
    if (node.id !== startNode.id && !reachable.has(node.id)) {
      errors.push({ nodeId: node.id, type: 'error', message: `Nodo "${node.data.label}" no está conectado al flujo (huérfano).` });
    }
  }

  // 3. Question nodes must have field_key
  for (const node of nodes) {
    if (node.data.nodeType !== 'question') continue;
    const config = node.data.config as { field_key?: string };
    if (!config.field_key?.trim()) {
      errors.push({ nodeId: node.id, type: 'error', message: `Nodo pregunta "${node.data.label}" debe tener un field_key configurado.` });
    }
  }

  // 4. Condition nodes must have rules
  for (const node of nodes) {
    if (node.data.nodeType !== 'condition') continue;
    const config = node.data.config as { rules?: unknown[] };
    if (!config.rules || config.rules.length === 0) {
      errors.push({ nodeId: node.id, type: 'error', message: `Nodo condición "${node.data.label}" debe tener al menos una regla de salida.` });
    }
  }

  // 5. Check for empty labels
  for (const node of nodes) {
    if (!node.data.label?.trim()) {
      errors.push({ nodeId: node.id, type: 'warning', message: 'Nodo sin nombre.' });
    }
  }

  return errors;
}

interface FlowValidatorProps {
  nodes: Node<BotFlowNodeData>[];
  edges: Edge[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function FlowValidator({ nodes, edges, open, onOpenChange }: FlowValidatorProps) {
  if (!open) return null;

  const errors = validateFlow(nodes, edges);
  const hasErrors = errors.some((e) => e.type === 'error');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => onOpenChange(false)}>
      <div className="w-full max-w-lg rounded-xl border bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          {hasErrors ? (
            <XCircle className="size-5 text-destructive" />
          ) : (
            <CheckCircle2 className="size-5 text-emerald-500" />
          )}
          <h3 className="font-semibold">
            {hasErrors ? 'Errores de validación' : 'Flujo válido'}
          </h3>
        </div>

        {errors.length === 0 ? (
          <p className="text-sm text-muted-foreground">El flujo no tiene errores.</p>
        ) : (
          <ul className="space-y-2 max-h-60 overflow-y-auto">
            {errors.map((err, i) => (
              <li
                key={i}
                className={cn(
                  'flex items-start gap-2 rounded-lg p-2.5 text-xs',
                  err.type === 'error' ? 'bg-destructive/5 text-destructive' : 'bg-amber-500/5 text-amber-700',
                )}
              >
                {err.type === 'error' ? (
                  <XCircle className="mt-0.5 size-3.5 shrink-0" />
                ) : (
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                )}
                <span>{err.message}</span>
              </li>
            ))}
          </ul>
        )}

        <button
          onClick={() => onOpenChange(false)}
          className="mt-4 w-full rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
