import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { BotFlowNodeType, AiExtractNodeConfig } from '../types';

export default function AiExtractNode({ data, selected }: NodeProps<BotFlowNodeType>) {
  const config = (data.config || { prompt: '', schema: '{}', min_confidence: 0.7, fallback_message: '' }) as AiExtractNodeConfig;
  return (
    <div className={cn('min-w-[220px] rounded-xl border-2 border-cyan-500/40 bg-card shadow-lg transition-all', selected && 'ring-2 ring-cyan-500/50 shadow-cyan-500/20')}>
      <div className="flex items-center gap-2 rounded-t-[10px] bg-gradient-to-r from-cyan-500/20 to-teal-500/10 px-3 py-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-700">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a8 8 0 0 0-8 8c0 2.5 1.5 4.8 3 6.5V20a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3.5c1.5-1.7 3-4 3-6.5a8 8 0 0 0-8-8z"/><circle cx="12" cy="11" r="3"/></svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-700">Extraer IA</p>
          <p className="truncate text-xs font-semibold">{data.label}</p>
        </div>
      </div>
      <div className="space-y-1.5 px-3 py-2.5">
        <p className="line-clamp-2 text-[10px] text-muted-foreground">{config.prompt || 'Sin prompt'}</p>
        <div className="flex flex-wrap gap-1">
          <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-medium text-cyan-700">
            conf. {(config.min_confidence * 100).toFixed(0)}%
          </span>
        </div>
      </div>
      <Handle type="target" position={Position.Left} className="!size-3 !border-2 !border-cyan-500/50 !bg-cyan-500" />
      <Handle type="source" position={Position.Right} className="!size-3 !border-2 !border-cyan-500/50 !bg-cyan-500" />
    </div>
  );
}
