import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BotFlowNodeType, AiExtractNodeConfig } from '../types';

export default function AiExtractNode({ data, selected }: NodeProps<BotFlowNodeType>) {
  const config = data.config as AiExtractNodeConfig;

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div
          className={cn(
            'w-[220px] rounded-lg border-2 border-fuchsia-500/40 bg-card shadow-sm transition-all',
            selected && 'ring-2 ring-fuchsia-500/50',
          )}
        >
          <div className="h-1 rounded-t-lg bg-fuchsia-500/15" />

          <div className="flex items-center gap-2 px-3 py-2">
            <svg className="size-6 text-fuchsia-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a8 8 0 0 0-8 8c0 2.5 1.5 4.8 3 6.5V20a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3.5c1.5-1.7 3-4 3-6.5a8 8 0 0 0-8-8z"/><circle cx="12" cy="11" r="3"/></svg>
            <span className="text-[11px] font-bold uppercase tracking-wider text-fuchsia-700">EXTRAER IA</span>
          </div>

          <div className="border-t border-border/50 px-3 py-2">
            <p className="text-[10px] font-semibold text-fuchsia-700">Prompt</p>
            <div className="mt-1 rounded bg-muted/30 p-2">
              <p className="text-[11px] leading-relaxed line-clamp-2">
                {config?.prompt || ''}
              </p>
            </div>
          </div>

          <div className="border-t border-border/50 px-3 py-2">
            <p className="text-[10px] font-semibold text-fuchsia-700">Min confidence</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{String(config?.minConfidence ?? config?.min_confidence ?? 0.7)}</p>
          </div>

          <div className="border-t border-border/50 px-3 py-1.5">
            <button onClick={() => {}} className="flex w-full items-center justify-center gap-1 rounded-md py-1.5 text-[10px] text-muted-foreground hover:bg-muted/60 transition-colors">
              <Settings className="size-3" />
              More Options
            </button>
          </div>
        </div>

        <Handle type="target" position={Position.Left} className="!size-2.5 !border-2 !border-fuchsia-500/50 !bg-fuchsia-500" />
        <Handle type="source" position={Position.Right} className="!size-2.5 !border-2 !border-fuchsia-500/50 !bg-fuchsia-500" />
      </div>
    </div>
  );
}
