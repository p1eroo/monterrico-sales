import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { BotFlowNodeType, EndNodeConfig } from '../types';

export default function EndNode({ data, selected }: NodeProps<BotFlowNodeType>) {
  const config = (data.config || { message: '', session_status: 'completed' }) as EndNodeConfig;
  return (
    <div className={cn('min-w-[200px] rounded-xl border-2 border-slate-400/40 bg-card shadow-lg transition-all', selected && 'ring-2 ring-slate-400/50 shadow-slate-400/20')}>
      <div className="flex items-center gap-2 rounded-t-[10px] bg-gradient-to-r from-slate-500/20 to-gray-500/10 px-3 py-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-slate-500/20 text-slate-700">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Fin</p>
          <p className="truncate text-xs font-semibold">{data.label}</p>
        </div>
      </div>
      <div className="space-y-1.5 px-3 py-2.5">
        {config.message && (
          <p className="text-[11px] text-muted-foreground">{config.message}</p>
        )}
        <span className="rounded bg-slate-500/10 px-1.5 py-0.5 text-[10px] text-slate-700">
          {config.session_status === 'completed' ? 'Completado' : config.session_status}
        </span>
      </div>
      <Handle type="target" position={Position.Left} className="!size-3 !border-2 !border-slate-400/50 !bg-slate-400" />
    </div>
  );
}
