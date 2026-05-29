import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { BotFlowNodeType } from '../types';

export default function StartNode({ data, selected }: NodeProps<BotFlowNodeType>) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div
          className={cn(
            'flex flex-col items-center gap-1.5 rounded-xl border-2 border-emerald-500/40 bg-card px-4 py-3 shadow-sm transition-all w-[120px]',
            selected && 'ring-2 ring-emerald-500/50',
          )}
        >
          <div className="flex size-14 items-center justify-center text-emerald-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Inicio</p>
        </div>
        <Handle type="source" position={Position.Right} className="!size-2.5 !border-2 !border-emerald-500/50 !bg-emerald-500" />
      </div>
      <p className="mt-1 max-w-[120px] truncate text-center text-xs text-muted-foreground">{data.label}</p>
    </div>
  );
}
