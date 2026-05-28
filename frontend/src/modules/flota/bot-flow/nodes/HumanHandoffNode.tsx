import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { BotFlowNodeType, HumanHandoffNodeConfig } from '../types';

export default function HumanHandoffNode({ data, selected }: NodeProps<BotFlowNodeType>) {
  const config = (data.config || { message: '', queue: '', operator: '', tag: '' }) as HumanHandoffNodeConfig;
  return (
    <div className={cn('min-w-[220px] rounded-xl border-2 border-pink-500/40 bg-card shadow-lg transition-all', selected && 'ring-2 ring-pink-500/50 shadow-pink-500/20')}>
      <div className="flex items-center gap-2 rounded-t-[10px] bg-gradient-to-r from-pink-500/20 to-rose-500/10 px-3 py-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-pink-500/20 text-pink-700">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/></svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-pink-700">Derivar a humano</p>
          <p className="truncate text-xs font-semibold">{data.label}</p>
        </div>
      </div>
      <div className="space-y-1.5 px-3 py-2.5">
        <p className="line-clamp-2 text-[10px] text-muted-foreground">{config.message || 'Sin mensaje'}</p>
        {(config.queue || config.operator) && (
          <span className="rounded bg-pink-500/10 px-1.5 py-0.5 text-[10px] font-medium text-pink-700">
            {config.queue || config.operator}
          </span>
        )}
      </div>
      <Handle type="target" position={Position.Left} className="!size-3 !border-2 !border-pink-500/50 !bg-pink-500" />
      <Handle type="source" position={Position.Right} className="!size-3 !border-2 !border-pink-500/50 !bg-pink-500" />
    </div>
  );
}
