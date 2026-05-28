import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { BotFlowNodeType, ConditionNodeConfig } from '../types';

export default function ConditionNode({ data, selected }: NodeProps<BotFlowNodeType>) {
  const config = (data.config || { rules: [] }) as ConditionNodeConfig;
  const rules = config.rules ?? [];
  return (
    <div className={cn('min-w-[220px] rounded-xl border-2 border-purple-500/40 bg-card shadow-lg transition-all', selected && 'ring-2 ring-purple-500/50 shadow-purple-500/20')}>
      <div className="flex items-center gap-2 rounded-t-[10px] bg-gradient-to-r from-purple-500/20 to-fuchsia-500/10 px-3 py-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-purple-500/20 text-purple-700">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-purple-700">Condición</p>
          <p className="truncate text-xs font-semibold">{data.label}</p>
        </div>
      </div>
      <div className="space-y-1.5 px-3 py-2.5">
        {rules.length === 0 ? (
          <p className="text-[11px] italic text-muted-foreground">Sin reglas</p>
        ) : (
          rules.map((rule) => (
            <div key={rule.id} className="flex items-center gap-1.5 rounded bg-purple-500/5 px-2 py-1 text-[10px]">
              <span className="font-medium text-purple-700">{rule.output_label || '?'}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{rule.operator}</span>
              <span className="text-muted-foreground">·</span>
              <span className="truncate text-foreground">{rule.field_key} {rule.value}</span>
            </div>
          ))
        )}
      </div>
      <Handle type="target" position={Position.Left} className="!size-3 !border-2 !border-purple-500/50 !bg-purple-500" />
      {rules.map((rule, i) => (
        <Handle
          key={rule.id}
          type="source"
          position={Position.Right}
          id={`out-${i}`}
          style={{ top: `${((i + 1) / (rules.length + 1)) * 100}%` }}
          className={cn(
            '!size-3 !border-2 !border-purple-500/50 !bg-purple-500',
          )}
        />
      ))}
    </div>
  );
}
