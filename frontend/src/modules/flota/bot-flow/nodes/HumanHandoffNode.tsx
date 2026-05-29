import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { BotFlowNodeType } from '../types';

export default function HumanHandoffNode({ data, selected }: NodeProps<BotFlowNodeType>) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div
          className={cn(
            'flex flex-col items-center gap-1.5 rounded-xl border-2 border-orange-500/40 bg-card px-4 py-3 shadow-sm transition-all w-[120px]',
            selected && 'ring-2 ring-orange-500/50',
          )}
        >
          <div className="flex size-14 items-center justify-center text-orange-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/></svg>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-orange-700">Humano</p>
        </div>
        <Handle type="target" position={Position.Left} className="!size-2.5 !border-2 !border-orange-500/50 !bg-orange-500" />
        <Handle type="source" position={Position.Right} className="!size-2.5 !border-2 !border-orange-500/50 !bg-orange-500" />
      </div>
      <p className="mt-1 max-w-[120px] truncate text-center text-xs text-muted-foreground">{data.label}</p>
    </div>
  );
}
