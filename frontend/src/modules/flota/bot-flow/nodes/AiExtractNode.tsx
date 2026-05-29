import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { BotFlowNodeType } from '../types';

export default function AiExtractNode({ data, selected }: NodeProps<BotFlowNodeType>) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div
          className={cn(
            'flex flex-col items-center gap-1.5 rounded-xl border-2 border-fuchsia-500/40 bg-card px-4 py-3 shadow-sm transition-all w-[120px]',
            selected && 'ring-2 ring-fuchsia-500/50',
          )}
        >
          <div className="flex size-14 items-center justify-center text-fuchsia-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a8 8 0 0 0-8 8c0 2.5 1.5 4.8 3 6.5V20a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3.5c1.5-1.7 3-4 3-6.5a8 8 0 0 0-8-8z"/><circle cx="12" cy="11" r="3"/></svg>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-700">IA Extract</p>
        </div>
        <Handle type="target" position={Position.Left} className="!size-2.5 !border-2 !border-fuchsia-500/50 !bg-fuchsia-500" />
        <Handle type="source" position={Position.Right} className="!size-2.5 !border-2 !border-fuchsia-500/50 !bg-fuchsia-500" />
      </div>
      <p className="mt-1 max-w-[120px] truncate text-center text-xs text-muted-foreground">{data.label}</p>
    </div>
  );
}
