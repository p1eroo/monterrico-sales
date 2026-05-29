import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BotFlowNodeType, QuestionNodeConfig } from '../types';

export default function QuestionNode({ data, selected }: NodeProps<BotFlowNodeType>) {
  const config = data.config as QuestionNodeConfig;

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div
          className={cn(
            'w-[220px] rounded-lg border-2 border-amber-500/40 bg-card shadow-sm transition-all',
            selected && 'ring-2 ring-amber-500/50',
          )}
        >
          <div className="h-1 rounded-t-lg bg-amber-500/15" />

          <div className="flex items-center gap-2 px-3 py-2">
            <svg className="size-6 text-amber-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">PREGUNTA</span>
          </div>

          <div className="border-t border-border/50 px-3 py-2">
            <p className="text-[10px] font-semibold text-amber-700">Question</p>
            <div className="mt-1 rounded bg-muted/30 p-2">
              <p className="text-[11px] leading-relaxed line-clamp-2">
                {config?.text || ''}
              </p>
            </div>
          </div>

          <div className="border-t border-border/50 px-3 py-2">
            <p className="text-[10px] font-semibold text-amber-700">Max attempts</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{String(config?.maxAttempts ?? config?.max_attempts ?? 2)}</p>
          </div>

          <div className="border-t border-border/50 px-3 py-1.5">
            <button onClick={() => {}} className="flex w-full items-center justify-center gap-1 rounded-md py-1.5 text-[10px] text-muted-foreground hover:bg-muted/60 transition-colors">
              <Settings className="size-3" />
              More Options
            </button>
          </div>
        </div>

        <Handle type="target" position={Position.Left} className="!size-2.5 !border-2 !border-amber-500/50 !bg-amber-500" />
        <Handle type="source" position={Position.Right} className="!size-2.5 !border-2 !border-amber-500/50 !bg-amber-500" />
      </div>
    </div>
  );
}
