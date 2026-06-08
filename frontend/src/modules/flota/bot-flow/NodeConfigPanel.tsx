import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type {
  BotFlowNodeType,
  BotNodeType,
  StartNodeConfig,
  MessageNodeConfig,
  QuestionNodeConfig,
  ConditionNodeConfig,
  ConditionRule,
  AiExtractNodeConfig,
  CrmActionNodeConfig,
  HumanHandoffNodeConfig,
  EndNodeConfig,
  BotNodeConfig,
} from './types';
import {
  FIELD_TYPES,
  CONDITION_OPERATORS,
  CRM_ACTION_TYPES,
  NODE_LABELS,
  NODE_COLORS,
} from './types';

interface Props {
  node: BotFlowNodeType | null;
  onSave: (nodeId: string, config: BotNodeConfig, label: string) => void;
  onClose: () => void;
  className?: string;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function randomId() {
  return `r-${crypto.randomUUID().slice(0, 6)}`;
}

/* ── Start Config ── */
function StartConfig({ config, onChange }: { config: StartNodeConfig; onChange: (c: StartNodeConfig) => void }) {
  return (
    <div className="space-y-3">
      <Field label="Nombre del flujo">
        <Input value={config.name} onChange={(e) => onChange({ ...config, name: e.target.value })} placeholder="Ej: Flujo de bienvenida" />
      </Field>
      <Field label="Descripción">
        <Textarea value={config.description} onChange={(e) => onChange({ ...config, description: e.target.value })} placeholder="Descripción del flujo..." className="min-h-[60px] resize-none text-xs" />
      </Field>
    </div>
  );
}

/* ── Message Config ── */
function MessageConfig({ config, onChange }: { config: MessageNodeConfig; onChange: (c: MessageNodeConfig) => void }) {
  return (
    <div className="space-y-3">
      <Field label="Texto del mensaje">
        <Textarea value={config.text} onChange={(e) => onChange({ ...config, text: e.target.value })} placeholder="Escribí el mensaje..." className="min-h-[80px] resize-none text-xs" />
      </Field>
      <Field label="Delay (segundos)">
        <Input type="number" min={0} max={60} value={config.delay} onChange={(e) => onChange({ ...config, delay: Number(e.target.value) || 0 })} />
      </Field>
      <div className="rounded-lg border border-dashed p-3 text-center text-[11px] text-muted-foreground">
        Adjuntos disponibles próximamente
      </div>
    </div>
  );
}

/* ── Question Config ── */
function QuestionConfig({ config, onChange }: { config: QuestionNodeConfig; onChange: (c: QuestionNodeConfig) => void }) {
  return (
    <div className="space-y-3">
      <Field label="Texto de la pregunta">
        <Textarea value={config.text} onChange={(e) => onChange({ ...config, text: e.target.value })} placeholder="Escribí la pregunta..." className="min-h-[60px] resize-none text-xs" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Field key">
          <Input value={config.field_key} onChange={(e) => onChange({ ...config, field_key: e.target.value })} placeholder="ej: nombreCompleto" />
        </Field>
        <Field label="Tipo de campo">
          <Select value={config.field_type} onValueChange={(v) => onChange({ ...config, field_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map((ft) => (
                <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="Usar extracción IA">
        <div className="flex items-center gap-2">
          <Switch checked={config.use_ai_extraction} onCheckedChange={(v) => onChange({ ...config, use_ai_extraction: v })} />
          <span className="text-xs text-muted-foreground">{config.use_ai_extraction ? 'Activado' : 'Desactivado'}</span>
        </div>
      </Field>
      {config.use_ai_extraction && (
        <Field label="Schema JSON de extracción">
          <Textarea value={config.extraction_schema} onChange={(e) => onChange({ ...config, extraction_schema: e.target.value })} className="min-h-[60px] resize-none font-mono text-[10px]" />
        </Field>
      )}
      <Field label="Mensaje de fallback">
        <Input value={config.fallback_message} onChange={(e) => onChange({ ...config, fallback_message: e.target.value })} />
      </Field>
      <Field label="Max intentos">
        <Input type="number" min={1} max={10} value={config.max_attempts} onChange={(e) => onChange({ ...config, max_attempts: Number(e.target.value) || 3 })} />
      </Field>
    </div>
  );
}

/* ── Condition Config ── */
function ConditionConfig({ config, onChange }: { config: ConditionNodeConfig; onChange: (c: ConditionNodeConfig) => void }) {
  const rules = config.rules ?? [];

  const updateRule = (id: string, partial: Partial<ConditionRule>) => {
    onChange({
      ...config,
      rules: rules.map((r) => (r.id === id ? { ...r, ...partial } : r)),
    });
  };

  const removeRule = (id: string) => {
    onChange({ ...config, rules: rules.filter((r) => r.id !== id) });
  };

  const addRule = () => {
    onChange({
      ...config,
      rules: [...rules, { id: randomId(), operator: 'equals', field_key: '', value: '', output_label: '' }],
    });
  };

  return (
    <div className="space-y-3">
      <SectionTitle>Reglas condicionales</SectionTitle>
      {rules.length === 0 && (
        <p className="text-[11px] italic text-muted-foreground">Sin reglas. Agregá al menos una.</p>
      )}
      {rules.map((rule, i) => (
        <div key={rule.id} className="rounded-lg border bg-muted/20 p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-muted-foreground">Regla {i + 1}</span>
            <button type="button" onClick={() => removeRule(rule.id)} className="text-destructive hover:text-destructive/80 text-[10px]">Quitar</button>
          </div>
          <Field label="Etiqueta de salida">
            <Input value={rule.output_label} onChange={(e) => updateRule(rule.id, { output_label: e.target.value })} placeholder="ej: Sí, No" className="h-7 text-xs" />
          </Field>
          <div className="grid grid-cols-3 gap-1.5">
            <Field label="Campo">
              <Input value={rule.field_key} onChange={(e) => updateRule(rule.id, { field_key: e.target.value })} placeholder="field_key" className="h-7 text-xs" />
            </Field>
            <Field label="Operador">
              <Select value={rule.operator} onValueChange={(v) => updateRule(rule.id, { operator: v })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONDITION_OPERATORS.map((op) => (
                    <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Valor">
              <Input value={rule.value} onChange={(e) => updateRule(rule.id, { value: e.target.value })} placeholder="valor" className="h-7 text-xs" />
            </Field>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addRule} className="w-full text-xs gap-1">
        + Agregar regla
      </Button>
    </div>
  );
}

/* ── AiExtract Config ── */
function AiExtractConfig({ config, onChange }: { config: AiExtractNodeConfig; onChange: (c: AiExtractNodeConfig) => void }) {
  return (
    <div className="space-y-3">
      <Field label="Prompt de extracción">
        <Textarea value={config.prompt} onChange={(e) => onChange({ ...config, prompt: e.target.value })} placeholder="Describí qué datos extraer..." className="min-h-[80px] resize-none text-xs" />
      </Field>
      <Field label="Schema JSON esperado">
        <Textarea value={config.schema} onChange={(e) => onChange({ ...config, schema: e.target.value })} className="min-h-[80px] resize-none font-mono text-[10px]" />
      </Field>
      <Field label="Confianza mínima">
        <div className="flex items-center gap-2">
          <Input type="number" min={0} max={1} step={0.05} value={config.min_confidence} onChange={(e) => onChange({ ...config, min_confidence: Number(e.target.value) || 0 })} className="w-20" />
          <span className="text-xs text-muted-foreground">{(config.min_confidence * 100).toFixed(0)}%</span>
        </div>
      </Field>
      <Field label="Mensaje de fallback">
        <Input value={config.fallback_message} onChange={(e) => onChange({ ...config, fallback_message: e.target.value })} />
      </Field>
    </div>
  );
}

/* ── CrmAction Config ── */
function CrmActionConfig({ config, onChange }: { config: CrmActionNodeConfig; onChange: (c: CrmActionNodeConfig) => void }) {
  return (
    <div className="space-y-3">
      <Field label="Tipo de acción">
        <Select value={config.action_type} onValueChange={(v) => onChange({ ...config, action_type: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {CRM_ACTION_TYPES.map((at) => (
              <SelectItem key={at.value} value={at.value}>{at.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Payload JSON">
        <Textarea value={config.payload} onChange={(e) => onChange({ ...config, payload: e.target.value })} className="min-h-[80px] resize-none font-mono text-[10px]" placeholder='{"key": "value"}' />
      </Field>
    </div>
  );
}

/* ── HumanHandoff Config ── */
function HumanHandoffConfig({ config, onChange }: { config: HumanHandoffNodeConfig; onChange: (c: HumanHandoffNodeConfig) => void }) {
  return (
    <div className="space-y-3">
      <Field label="Mensaje antes de derivar">
        <Textarea value={config.message} onChange={(e) => onChange({ ...config, message: e.target.value })} placeholder="Te transfiero con un agente..." className="min-h-[60px] resize-none text-xs" />
      </Field>
      <Field label="Cola destino">
        <Input value={config.queue} onChange={(e) => onChange({ ...config, queue: e.target.value })} placeholder="ej: ventas, soporte" />
      </Field>
      <Field label="Operador destino (opcional)">
        <Input value={config.operator} onChange={(e) => onChange({ ...config, operator: e.target.value })} placeholder="Nombre del operador" />
      </Field>
      <Field label="Etiqueta a aplicar">
        <Input value={config.tag} onChange={(e) => onChange({ ...config, tag: e.target.value })} placeholder="ej: interesado" />
      </Field>
    </div>
  );
}

/* ── End Config ── */
function EndConfig({ config, onChange }: { config: EndNodeConfig; onChange: (c: EndNodeConfig) => void }) {
  return (
    <div className="space-y-3">
      <Field label="Mensaje final (opcional)">
        <Textarea value={config.message} onChange={(e) => onChange({ ...config, message: e.target.value })} placeholder="Gracias por comunicarte..." className="min-h-[60px] resize-none text-xs" />
      </Field>
      <Field label="Estado final de la sesión">
        <Select value={config.session_status} onValueChange={(v) => onChange({ ...config, session_status: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="completed">Completado</SelectItem>
            <SelectItem value="partial">Parcial</SelectItem>
            <SelectItem value="failed">Fallido</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}

/* ── Main Panel ── */
export default function NodeConfigPanel({ node, onSave, onClose, className }: Props) {
  const [localConfig, setLocalConfig] = useState<BotNodeConfig | null>(null);
  const [localLabel, setLocalLabel] = useState('');

  useEffect(() => {
    if (node) {
      setLocalConfig(structuredClone(node.data.config));
      setLocalLabel(node.data.label);
    }
  }, [node]);

  if (!node || !localConfig) return null;

  const nodeType = node.data.nodeType;
  const accent = NODE_COLORS[nodeType];

  const handleSave = () => {
    if (localConfig) {
      onSave(node.id, localConfig, localLabel);
    }
  };

  const renderConfigForm = () => {
    switch (nodeType) {
      case 'start':
        return <StartConfig config={localConfig as StartNodeConfig} onChange={setLocalConfig} />;
      case 'message':
        return <MessageConfig config={localConfig as MessageNodeConfig} onChange={setLocalConfig} />;
      case 'question':
        return <QuestionConfig config={localConfig as QuestionNodeConfig} onChange={setLocalConfig} />;
      case 'condition':
        return <ConditionConfig config={localConfig as ConditionNodeConfig} onChange={setLocalConfig} />;
      case 'ai_extract':
        return <AiExtractConfig config={localConfig as AiExtractNodeConfig} onChange={setLocalConfig} />;
      case 'crm_action':
        return <CrmActionConfig config={localConfig as CrmActionNodeConfig} onChange={setLocalConfig} />;
      case 'human_handoff':
        return <HumanHandoffConfig config={localConfig as HumanHandoffNodeConfig} onChange={setLocalConfig} />;
      case 'end':
        return <EndConfig config={localConfig as EndNodeConfig} onChange={setLocalConfig} />;
    }
  };

  return (
    <aside
      className={cn(
        'flex w-[340px] shrink-0 flex-col border-l bg-card',
        className,
      )}
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="size-2.5 rounded-full" style={{ backgroundColor: accent }} />
          <span className="text-sm font-semibold">{NODE_LABELS[nodeType]}</span>
        </div>
        <Button variant="ghost" size="icon" className="size-7" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 px-4 py-3">
        <div className="space-y-3">
          <Field label="Nombre del nodo">
            <Input value={localLabel} onChange={(e) => setLocalLabel(e.target.value)} className="text-xs" />
          </Field>
          <Separator />
          {renderConfigForm()}
        </div>
      </ScrollArea>

      <div className="border-t p-3">
        <Button onClick={handleSave} className="w-full text-xs" size="sm">
          Guardar configuración
        </Button>
      </div>
    </aside>
  );
}
