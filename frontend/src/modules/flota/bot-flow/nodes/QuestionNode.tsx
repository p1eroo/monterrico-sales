import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { BotFlowNodeType, QuestionNodeConfig } from '../types';

export default function QuestionNode({ data, selected }: NodeProps<BotFlowNodeType>) {
  const config = (data.config || { text: '', field_key: '', field_type: 'text', use_ai_extraction: false, extraction_schema: '{}', fallback_message: '', max_attempts: 3 }) as QuestionNodeConfig;
  return (
    <div className={cn('min-w-[240px] rounded-xl border-2 border-amber-500/40 bg-card shadow-lg transition-all', selected && 'ring-2 ring-amber-500/50 shadow-amber-500/20')}>
      <div className="flex items-center gap-2 rounded-t-[10px] bg-gradient-to-r from-amber-500/20 to-yellow-500/10 px-3 py-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-700">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Pregunta</p>
          <p className="truncate text-xs font-semibold">{data.label}</p>
        </div>
      </div>
      <div className="space-y-1.5 px-3 py-2.5">
        <p className="line-clamp-2 text-[11px] text-muted-foreground">{config.text || 'Sin pregunta'}</p>
        <div className="flex flex-wrap gap-1">
          {config.field_key && (
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
              {config.field_key}
            </span>
          )}
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {config.field_type}
          </span>
          {config.use_ai_extraction && (
            <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-medium text-cyan-700">IA</span>
          )}
        </div>
      </div>
      <Handle type="target" position={Position.Left} className="!size-3 !border-2 !border-amber-500/50 !bg-amber-500" />
      <Handle type="source" position={Position.Right} className="!size-3 !border-2 !border-amber-500/50 !bg-amber-500" />
    </div>
  );
}
