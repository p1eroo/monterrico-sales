import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { BotFlowNodeType, CrmActionNodeConfig } from '../types';

const ACTION_LABELS: Record<string, string> = {
  add_tag: 'Agregar etiqueta',
  remove_tag: 'Quitar etiqueta',
  assign_operator: 'Asignar operador',
  update_contact: 'Actualizar contacto',
  update_conversation_status: 'Cambiar estado',
  create_task: 'Crear tarea',
};

export default function CrmActionNode({ data, selected }: NodeProps<BotFlowNodeType>) {
  const config = (data.config || { action_type: 'add_tag', payload: '{}' }) as CrmActionNodeConfig;
  return (
    <div className={cn('min-w-[220px] rounded-xl border-2 border-rose-500/40 bg-card shadow-lg transition-all', selected && 'ring-2 ring-rose-500/50 shadow-rose-500/20')}>
      <div className="flex items-center gap-2 rounded-t-[10px] bg-gradient-to-r from-rose-500/20 to-red-500/10 px-3 py-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-rose-500/20 text-rose-700">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700">Acción CRM</p>
          <p className="truncate text-xs font-semibold">{data.label}</p>
        </div>
      </div>
      <div className="px-3 py-2">
        <span className="rounded bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-700">
          {ACTION_LABELS[config.action_type] || config.action_type}
        </span>
      </div>
      <Handle type="target" position={Position.Left} className="!size-3 !border-2 !border-rose-500/50 !bg-rose-500" />
      <Handle type="source" position={Position.Right} className="!size-3 !border-2 !border-rose-500/50 !bg-rose-500" />
    </div>
  );
}
