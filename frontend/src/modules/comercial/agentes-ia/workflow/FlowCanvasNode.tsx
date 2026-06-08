import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  Bot,
  BookOpen,
  Brain,
  Braces,
  Cpu,
  Database,
  Globe,
  Pencil,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FlowNodeType } from './flowTypes';

const SCHEMES = {
  llm: {
    ring: 'ring-violet-500/35 dark:ring-violet-400/35 shadow-violet-500/10 dark:shadow-violet-500/15',
    border: 'border-violet-500/40 dark:border-violet-500/45',
    header:
      'from-violet-500/20 to-indigo-500/12 text-violet-950 dark:from-violet-600/30 dark:to-indigo-600/20 dark:text-violet-100',
    icon: 'bg-violet-500/20 text-violet-800 dark:bg-violet-500/25 dark:text-violet-200',
    chip: 'bg-violet-500/15 text-violet-900 dark:bg-violet-500/20 dark:text-violet-200',
  },
  memory: {
    ring: 'ring-emerald-500/35 dark:ring-emerald-400/40 shadow-emerald-500/10 dark:shadow-emerald-500/15',
    border: 'border-emerald-500/40 dark:border-emerald-500/45',
    header:
      'from-emerald-500/20 to-teal-500/12 text-emerald-950 dark:from-emerald-600/30 dark:to-teal-600/15 dark:text-emerald-100',
    icon: 'bg-emerald-500/20 text-emerald-800 dark:bg-emerald-500/25 dark:text-emerald-200',
    chip: 'bg-emerald-500/15 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200',
  },
  agent: {
    ring: 'ring-orange-500/40 dark:ring-orange-400/50 shadow-orange-500/12 dark:shadow-orange-500/20',
    border: 'border-orange-500/45 dark:border-orange-500/55',
    header:
      'from-orange-500/22 to-rose-500/12 text-orange-950 dark:from-orange-600/35 dark:to-rose-600/25 dark:text-orange-50',
    icon: 'bg-orange-500/25 text-orange-900 dark:bg-orange-500/30 dark:text-orange-100',
    chip: 'bg-orange-500/18 text-orange-900 dark:bg-orange-500/25 dark:text-orange-100',
  },
  knowledge: {
    ring: 'ring-amber-500/35 dark:ring-amber-400/40 shadow-amber-500/10 dark:shadow-amber-500/15',
    border: 'border-amber-500/40 dark:border-amber-500/45',
    header:
      'from-amber-500/22 to-orange-500/12 text-amber-950 dark:from-amber-600/30 dark:to-orange-600/20 dark:text-amber-50',
    icon: 'bg-amber-500/20 text-amber-900 dark:bg-amber-500/25 dark:text-amber-100',
    chip: 'bg-amber-500/15 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100',
  },
  database: {
    ring: 'ring-purple-500/35 dark:ring-fuchsia-400/40 shadow-purple-500/10 dark:shadow-purple-500/15',
    border: 'border-fuchsia-500/35 dark:border-fuchsia-500/40',
    header:
      'from-fuchsia-500/18 to-purple-500/12 text-purple-950 dark:from-fuchsia-600/25 dark:to-purple-600/20 dark:text-fuchsia-100',
    icon: 'bg-fuchsia-500/20 text-purple-900 dark:bg-fuchsia-500/25 dark:text-fuchsia-100',
    chip: 'bg-fuchsia-500/15 text-purple-900 dark:bg-fuchsia-500/20 dark:text-fuchsia-100',
  },
  api: {
    ring: 'ring-sky-500/35 dark:ring-cyan-400/40 shadow-sky-500/10 dark:shadow-cyan-500/15',
    border: 'border-sky-500/40 dark:border-cyan-500/45',
    header:
      'from-sky-500/22 to-cyan-500/12 text-sky-950 dark:from-sky-600/30 dark:to-cyan-600/20 dark:text-cyan-50',
    icon: 'bg-sky-500/20 text-sky-800 dark:bg-cyan-500/25 dark:text-cyan-100',
    chip: 'bg-sky-500/15 text-sky-900 dark:bg-cyan-500/20 dark:text-cyan-100',
  },
  static: {
    ring: 'ring-teal-500/30 dark:ring-teal-400/35 shadow-teal-500/10 dark:shadow-teal-500/12',
    border: 'border-teal-500/40 dark:border-teal-500/45',
    header:
      'from-teal-500/20 to-emerald-600/12 text-teal-950 dark:from-teal-600/28 dark:to-emerald-700/20 dark:text-teal-50',
    icon: 'bg-teal-500/20 text-teal-800 dark:bg-teal-500/25 dark:text-teal-100',
    chip: 'bg-teal-500/15 text-teal-900 dark:bg-teal-500/20 dark:text-teal-100',
  },
} as const;

function StatusPill({ status }: { status: FlowNodeType['data']['status'] }) {
  const label =
    status === 'ok' ? 'Activo' : status === 'warn' ? 'Revisar' : 'Off';
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
        status === 'ok' &&
          'bg-emerald-500/20 text-emerald-800 dark:bg-emerald-500/25 dark:text-emerald-200',
        status === 'warn' &&
          'bg-amber-500/20 text-amber-900 dark:bg-amber-500/25 dark:text-amber-100',
        status === 'off' && 'bg-muted text-muted-foreground',
      )}
    >
      {label}
    </span>
  );
}

function OrchestrationNodeFn({ data, selected }: NodeProps<FlowNodeType>) {
  const scheme = SCHEMES[data.kind];
  const Icon =
    data.kind === 'llm'
      ? Cpu
      : data.kind === 'memory'
        ? Brain
        : data.kind === 'agent'
          ? Bot
          : data.kind === 'knowledge'
            ? BookOpen
            : data.kind === 'database'
              ? Database
              : data.kind === 'api'
                ? Globe
                : Braces;

  return (
    <div
      className={cn(
        'min-w-[220px] max-w-[260px] rounded-xl border bg-card shadow-lg transition-all duration-200',
        scheme.border,
        selected && cn('ring-2 shadow-lg', scheme.ring),
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-3 !border-2 !border-border !bg-muted"
      />
      <div
        className={cn(
          'flex items-center gap-2 rounded-t-[10px] border-b border-border/60 bg-gradient-to-r px-3 py-2',
          scheme.header,
        )}
      >
        <div
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-lg',
            scheme.icon,
          )}
        >
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-bold uppercase tracking-wider opacity-90">
            {data.kind === 'llm' && 'Modelo LLM'}
            {data.kind === 'memory' && 'Memoria'}
            {data.kind === 'agent' && 'Agente principal'}
            {data.kind === 'knowledge' && 'Conocimiento'}
            {data.kind === 'database' && 'Base de datos'}
            {data.kind === 'api' && 'API REST'}
            {data.kind === 'static' && 'Datos estáticos'}
          </p>
          <p className="truncate text-xs font-semibold leading-tight">
            {data.title}
          </p>
        </div>
        <StatusPill status={data.status} />
      </div>

      <div className="space-y-2 px-3 py-2.5 text-[11px] leading-snug text-muted-foreground">
        {data.kind === 'llm' && data.llm && (
          <>
            <p className="truncate font-medium text-foreground">{data.llm.model}</p>
            <div className="flex flex-wrap gap-1">
              <span className={cn('rounded px-1.5 py-0.5 text-[10px]', scheme.chip)}>
                conf. min {(data.llm.confidenceFloor * 100).toFixed(0)}%
              </span>
              <span className={cn('rounded px-1.5 py-0.5 text-[10px]', scheme.chip)}>
                {data.llm.maxTurns} turnos
              </span>
            </div>
          </>
        )}

        {data.kind === 'memory' && data.memory && (
          <>
            <div className="flex flex-wrap gap-1">
              {data.memory.profileContactMemory && (
                <span className="flex items-center gap-0.5 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-800 dark:text-emerald-200">
                  Perfil
                </span>
              )}
              {data.memory.reengagementAuto && (
                <span className="flex items-center gap-0.5 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-800 dark:text-emerald-200">
                  <RefreshCw className="size-2.5" />
                  Re-engage
                </span>
              )}
              {data.memory.contextualAi && (
                <span className="flex items-center gap-0.5 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-800 dark:text-emerald-200">
                  <Sparkles className="size-2.5" />
                  Contexto
                </span>
              )}
            </div>
            <p className="line-clamp-2 text-[10px] text-muted-foreground">
              {data.memory.toneNotes || 'Sin notas de tono'}
            </p>
          </>
        )}

        {data.kind === 'agent' && data.agentMeta && (
          <>
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  'rounded-md border border-orange-400/35 px-2 py-0.5 text-[10px] font-medium text-orange-900 dark:text-orange-100',
                )}
              >
                {data.agentMeta.tag}
              </span>
              <button
                type="button"
                className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[10px] text-foreground transition-colors hover:bg-accent"
              >
                <Pencil className="size-3" />
                Editar
              </button>
            </div>
            <p className="line-clamp-2 text-[10px] text-muted-foreground">
              {data.agentMeta.shortDescription}
            </p>
          </>
        )}

        {data.kind === 'knowledge' && data.knowledge && (
          <>
            <p className="truncate font-medium text-amber-900 dark:text-amber-100">
              {data.knowledge.displayName || data.knowledge.kbId}
            </p>
            <p className="text-[10px] text-muted-foreground">
              Estado: {data.knowledge.indexStatus}
            </p>
          </>
        )}

        {data.kind === 'database' && data.database && (
          <>
            <p className="truncate font-mono text-[10px] text-purple-800 dark:text-fuchsia-100">
              {data.database.connectionLabel}
            </p>
            <p className="text-[10px] text-muted-foreground">
              Tabla: {data.database.table}
            </p>
          </>
        )}

        {data.kind === 'api' && data.api && (
          <>
            <p className="truncate font-mono text-[10px] text-sky-800 dark:text-cyan-100">
              {data.api.method} ·{' '}
              {data.api.endpoint.replace(/^https?:\/\//, '').slice(0, 28)}…
            </p>
            <p className="text-[10px] text-muted-foreground">Integración activa</p>
          </>
        )}

        {data.kind === 'static' && data.staticData && (
          <>
            <p className="truncate text-teal-800 dark:text-teal-100">
              {data.staticData.displayName || 'Mapa estático'}
            </p>
            <p className="font-mono text-[10px] text-muted-foreground line-clamp-1">
              {data.staticData.kv}
            </p>
          </>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!size-3 !border-2 !border-border !bg-muted"
      />
    </div>
  );
}

export const FlowCanvasNode = memo(OrchestrationNodeFn);
