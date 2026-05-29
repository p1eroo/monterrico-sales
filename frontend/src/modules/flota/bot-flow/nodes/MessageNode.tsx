import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { BotFlowNodeType } from '../types';

export default function MessageNode({ data, selected }: NodeProps<BotFlowNodeType>) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div
          className={cn(
            'flex flex-col items-center gap-1.5 rounded-xl border-2 border-blue-500/40 bg-card px-4 py-3 shadow-sm transition-all w-[120px]',
            selected && 'ring-2 ring-blue-500/50',
          )}
        >
          <div className="flex size-14 items-center justify-center text-blue-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Mensaje</p>
        </div>
        <Handle type="target" position={Position.Left} className="!size-2.5 !border-2 !border-blue-500/50 !bg-blue-500" />
        <Handle type="source" position={Position.Right} className="!size-2.5 !border-2 !border-blue-500/50 !bg-blue-500" />
      </div>
      <p className="mt-1 max-w-[120px] truncate text-center text-xs text-muted-foreground">{data.label}</p>
    </div>
  );
}
