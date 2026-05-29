import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BotFlowNodeType, MessageNodeConfig } from '../types';

export default function MessageNode({ data, selected }: NodeProps<BotFlowNodeType>) {
  const config = data.config as MessageNodeConfig;

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div
          className={cn(
            'w-[220px] rounded-lg border-2 border-blue-500/40 bg-card shadow-sm transition-all',
            selected && 'ring-2 ring-blue-500/50',
          )}
        >
          <div className="h-1 rounded-t-lg bg-blue-500/15" />

          <div className="flex items-center gap-2 px-3 py-2">
            <svg className="size-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">MENSAJE</span>
          </div>

          <div className="border-t border-border/50 px-3 py-2">
            <p className="text-[10px] font-semibold text-blue-700">Message</p>
            <div className="mt-1 rounded bg-muted/30 p-2">
              <p className="text-[11px] leading-relaxed line-clamp-3">
                {config?.text || ''}
              </p>
            </div>
          </div>

          <div className="border-t border-border/50 px-3 py-2">
            <p className="text-[10px] font-semibold text-blue-700">Delay</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{config?.delay || 0}s</p>
          </div>

          <div className="border-t border-border/50 px-3 py-1.5">
            <button onClick={() => {}} className="flex w-full items-center justify-center gap-1 rounded-md py-1.5 text-[10px] text-muted-foreground hover:bg-muted/60 transition-colors">
              <Settings className="size-3" />
              More Options
            </button>
          </div>
        </div>

        <Handle type="target" position={Position.Left} className="!size-2.5 !border-2 !border-blue-500/50 !bg-blue-500" />
        <Handle type="source" position={Position.Right} className="!size-2.5 !border-2 !border-blue-500/50 !bg-blue-500" />
      </div>
    </div>
  );
}
