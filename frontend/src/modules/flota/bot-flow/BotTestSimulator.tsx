import { useState, useCallback, useEffect } from 'react';
import { type Node, type Edge } from '@xyflow/react';
import { X, Send, Bot, User, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { BotFlowNodeData, BotNodeType, QuestionNodeConfig, ConditionNodeConfig, ConditionRule, MessageNodeConfig, AiExtractNodeConfig } from './types';

interface SimMessage {
  role: 'bot' | 'user' | 'system' | 'info';
  text: string;
  nodeId: string;
}

interface BotTestSimulatorProps {
  nodes: Node<BotFlowNodeData>[];
  edges: Edge[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function findNextNode(currentId: string, nodes: Node<BotFlowNodeData>[], edges: Edge[], fieldValues: Record<string, string>): Node<BotFlowNodeData> | null {
  const outEdges = edges.filter((e) => e.source === currentId);
  if (outEdges.length === 0) return null;

  // For condition nodes, evaluate rules
  const current = nodes.find((n) => n.id === currentId);
  if (current?.data.nodeType === 'condition') {
    const config = current.data.config as ConditionNodeConfig;
    for (const edge of outEdges) {
      const ruleId = (edge.data as any)?.condition_config?.rule_id;
      if (ruleId) {
        const rule = config.rules.find((r) => r.id === ruleId);
        if (rule) {
          const fieldVal = fieldValues[rule.field_key] ?? '';
          const matches = evaluateRule(rule, fieldVal);
          if (matches) return nodes.find((n) => n.id === edge.target) ?? null;
        }
      }
    }
    // Fallback to first edge
    const firstTarget = outEdges[0]?.target;
    return nodes.find((n) => n.id === firstTarget) ?? null;
  }

  // Default: follow first edge
  const firstTarget = outEdges[0]?.target;
  return nodes.find((n) => n.id === firstTarget) ?? null;
}

function evaluateRule(rule: ConditionRule, fieldVal: string): boolean {
  switch (rule.operator) {
    case 'equals':
      return fieldVal.toLowerCase() === rule.value.toLowerCase();
    case 'contains':
      return fieldVal.toLowerCase().includes(rule.value.toLowerCase());
    case 'exists':
      return fieldVal.trim().length > 0;
    case 'greater_than':
      return Number(fieldVal) > Number(rule.value);
    case 'less_than':
      return Number(fieldVal) < Number(rule.value);
    case 'intent_is':
      return fieldVal.toLowerCase() === rule.value.toLowerCase();
    default:
      return false;
  }
}

export default function BotTestSimulator({ nodes, edges, open, onOpenChange }: BotTestSimulatorProps) {
  const [messages, setMessages] = useState<SimMessage[]>([]);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [userInput, setUserInput] = useState('');
  const [waitingInput, setWaitingInput] = useState(false);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (open) {
      setMessages([]);
      setCurrentNodeId(null);
      setFieldValues({});
      setUserInput('');
      setWaitingInput(false);
      setRunning(false);
      setStarted(false);
    }
  }, [open]);

  const processNode = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    setCurrentNodeId(nodeId);

    switch (node.data.nodeType) {
      case 'start': {
        const config = node.data.config as { name?: string; description?: string };
        setMessages((prev) => [...prev, { role: 'info', text: `▶ Inicio: ${config.name || 'Flujo'}`, nodeId }]);
        const next = findNextNode(nodeId, nodes, edges, fieldValues);
        if (next) setTimeout(() => processNode(next.id), 500);
        else finish();
        break;
      }
      case 'message': {
        const config = node.data.config as MessageNodeConfig;
        setMessages((prev) => [...prev, { role: 'bot', text: config.text || '(sin mensaje)', nodeId }]);
        if (config.delay > 0) {
          setTimeout(() => {
            const next = findNextNode(nodeId, nodes, edges, fieldValues);
            if (next) processNode(next.id);
            else finish();
          }, config.delay * 500);
        } else {
          const next = findNextNode(nodeId, nodes, edges, fieldValues);
          if (next) setTimeout(() => processNode(next.id), 500);
          else finish();
        }
        break;
      }
      case 'question': {
        const config = node.data.config as QuestionNodeConfig;
        setMessages((prev) => [...prev, { role: 'bot', text: config.text || '(sin pregunta)', nodeId }]);
        setWaitingInput(true);
        break;
      }
      case 'condition': {
        const config = node.data.config as ConditionNodeConfig;
        setMessages((prev) => [...prev, { role: 'info', text: `🔀 Evaluando condición (${config.rules.length} reglas)`, nodeId }]);
        const next = findNextNode(nodeId, nodes, edges, fieldValues);
        if (next) setTimeout(() => processNode(next.id), 400);
        else finish();
        break;
      }
      case 'ai_extract': {
        const config = node.data.config as AiExtractNodeConfig;
        setMessages((prev) => [...prev, { role: 'bot', text: `🔍 Extrayendo datos con IA...`, nodeId }]);
        setMessages((prev) => [...prev, { role: 'info', text: `Prompt: ${config.prompt || '(sin prompt)'}`, nodeId }]);
        // Simulate AI extraction - ask user to provide data
        setWaitingInput(true);
        break;
      }
      case 'crm_action': {
        const config = node.data.config as { action_type?: string; payload?: string };
        setMessages((prev) => [...prev, { role: 'system', text: `⚡ Acción CRM: ${config.action_type || '?'}`, nodeId }]);
        const next = findNextNode(nodeId, nodes, edges, fieldValues);
        if (next) setTimeout(() => processNode(next.id), 400);
        else finish();
        break;
      }
      case 'human_handoff': {
        const config = node.data.config as { message?: string; queue?: string };
        setMessages((prev) => [...prev, { role: 'bot', text: config.message || 'Te transfiero con un agente.', nodeId }]);
        setMessages((prev) => [...prev, { role: 'system', text: `👤 Derivado a humano (cola: ${config.queue || 'general'})`, nodeId }]);
        finish();
        break;
      }
      case 'end': {
        const config = node.data.config as { message?: string; session_status?: string };
        if (config.message) {
          setMessages((prev) => [...prev, { role: 'bot', text: config.message!, nodeId }]);
        }
        setMessages((prev) => [...prev, { role: 'info', text: `✅ Flujo completado — Estado: ${config.session_status || 'completed'}`, nodeId }]);
        finish();
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, fieldValues]);

  const finish = () => {
    setRunning(false);
    setWaitingInput(false);
  };

  const handleStart = () => {
    setStarted(true);
    setRunning(true);
    setMessages([]);
    setFieldValues({});
    setCurrentNodeId(null);
    setUserInput('');

    const startNode = nodes.find((n) => n.data.nodeType === 'start');
    if (startNode) {
      setTimeout(() => processNode(startNode.id), 300);
    } else {
      setMessages([{ role: 'info', text: '❌ No hay nodo de inicio en el flujo.', nodeId: '' }]);
      setRunning(false);
    }
  };

  const handleSend = () => {
    if (!userInput.trim() || !currentNodeId) return;
    const text = userInput.trim();
    setMessages((prev) => [...prev, { role: 'user', text, nodeId: currentNodeId }]);
    setUserInput('');
    setWaitingInput(false);

    const node = nodes.find((n) => n.id === currentNodeId);
    if (node?.data.nodeType === 'question') {
      const config = node.data.config as QuestionNodeConfig;
      if (config.field_key) {
        setFieldValues((prev) => ({ ...prev, [config.field_key]: text }));
      }
    }

    const next = findNextNode(currentNodeId, nodes, edges, { ...fieldValues, ...(node?.data.nodeType === 'question' ? { [((node.data.config as QuestionNodeConfig).field_key || '')]: text } : {}) });
    if (next) {
      setTimeout(() => processNode(next.id), 400);
    } else {
      finish();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => onOpenChange(false)}>
      <div className="flex h-[600px] w-full max-w-md flex-col rounded-xl border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Bot className="size-4 text-primary" />
            <span className="text-sm font-semibold">Simulador de conversación</span>
          </div>
          <Button variant="ghost" size="icon" className="size-7" onClick={() => onOpenChange(false)}>
            <X className="size-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1 p-4">
          {!started ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
              <Bot className="size-12 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Simulá el recorrido del flujo</p>
              <p className="text-xs text-muted-foreground/60">El bot recorrerá los nodos y te pedirá respuestas cuando corresponda.</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={cn('flex items-start gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  {msg.role !== 'user' && (
                    <div className={cn('flex size-7 shrink-0 items-center justify-center rounded-full', msg.role === 'system' ? 'bg-muted' : msg.role === 'info' ? 'bg-muted' : 'bg-primary/10')}>
                      {msg.role === 'bot' ? <Bot className="size-3.5 text-primary" /> : msg.role === 'system' ? <RefreshCw className="size-3.5 text-muted-foreground" /> : <Loader2 className="size-3.5 text-muted-foreground" />}
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[80%] rounded-2xl px-3.5 py-2 text-sm',
                      msg.role === 'user' ? 'rounded-br-sm bg-primary text-primary-foreground' :
                      msg.role === 'system' ? 'rounded-bl-sm bg-muted text-xs text-muted-foreground' :
                      msg.role === 'info' ? 'rounded-bl-sm bg-amber-500/5 text-xs text-amber-700' :
                      'rounded-bl-sm bg-muted text-foreground',
                    )}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {running && !waitingInput && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  Procesando...
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="border-t p-3">
          {!started ? (
            <Button onClick={handleStart} className="w-full" size="sm">
              <Bot className="mr-2 size-4" />
              Iniciar simulación
            </Button>
          ) : waitingInput ? (
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="flex items-center gap-2"
            >
              <Input
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Escribí tu respuesta..."
                className="flex-1 text-sm"
                autoFocus
                disabled={!waitingInput}
              />
              <Button type="submit" size="icon" className="size-9 shrink-0" disabled={!userInput.trim() || !waitingInput}>
                <Send className="size-4" />
              </Button>
            </form>
          ) : (
            <div className="flex gap-2">
              <Button onClick={handleStart} variant="outline" className="flex-1" size="sm">
                <RefreshCw className="mr-2 size-4" />
                Reiniciar
              </Button>
              <Button onClick={() => onOpenChange(false)} variant="ghost" className="flex-1" size="sm">
                Cerrar
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
