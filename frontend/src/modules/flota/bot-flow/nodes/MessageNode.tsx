import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { BotFlowNodeType, MessageNodeConfig } from '../types';

export default function MessageNode({ data, selected }: NodeProps<BotFlowNodeType>) {
  const config = (data.config || { text: '', attachments: [], delay: 0 }) as MessageNodeConfig;
  return (
    <div className={cn('min-w-[220px] rounded-xl border-2 border-blue-500/40 bg-card shadow-lg transition-all', selected && 'ring-2 ring-blue-500/50 shadow-blue-500/20')}>
      <div className="flex items-center gap-2 rounded-t-[10px] bg-gradient-to-r from-blue-500/20 to-sky-500/10 px-3 py-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-700">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700">Mensaje</p>
          <p className="truncate text-xs font-semibold">{data.label}</p>
        </div>
      </div>
      <div className="space-y-1.5 px-3 py-2.5">
        <p className="line-clamp-3 text-[11px] text-muted-foreground">{config.text || 'Sin contenido'}</p>
        {config.delay > 0 && (
          <span className="inline-flex items-center rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
            ⏱ {config.delay}s
          </span>
        )}
      </div>
      <Handle type="target" position={Position.Left} className="!size-3 !border-2 !border-blue-500/50 !bg-blue-500" />
      <Handle type="source" position={Position.Right} className="!size-3 !border-2 !border-blue-500/50 !bg-blue-500" />
    </div>
  );
}
