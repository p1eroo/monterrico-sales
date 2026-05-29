import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BotFlowNodeType, StartNodeConfig } from '../types';

export default function StartNode({ data, selected }: NodeProps<BotFlowNodeType>) {
  const config = data.config as StartNodeConfig;

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div
          className={cn(
            'w-[220px] rounded-lg border-2 border-emerald-500/40 bg-card shadow-sm transition-all',
            selected && 'ring-2 ring-emerald-500/50',
          )}
        >
          <div className="h-1 rounded-t-lg bg-emerald-500/15" />

          <div className="flex items-center gap-2 px-3 py-2">
            <svg className="size-6 text-emerald-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">INICIO</span>
          </div>

          <div className="border-t border-border/50 px-3 py-2">
            <p className="text-[10px] font-semibold text-emerald-700">Description</p>
            <div className="mt-1 rounded bg-muted/30 p-2">
              <p className="text-[11px] leading-relaxed line-clamp-3">
                {config?.description || data.label}
              </p>
            </div>
          </div>

          <div className="border-t border-border/50 px-3 py-2">
            <p className="text-[10px] font-semibold text-emerald-700">Status</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{data.enabled ? 'Active' : 'Disabled'}</p>
          </div>

          <div className="border-t border-border/50 px-3 py-1.5">
            <button onClick={() => {}} className="flex w-full items-center justify-center gap-1 rounded-md py-1.5 text-[10px] text-muted-foreground hover:bg-muted/60 transition-colors">
              <Settings className="size-3" />
              More Options
            </button>
          </div>
        </div>

        <Handle type="source" position={Position.Right} className="!size-2.5 !border-2 !border-emerald-500/50 !bg-emerald-500" />
      </div>
    </div>
  );
}
