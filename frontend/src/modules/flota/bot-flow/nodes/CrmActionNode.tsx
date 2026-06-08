import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BotFlowNodeType, CrmActionNodeConfig } from '../types';

export default function CrmActionNode({ data, selected }: NodeProps<BotFlowNodeType>) {
  const config = data.config as CrmActionNodeConfig;

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div
          className={cn(
            'w-[220px] rounded-lg border-2 border-cyan-500/40 bg-card shadow-sm transition-all',
            selected && 'ring-2 ring-cyan-500/50',
          )}
        >
          <div className="h-1 rounded-t-lg bg-cyan-500/15" />

          <div className="flex items-center gap-2 px-3 py-2">
            <svg className="size-6 text-cyan-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-700">ACCIÓN CRM</span>
          </div>

          <div className="border-t border-border/50 px-3 py-2">
            <p className="text-[10px] font-semibold text-cyan-700">Action</p>
            <div className="mt-1 rounded bg-muted/30 p-2">
              <p className="text-[11px] leading-relaxed">
                {config?.action_type ?? config?.actionType ?? ''}
              </p>
            </div>
          </div>

          <div className="border-t border-border/50 px-3 py-2">
            <p className="text-[10px] font-semibold text-cyan-700">Payload</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{config?.payload ? String(config.payload).slice(0, 20) : ''}</p>
          </div>

          <div className="border-t border-border/50 px-3 py-1.5">
            <button onClick={() => {}} className="flex w-full items-center justify-center gap-1 rounded-md py-1.5 text-[10px] text-muted-foreground hover:bg-muted/60 transition-colors">
              <Settings className="size-3" />
              More Options
            </button>
          </div>
        </div>

        <Handle type="target" position={Position.Left} className="!size-2.5 !border-2 !border-cyan-500/50 !bg-cyan-500" />
        <Handle type="source" position={Position.Right} className="!size-2.5 !border-2 !border-cyan-500/50 !bg-cyan-500" />
      </div>
    </div>
  );
}
