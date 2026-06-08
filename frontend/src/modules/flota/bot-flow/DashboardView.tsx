import { cn } from '@/lib/utils';
import {
  Bot, MessageSquare, UserCheck, Target, TrendingUp,
  ArrowRightLeft, AlertTriangle, Zap,
} from 'lucide-react';

const KPIS = [
  { label: 'Total agents', value: '12', icon: Bot, color: 'text-blue-600 bg-blue-100' },
  { label: 'Active', value: '8', icon: Zap, color: 'text-emerald-600 bg-emerald-100' },
  { label: 'Conversations today', value: '342', icon: MessageSquare, color: 'text-violet-600 bg-violet-100' },
  { label: 'Leads captured', value: '189', icon: UserCheck, color: 'text-cyan-600 bg-cyan-100' },
  { label: 'Leads qualified', value: '94', icon: Target, color: 'text-indigo-600 bg-indigo-100' },
  { label: 'Auto resolution rate', value: '72%', icon: TrendingUp, color: 'text-green-600 bg-green-100' },
  { label: 'Handoff rate', value: '18%', icon: ArrowRightLeft, color: 'text-amber-600 bg-amber-100' },
  { label: 'Errors today', value: '3', icon: AlertTriangle, color: 'text-red-600 bg-red-100' },
];

const TOP_AGENTS = [
  { name: 'Asistente Ventas', conversations: 98, resolved: 82, leads: 41, rate: '84%' },
  { name: 'Soporte Técnico', conversations: 76, resolved: 61, leads: 28, rate: '80%' },
  { name: 'Agente Afiliación', conversations: 54, resolved: 47, leads: 33, rate: '87%' },
];

export default function DashboardView() {
  return (
    <div className="flex flex-col h-full p-6 gap-6 overflow-y-auto">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {KPIS.map((kpi) => (
          <div key={kpi.label} className="rounded-lg border bg-card p-4 flex items-start gap-3">
            <div className={cn('rounded-md p-2 shrink-0', kpi.color)}>
              <kpi.icon className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{kpi.value}</p>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3">Agents with best performance</h3>
        <div className="rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-xs">
                <th className="text-left p-3 font-medium">Agent</th>
                <th className="text-left p-3 font-medium">Conversations</th>
                <th className="text-left p-3 font-medium">Resolved</th>
                <th className="text-left p-3 font-medium">Leads</th>
                <th className="text-left p-3 font-medium">Rate</th>
              </tr>
            </thead>
            <tbody>
              {TOP_AGENTS.map((a) => (
                <tr key={a.name} className="border-b last:border-0">
                  <td className="p-3 font-medium">{a.name}</td>
                  <td className="p-3">{a.conversations}</td>
                  <td className="p-3">{a.resolved}</td>
                  <td className="p-3">{a.leads}</td>
                  <td className="p-3 text-emerald-600 font-medium">{a.rate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
