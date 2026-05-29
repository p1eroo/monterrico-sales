import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Settings } from 'lucide-react';
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
            'w-[220px] rounded-lg border-2 border-violet-500/40 bg-card shadow-sm transition-all',
            selected && 'ring-2 ring-violet-500/50',
          )}
        >
          <div className="h-1 rounded-t-lg bg-violet-500/15" />

          <div className="flex items-center gap-2 px-3 py-2">
            <svg className="size-6 text-violet-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
            <span className="text-[11px] font-bold uppercase tracking-wider text-violet-700">CONDICIÓN</span>
          </div>

          <div className="border-t border-border/50 px-3 py-2">
            <p className="text-[10px] font-semibold text-violet-700">Rules</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {rules.length > 0 ? rules.map((rule) => {
                const isYes = rule.output_label?.toLowerCase() === 'sí' || rule.output_label?.toLowerCase() === 'si' || rule.output_label?.toLowerCase() === 'yes' || rule.output_label?.toLowerCase() === 'true';
                return (
                  <span
                    key={rule.id}
                    className={cn(
                      'inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
                      isYes ? 'bg-emerald-500/15 text-emerald-600' : 'bg-muted/60 text-muted-foreground',
                    )}
                  >
                    {rule.output_label || '?'}
                  </span>
                );
              }) : (
                <span className="text-[11px] text-muted-foreground">Sin reglas</span>
              )}
            </div>
          </div>

          <div className="border-t border-border/50 px-3 py-2">
            <p className="text-[10px] font-semibold text-violet-700">Branches</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{rules.length} rule(s)</p>
          </div>

          <div className="border-t border-border/50 px-3 py-1.5">
            <button onClick={() => {}} className="flex w-full items-center justify-center gap-1 rounded-md py-1.5 text-[10px] text-muted-foreground hover:bg-muted/60 transition-colors">
              <Settings className="size-3" />
              More Options
            </button>
          </div>
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
    </div>
  );
}
