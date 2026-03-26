import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type {
  FlowNodeData,
  FlowNodeType,
  TonePolicy,
  TransferToHumanPolicy,
  ApiAuthType,
} from './flowTypes';

type Props = {
  node: FlowNodeType | null;
  onSave: (id: string, data: FlowNodeData) => void;
  onClose: () => void;
  className?: string;
};

const KB_OPTIONS = [
  { id: 'kb-prod-01', label: 'kb-prod-01 — Políticas Q1' },
  { id: 'kb-faq-support', label: 'kb-faq-support — FAQ homologado crawl' },
  { id: 'kb-tabular-pricing', label: 'kb-tabular-pricing — CSV precios' },
];

function ModelCard({
  title,
  badge,
  selected,
  onClick,
}: {
  title: string;
  badge?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full flex-col items-start rounded-lg border px-3 py-2.5 text-left transition-all',
        selected
          ? 'border-chart-4/70 bg-chart-4/15 shadow-lg'
          : 'border-border bg-muted/80 hover:border-muted-foreground/35',
      )}
    >
      <span className="text-sm font-semibold text-foreground">{title}</span>
      {badge && (
        <Badge className="mt-1 border-0 bg-amber-500/25 text-[10px] text-amber-900 dark:text-amber-100">
          {badge}
        </Badge>
      )}
    </button>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
}

export function WorkflowInspectorPanel({
  node,
  onSave,
  onClose,
  className,
}: Props) {
  const [draft, setDraft] = useState<FlowNodeData | null>(null);

  useEffect(() => {
    setDraft(node ? (JSON.parse(JSON.stringify(node.data)) as FlowNodeData) : null);
  }, [node?.id, node?.data]);

  if (!node || !draft) {
    return (
      <aside
        className={cn(
          'flex w-full max-w-[440px] shrink-0 flex-col border-l border-border bg-card',
          className,
        )}
      >
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
          Selecciona un nodo en el lienzo para abrir el inspector de
          configuración.
        </div>
      </aside>
    );
  }

  const patch = (partial: Partial<FlowNodeData>) =>
    setDraft((d) => (d ? { ...d, ...partial } : d));

  return (
    <aside
      className={cn(
        'flex w-full max-w-[440px] shrink-0 flex-col border-l border-border bg-card shadow-xl',
        className,
      )}
    >
      <header className="flex shrink-0 items-start gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-chart-4">
            Inspector
          </p>
          <h2 className="truncate text-base font-semibold text-foreground">
            {draft.title}
          </h2>
          <p className="text-xs text-muted-foreground capitalize">{draft.kind}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-6 p-4 pb-28">
          {/* Campos comunes */}
          <div className="space-y-3">
            <SectionTitle>Identidad del nodo</SectionTitle>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Título</Label>
              <Input
                value={draft.title}
                onChange={(e) => patch({ title: e.target.value })}
                className="border-border bg-muted text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Subtítulo</Label>
              <Input
                value={draft.subtitle}
                onChange={(e) => patch({ subtitle: e.target.value })}
                className="border-border bg-muted text-foreground"
              />
            </div>
          </div>

          {draft.kind === 'llm' && draft.llm && (
            <>
              <Separator className="bg-border" />
              <div className="space-y-3">
                <SectionTitle>Modelo</SectionTitle>
                <div className="grid gap-2">
                  <ModelCard
                    title="GPT-4o Mini"
                    badge="Recomendado"
                    selected={draft.llm.model === 'gpt-4o-mini'}
                    onClick={() =>
                      patch({
                        llm: { ...draft.llm!, model: 'gpt-4o-mini', modelTier: 'recommended' },
                      })
                    }
                  />
                  <ModelCard
                    title="GPT-4o"
                    badge="Premium"
                    selected={draft.llm.model === 'gpt-4o'}
                    onClick={() =>
                      patch({
                        llm: { ...draft.llm!, model: 'gpt-4o', modelTier: 'premium' },
                      })
                    }
                  />
                </div>
              </div>
              <div className="space-y-4">
                <SectionTitle>Hiperparámetros</SectionTitle>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Temperatura</span>
                    <span className="font-mono text-chart-4">
                      {draft.llm.temperature.toFixed(2)}
                    </span>
                  </div>
                  <Slider
                    value={[draft.llm.temperature]}
                    min={0}
                    max={1.2}
                    step={0.05}
                    onValueChange={([v]) =>
                      patch({ llm: { ...draft.llm!, temperature: v } })
                    }
                    className="[&_[role=slider]]:bg-chart-4"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Tokens máx.</span>
                    <span className="font-mono text-chart-4">
                      {draft.llm.maxTokens}
                    </span>
                  </div>
                  <Slider
                    value={[draft.llm.maxTokens]}
                    min={256}
                    max={8192}
                    step={128}
                    onValueChange={([v]) =>
                      patch({ llm: { ...draft.llm!, maxTokens: v } })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Confianza mínima</span>
                    <span className="font-mono text-chart-4">
                      {(draft.llm.confidenceFloor * 100).toFixed(0)}%
                    </span>
                  </div>
                  <Slider
                    value={[draft.llm.confidenceFloor]}
                    min={0.3}
                    max={0.95}
                    step={0.01}
                    onValueChange={([v]) =>
                      patch({ llm: { ...draft.llm!, confidenceFloor: v } })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Espera antes de responder (ms)</span>
                    <span className="font-mono text-chart-4">
                      {draft.llm.waitBeforeRespondMs ?? 0}
                    </span>
                  </div>
                  <Slider
                    value={[draft.llm.waitBeforeRespondMs ?? 0]}
                    min={0}
                    max={2000}
                    step={20}
                    onValueChange={([v]) =>
                      patch({
                        llm: { ...draft.llm!, waitBeforeRespondMs: v },
                      })
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/70 px-3 py-2">
                  <div>
                    <Label className="text-foreground/80">Turnos máximos</Label>
                    <p className="text-[10px] text-muted-foreground">
                      Límite duro de rondas
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 border-input"
                      onClick={() =>
                        patch({
                          llm: {
                            ...draft.llm!,
                            maxTurns: Math.max(1, draft.llm!.maxTurns - 1),
                          },
                        })
                      }
                    >
                      −
                    </Button>
                    <span className="w-8 text-center font-mono text-sm text-foreground">
                      {draft.llm.maxTurns}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 border-input"
                      onClick={() =>
                        patch({
                          llm: {
                            ...draft.llm!,
                            maxTurns: Math.min(40, draft.llm!.maxTurns + 1),
                          },
                        })
                      }
                    >
                      +
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Transferencia a humano</Label>
                  <Select
                    value={draft.llm.transferToHuman}
                    onValueChange={(v) =>
                      patch({
                        llm: {
                          ...draft.llm!,
                          transferToHuman: v as TransferToHumanPolicy,
                        },
                      })
                    }
                  >
                    <SelectTrigger className="border-border bg-muted">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Nunca automático</SelectItem>
                      <SelectItem value="low_conf">Si confianza baja</SelectItem>
                      <SelectItem value="always_offer">Siempre ofrecer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {draft.kind === 'memory' && draft.memory && (
            <>
              <Separator className="bg-border" />
              <SectionTitle>Memoria y contexto</SectionTitle>
              <div className="space-y-3">
                {(
                  [
                    ['profileContactMemory', 'Perfil de contacto'] as const,
                    ['reengagementAuto', 'Re-engagement automático'] as const,
                    ['contextualAi', 'IA contextual'] as const,
                  ]
                ).map(([key, label]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/80 px-3 py-2"
                  >
                    <Label className="text-foreground/80">{label}</Label>
                    <Switch
                      checked={draft.memory![key]}
                      onCheckedChange={(c) =>
                        patch({
                          memory: { ...draft.memory!, [key]: c },
                        })
                      }
                    />
                  </div>
                ))}
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Tono / política</Label>
                  <Select
                    value={draft.memory.tonePolicy}
                    onValueChange={(v) =>
                      patch({
                        memory: {
                          ...draft.memory!,
                          tonePolicy: v as TonePolicy,
                        },
                      })
                    }
                  >
                    <SelectTrigger className="border-border bg-muted">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consultivo">Consultivo</SelectItem>
                      <SelectItem value="comercial">Comercial</SelectItem>
                      <SelectItem value="neutro">Neutro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Presets de seguimiento</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {['24h', '72h', '7d', 'custom'].map((chip) => {
                      const on = draft.memory!.followUpPresets.includes(chip);
                      return (
                        <button
                          key={chip}
                          type="button"
                          onClick={() =>
                            patch({
                              memory: {
                                ...draft.memory!,
                                followUpPresets: on
                                  ? draft.memory!.followUpPresets.filter(
                                      (x) => x !== chip,
                                    )
                                  : [...draft.memory!.followUpPresets, chip],
                              },
                            })
                          }
                          className={cn(
                            'rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors',
                            on
                              ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-900 dark:text-emerald-100'
                              : 'border-border text-muted-foreground hover:border-muted-foreground/40',
                          )}
                        >
                          {chip}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Ventana / resumen</Label>
                  <Textarea
                    rows={2}
                    value={draft.memory.contextWindow}
                    onChange={(e) =>
                      patch({
                        memory: {
                          ...draft.memory!,
                          contextWindow: e.target.value,
                        },
                      })
                    }
                    className="border-border bg-muted text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Notas de tono</Label>
                  <Textarea
                    rows={3}
                    value={draft.memory.toneNotes}
                    onChange={(e) =>
                      patch({
                        memory: { ...draft.memory!, toneNotes: e.target.value },
                      })
                    }
                    className="border-border bg-muted text-foreground"
                  />
                </div>
              </div>
            </>
          )}

          {draft.kind === 'knowledge' && draft.knowledge && (
            <>
              <Separator className="bg-border" />
              <SectionTitle>Base de conocimiento</SectionTitle>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">ID interno</Label>
                  <Input
                    value={draft.knowledge.internalId}
                    onChange={(e) =>
                      patch({
                        knowledge: {
                          ...draft.knowledge!,
                          internalId: e.target.value,
                        },
                      })
                    }
                    className="border-border bg-muted font-mono text-xs text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Nombre visible</Label>
                  <Input
                    value={draft.knowledge.displayName}
                    onChange={(e) =>
                      patch({
                        knowledge: {
                          ...draft.knowledge!,
                          displayName: e.target.value,
                        },
                      })
                    }
                    className="border-border bg-muted text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Descripción</Label>
                  <Textarea
                    rows={3}
                    value={draft.knowledge.description}
                    onChange={(e) =>
                      patch({
                        knowledge: {
                          ...draft.knowledge!,
                          description: e.target.value,
                        },
                      })
                    }
                    className="border-border bg-muted text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Fuentes enlazadas</Label>
                  <div className="space-y-1.5 rounded-lg border border-border bg-muted/70 p-2">
                    {KB_OPTIONS.map((opt) => {
                      const on = draft.knowledge!.linkedBaseIds.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            patch({
                              knowledge: {
                                ...draft.knowledge!,
                                linkedBaseIds: on
                                  ? draft.knowledge!.linkedBaseIds.filter(
                                      (x) => x !== opt.id,
                                    )
                                  : [...draft.knowledge!.linkedBaseIds, opt.id],
                              },
                            })
                          }
                          className={cn(
                            'flex w-full rounded-md border px-2 py-1.5 text-left text-[11px] transition-colors',
                            on
                              ? 'border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-50'
                              : 'border-transparent text-muted-foreground hover:bg-muted',
                          )}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {draft.knowledge.linkedBaseIds.length} fuente(s)
                    seleccionada(s)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Top-K / resultados máx.</Label>
                  <Input
                    type="number"
                    min={1}
                    max={32}
                    value={draft.knowledge.topK}
                    onChange={(e) =>
                      patch({
                        knowledge: {
                          ...draft.knowledge!,
                          topK: parseInt(e.target.value, 10) || 1,
                        },
                      })
                    }
                    className="border-border bg-muted text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Estado de índice</Label>
                  <Select
                    value={draft.knowledge.indexStatus}
                    onValueChange={(v) =>
                      patch({
                        knowledge: {
                          ...draft.knowledge!,
                          indexStatus: v as typeof draft.knowledge.indexStatus,
                        },
                      })
                    }
                  >
                    <SelectTrigger className="border-border bg-muted">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="indexado">Indexado</SelectItem>
                      <SelectItem value="sync">Sincronizando</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {draft.kind === 'agent' && draft.agentMeta && (
            <>
              <Separator className="bg-border" />
              <SectionTitle>Agente principal</SectionTitle>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Etiqueta / tag</Label>
                  <Input
                    value={draft.agentMeta.tag}
                    onChange={(e) =>
                      patch({
                        agentMeta: {
                          ...draft.agentMeta!,
                          tag: e.target.value,
                        },
                      })
                    }
                    className="border-border bg-muted text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Descripción corta</Label>
                  <Textarea
                    rows={3}
                    value={draft.agentMeta.shortDescription}
                    onChange={(e) =>
                      patch({
                        agentMeta: {
                          ...draft.agentMeta!,
                          shortDescription: e.target.value,
                        },
                      })
                    }
                    className="border-border bg-muted text-foreground"
                  />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/80 px-3 py-2">
                  <div>
                    <Label className="text-foreground/80">Activo en producción</Label>
                    <p className="text-[10px] text-muted-foreground">
                      Desactiva para pausar enrutamiento
                    </p>
                  </div>
                  <Switch
                    checked={draft.agentMeta.active}
                    onCheckedChange={(c) =>
                      patch({
                        agentMeta: { ...draft.agentMeta!, active: c },
                      })
                    }
                  />
                </div>
              </div>
            </>
          )}

          {draft.kind === 'database' && draft.database && (
            <>
              <Separator className="bg-border" />
              <SectionTitle>Base de datos</SectionTitle>
              <div className="space-y-3">
                {(
                  [
                    ['internalId', 'ID interno'],
                    ['displayName', 'Nombre visible'],
                    ['description', 'descripción'],
                  ] as const
                ).map(([field, lab]) =>
                  field === 'description' ? (
                    <div key={field} className="space-y-2">
                      <Label className="text-muted-foreground capitalize">{lab}</Label>
                      <Textarea
                        rows={2}
                        value={draft.database!.description}
                        onChange={(e) =>
                          patch({
                            database: {
                              ...draft.database!,
                              description: e.target.value,
                            },
                          })
                        }
                        className="border-border bg-muted text-foreground"
                      />
                    </div>
                  ) : (
                    <div key={field} className="space-y-2">
                      <Label className="text-muted-foreground">{lab}</Label>
                      <Input
                        value={draft.database![field] as string}
                        onChange={(e) =>
                          patch({
                            database: {
                              ...draft.database!,
                              [field]: e.target.value,
                            },
                          })
                        }
                        className="border-border bg-muted text-foreground"
                      />
                    </div>
                  ),
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Host</Label>
                    <Input
                      value={draft.database.host}
                      onChange={(e) =>
                        patch({
                          database: { ...draft.database!, host: e.target.value },
                        })
                      }
                      className="border-border bg-muted font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Puerto</Label>
                    <Input
                      value={draft.database.port}
                      onChange={(e) =>
                        patch({
                          database: { ...draft.database!, port: e.target.value },
                        })
                      }
                      className="border-border bg-muted font-mono text-xs"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Base de datos</Label>
                  <Input
                    value={draft.database.db}
                    onChange={(e) =>
                      patch({
                        database: { ...draft.database!, db: e.target.value },
                      })
                    }
                    className="border-border bg-muted font-mono text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Usuario</Label>
                  <Input
                    value={draft.database.user}
                    onChange={(e) =>
                      patch({
                        database: { ...draft.database!, user: e.target.value },
                      })
                    }
                    className="border-border bg-muted font-mono text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Contraseña</Label>
                  <Input
                    type="password"
                    value={draft.database.passwordMasked}
                    onChange={(e) =>
                      patch({
                        database: {
                          ...draft.database!,
                          passwordMasked: e.target.value,
                        },
                      })
                    }
                    className="border-border bg-muted font-mono text-xs"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full border-info/40 text-info hover:bg-info/10"
                  onClick={() => {}}
                >
                  Probar conexión (simulado OK)
                </Button>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Tabla de trabajo</Label>
                  <Input
                    value={draft.database.table}
                    onChange={(e) =>
                      patch({
                        database: { ...draft.database!, table: e.target.value },
                      })
                    }
                    className="border-border bg-muted font-mono text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Vista previa columnas</Label>
                  <Input
                    value={draft.database.columnsPreview}
                    onChange={(e) =>
                      patch({
                        database: {
                          ...draft.database!,
                          columnsPreview: e.target.value,
                        },
                      })
                    }
                    className="border-border bg-muted font-mono text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Consulta SQL (solo lectura)</Label>
                  <Textarea
                    rows={5}
                    value={draft.database.query}
                    onChange={(e) =>
                      patch({
                        database: { ...draft.database!, query: e.target.value },
                      })
                    }
                    className="font-mono text-xs border-border bg-background text-foreground"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Asistente NL: describe la intención y generamos el SQL en
                    versión productiva.
                  </p>
                </div>
              </div>
            </>
          )}

          {draft.kind === 'api' && draft.api && (
            <>
              <Separator className="bg-border" />
              <SectionTitle>API REST</SectionTitle>
              <div className="space-y-3">
                <div className="grid gap-2">
                  <Label className="text-muted-foreground">ID interno</Label>
                  <Input
                    value={draft.api.internalId}
                    onChange={(e) =>
                      patch({
                        api: { ...draft.api!, internalId: e.target.value },
                      })
                    }
                    className="border-border bg-muted font-mono text-xs"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-muted-foreground">Nombre visible</Label>
                  <Input
                    value={draft.api.displayName}
                    onChange={(e) =>
                      patch({
                        api: { ...draft.api!, displayName: e.target.value },
                      })
                    }
                    className="border-border bg-muted text-foreground"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-muted-foreground">Descripción</Label>
                  <Textarea
                    rows={2}
                    value={draft.api.description}
                    onChange={(e) =>
                      patch({
                        api: { ...draft.api!, description: e.target.value },
                      })
                    }
                    className="border-border bg-muted text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Método HTTP</Label>
                  <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/80 p-1">
                    {(['GET', 'POST', 'PUT', 'PATCH'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => patch({ api: { ...draft.api!, method: m } })}
                        className={cn(
                          'rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors',
                          draft.api!.method === m
                            ? 'bg-info/25 text-info'
                            : 'text-muted-foreground hover:bg-muted',
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Autenticación</Label>
                  <Select
                    value={draft.api.authType}
                    onValueChange={(v) =>
                      patch({
                        api: { ...draft.api!, authType: v as ApiAuthType },
                      })
                    }
                  >
                    <SelectTrigger className="border-border bg-muted">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin auth</SelectItem>
                      <SelectItem value="bearer">Bearer</SelectItem>
                      <SelectItem value="apikey">API Key</SelectItem>
                      <SelectItem value="basic">Basic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {draft.api.authType !== 'none' && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Secreto / referencia</Label>
                    <Input
                      value={draft.api.authSecretMasked}
                      onChange={(e) =>
                        patch({
                          api: { ...draft.api!, authSecretMasked: e.target.value },
                        })
                      }
                      className="border-border bg-muted font-mono text-xs"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-muted-foreground">URL del endpoint</Label>
                  <Input
                    value={draft.api.endpoint}
                    onChange={(e) =>
                      patch({
                        api: { ...draft.api!, endpoint: e.target.value },
                      })
                    }
                    className="border-border bg-muted font-mono text-xs text-info"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-muted-foreground">Cuerpo (JSON)</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[10px] text-info"
                      onClick={() => {
                        try {
                          const o = JSON.parse(
                            draft.api!.bodyTemplate || '{}',
                          ) as object;
                          patch({
                            api: {
                              ...draft.api!,
                              bodyTemplate: JSON.stringify(o, null, 2),
                            },
                          });
                        } catch {
                          toast.error('JSON inválido');
                        }
                      }}
                    >
                      Formatear
                    </Button>
                  </div>
                  <Textarea
                    rows={8}
                    value={draft.api.bodyTemplate}
                    onChange={(e) =>
                      patch({
                        api: { ...draft.api!, bodyTemplate: e.target.value },
                      })
                    }
                    className="font-mono text-xs border-border bg-background text-foreground"
                  />
                </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-muted-foreground">Variables</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 border-input text-[10px]"
                          onClick={() =>
                            patch({
                              api: {
                                ...draft.api!,
                                variableMap: [
                                  ...draft.api!.variableMap,
                                  '{{nueva}} descripción',
                                ],
                              },
                            })
                          }
                        >
                          Añadir variable
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {draft.api.variableMap.map((v, i) => (
                          <Badge
                            key={`${v}-${i}`}
                            variant="outline"
                            className="border-info/40 font-mono text-[10px] text-info"
                          >
                            {v}
                          </Badge>
                        ))}
                      </div>
                    </div>
              </div>
            </>
          )}

          {draft.kind === 'static' && draft.staticData && (
            <>
              <Separator className="bg-border" />
              <SectionTitle>Datos estáticos</SectionTitle>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">ID interno</Label>
                  <Input
                    value={draft.staticData.internalId}
                    onChange={(e) =>
                      patch({
                        staticData: {
                          ...draft.staticData!,
                          internalId: e.target.value,
                        },
                      })
                    }
                    className="border-border bg-muted font-mono text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Nombre visible</Label>
                  <Input
                    value={draft.staticData.displayName}
                    onChange={(e) =>
                      patch({
                        staticData: {
                          ...draft.staticData!,
                          displayName: e.target.value,
                        },
                      })
                    }
                    className="border-border bg-muted text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Clave / valor</Label>
                  <Textarea
                    rows={2}
                    value={draft.staticData.kv}
                    onChange={(e) =>
                      patch({
                        staticData: { ...draft.staticData!, kv: e.target.value },
                      })
                    }
                    className="font-mono text-xs border-border bg-muted text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">JSON</Label>
                  <Textarea
                    rows={6}
                    value={draft.staticData.json}
                    onChange={(e) =>
                      patch({
                        staticData: { ...draft.staticData!, json: e.target.value },
                      })
                    }
                    className="font-mono text-xs border-border bg-background text-foreground"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>

      <footer className="sticky bottom-0 z-10 border-t border-border bg-card/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-card/90">
        <Button
          type="button"
          className="w-full bg-primary font-semibold text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary/90"
          onClick={() => onSave(node.id, draft)}
        >
          Guardar configuración
        </Button>
      </footer>
    </aside>
  );
}
