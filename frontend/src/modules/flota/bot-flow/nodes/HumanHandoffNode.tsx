import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BotFlowNodeType, HumanHandoffNodeConfig } from '../types';

export default function HumanHandoffNode({ data, selected }: NodeProps<BotFlowNodeType>) {
  const config = data.config as HumanHandoffNodeConfig;

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div
          className={cn(
            'w-[220px] rounded-lg border-2 border-orange-500/40 bg-card shadow-sm transition-all',
            selected && 'ring-2 ring-orange-500/50',
          )}
        >
          <div className="h-1 rounded-t-lg bg-orange-500/15" />

          <div className="flex items-center gap-2 px-3 py-2">
            <svg className="size-6 text-orange-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/></svg>
            <span className="text-[11px] font-bold uppercase tracking-wider text-orange-700">DERIVAR A HUMANO</span>
          </div>

          <div className="border-t border-border/50 px-3 py-2">
            <p className="text-[10px] font-semibold text-orange-700">Message</p>
            <div className="mt-1 rounded bg-muted/30 p-2">
              <p className="text-[11px] leading-relaxed line-clamp-2">
                {config?.message || ''}
              </p>
            </div>
          </div>

          <div className="border-t border-border/50 px-3 py-2">
            <p className="text-[10px] font-semibold text-orange-700">Queue</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{config?.queue || 'general'}</p>
          </div>

          <div className="border-t border-border/50 px-3 py-1.5">
            <button onClick={() => {}} className="flex w-full items-center justify-center gap-1 rounded-md py-1.5 text-[10px] text-muted-foreground hover:bg-muted/60 transition-colors">
              <Settings className="size-3" />
              More Options
            </button>
          </div>
        </div>

        <Handle type="target" position={Position.Left} className="!size-2.5 !border-2 !border-orange-500/50 !bg-orange-500" />
        <Handle type="source" position={Position.Right} className="!size-2.5 !border-2 !border-orange-500/50 !bg-orange-500" />
      </div>
    </div>
  );
}
