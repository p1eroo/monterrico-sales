import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ClipboardList, Search } from 'lucide-react';

type LogType = 'message_received' | 'node_executed' | 'data_extracted' | 'response_sent' | 'ai_result' | 'crm_action' | 'error';

interface LogEntry {
  ts: string;
  type: LogType;
  message: string;
  confidence?: number;
}

const LOGS: LogEntry[] = [
  { ts: '2025-05-29 10:32:15', type: 'message_received', message: 'Hola, quiero afiliarme' },
  { ts: '2025-05-29 10:32:16', type: 'node_executed', message: 'Node "Inicio" ejecutado', confidence: 1.0 },
  { ts: '2025-05-29 10:32:17', type: 'ai_result', message: 'Intención detectada: quiere_bono (confianza: 0.94)', confidence: 0.94 },
  { ts: '2025-05-29 10:32:18', type: 'response_sent', message: '¡Hola! Soy el asistente de Taxi Monterrico.' },
  { ts: '2025-05-29 10:32:20', type: 'data_extracted', message: 'Campo "nombreCompleto" extraído: Carlos Mendoza', confidence: 0.97 },
  { ts: '2025-05-29 10:32:25', type: 'node_executed', message: 'Node "Preguntar nombre" completado', confidence: 1.0 },
  { ts: '2025-05-29 10:32:30', type: 'error', message: 'Fallo al extraer campo "tieneVehiculo" - formato inválido' },
  { ts: '2025-05-29 10:32:32', type: 'crm_action', message: 'Contacto actualizado en CRM: etapa=Afiliado' },
  { ts: '2025-05-29 10:32:35', type: 'ai_result', message: 'Respuesta generada con prompt personalizado', confidence: 0.88 },
  { ts: '2025-05-29 10:32:40', type: 'message_received', message: 'Sí, tengo vehículo propio' },
  { ts: '2025-05-29 10:32:42', type: 'error', message: 'Timeout en llamada a API de OpenAI (3000ms)' },
  { ts: '2025-05-29 10:32:45', type: 'node_executed', message: 'Node "Fin del flujo" - sesión completada', confidence: 1.0 },
];

const TYPE_STYLES: Record<LogType, string> = {
  message_received: 'border-l-blue-400',
  node_executed: 'border-l-gray-400',
  data_extracted: 'border-l-cyan-400',
  response_sent: 'border-l-green-400',
  ai_result: 'border-l-purple-400',
  crm_action: 'border-l-orange-400',
  error: 'border-l-red-400 bg-red-50/50',
};

const LABELS: Record<LogType, string> = {
  message_received: 'Message Received',
  node_executed: 'Node Executed',
  data_extracted: 'Data Extracted',
  response_sent: 'Response Sent',
  ai_result: 'AI Result',
  crm_action: 'CRM Action',
  error: 'Error',
};

export default function BotLogsView() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const filtered = LOGS.filter((l) => {
    if (typeFilter && l.type !== typeFilter) return false;
    if (search && !l.message.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full p-6 gap-4 overflow-y-auto">
      
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search logs..."
            className="h-9 pl-9 text-xs"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-xs"
        >
          <option value="">All types</option>
          {Object.entries(LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <Input type="date" className="h-9 w-40 text-xs" disabled />
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground text-xs">
              <th className="text-left p-3 font-medium">Timestamp</th>
              <th className="text-left p-3 font-medium">Type</th>
              <th className="text-left p-3 font-medium">Message</th>
              <th className="text-left p-3 font-medium">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((log, i) => (
              <tr key={i} className={cn('border-b last:border-0 border-l-4', TYPE_STYLES[log.type])}>
                <td className="p-3 font-mono text-xs">{log.ts}</td>
                <td className="p-3">
                  <span className={cn(
                    'text-xs font-medium px-1.5 py-0.5 rounded',
                    log.type === 'error' ? 'bg-red-100 text-red-700' :
                    log.type === 'ai_result' ? 'bg-purple-100 text-purple-700' :
                    'bg-gray-100 text-gray-600',
                  )}>
                    {LABELS[log.type]}
                  </span>
                </td>
                <td className="p-3 text-xs">{log.message}</td>
                <td className="p-3 text-xs font-mono">
                  {log.confidence != null ? log.confidence.toFixed(2) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
