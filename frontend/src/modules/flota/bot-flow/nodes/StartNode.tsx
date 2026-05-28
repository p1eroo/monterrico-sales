import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { BotFlowNodeType, StartNodeConfig } from '../types';

export default function StartNode({ data, selected }: NodeProps<BotFlowNodeType>) {
  const config = (data.config || { name: '', description: '' }) as StartNodeConfig;
  return (
    <div className={cn('min-w-[200px] rounded-xl border-2 border-emerald-500/40 bg-card shadow-lg transition-all', selected && 'ring-2 ring-emerald-500/50 shadow-emerald-500/20')}>
      <div className="flex items-center gap-2 rounded-t-[10px] bg-gradient-to-r from-emerald-500/20 to-green-500/10 px-3 py-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-700">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Inicio</p>
          <p className="truncate text-xs font-semibold">{config.name || 'Sin nombre'}</p>
        </div>
      </div>
      {config.description && (
        <div className="px-3 py-2 text-[11px] text-muted-foreground">{config.description}</div>
      )}
      <Handle type="source" position={Position.Right} className="!size-3 !border-2 !border-emerald-500/50 !bg-emerald-500" />
    </div>
  );
}
