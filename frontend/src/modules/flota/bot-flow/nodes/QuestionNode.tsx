import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { BotFlowNodeType } from '../types';

export default function QuestionNode({ data, selected }: NodeProps<BotFlowNodeType>) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div
          className={cn(
            'flex flex-col items-center gap-1.5 rounded-xl border-2 border-amber-500/40 bg-card px-4 py-3 shadow-sm transition-all w-[120px]',
            selected && 'ring-2 ring-amber-500/50',
          )}
        >
          <div className="flex size-14 items-center justify-center text-amber-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Pregunta</p>
        </div>
        <Handle type="target" position={Position.Left} className="!size-2.5 !border-2 !border-amber-500/50 !bg-amber-500" />
        <Handle type="source" position={Position.Right} className="!size-2.5 !border-2 !border-amber-500/50 !bg-amber-500" />
      </div>
      <p className="mt-1 max-w-[120px] truncate text-center text-xs text-muted-foreground">{data.label}</p>
    </div>
  );
}
