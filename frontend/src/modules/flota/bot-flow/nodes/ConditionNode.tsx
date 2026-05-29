import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { BotFlowNodeType, ConditionNodeConfig } from '../types';

export default function ConditionNode({ data, selected }: NodeProps<BotFlowNodeType>) {
  const config = (data.config || { rules: [] }) as ConditionNodeConfig;
  const rules = config.rules ?? [];
  const total = rules.length + 1;
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div
          className={cn(
            'flex flex-col items-center gap-1.5 rounded-xl border-2 border-violet-500/40 bg-card px-4 py-3 shadow-sm transition-all w-[120px]',
            selected && 'ring-2 ring-violet-500/50',
          )}
        >
          <div className="flex size-14 items-center justify-center text-violet-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700">Condición</p>
        </div>
        <Handle type="target" position={Position.Left} className="!size-2.5 !border-2 !border-violet-500/50 !bg-violet-500" />
        {rules.map((_rule, i) => {
          const top = ((i + 1) / total) * 100;
          return (
            <Handle
              key={rules[i]!.id}
              type="source"
              position={Position.Right}
              id={`out-${i}`}
              style={{ top: `${top}%` }}
              className="!size-2.5 !border-2 !border-violet-500/50 !bg-violet-500"
            />
          );
        })}
        {rules.map((rule, i) => {
          const top = ((i + 1) / total) * 100;
          const isYes = rule.output_label?.toLowerCase() === 'sí' || rule.output_label?.toLowerCase() === 'si' || rule.output_label?.toLowerCase() === 'yes' || rule.output_label?.toLowerCase() === 'true';
          return (
            <span
              key={`lbl-${rule.id}`}
              className={cn(
                'absolute right-0 translate-x-[14px] -translate-y-1/2 text-[10px] font-bold',
                isYes ? 'text-emerald-600' : 'text-muted-foreground',
              )}
              style={{ top: `${top}%` }}
            >
              {rule.output_label || '?'}
            </span>
          );
        })}
      </div>
      <p className="mt-1 max-w-[120px] truncate text-center text-xs text-muted-foreground">{data.label}</p>
    </div>
  );
}
