import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, ExternalLink } from 'lucide-react';

type ConvStatus = 'active' | 'paused' | 'completed' | 'failed' | 'handoff';

const CONVERSATIONS = [
  { contact: 'Carlos Mendoza', phone: '+51 999 111 222', status: 'active' as ConvStatus, node: 'Preguntar nombre', lastMsg: 'Sí, me interesa', lastInteraction: '2 min ago' },
  { contact: 'María López', phone: '+51 988 333 444', status: 'active' as ConvStatus, node: 'Consultar vehículo', lastMsg: 'Tengo un Toyota 2019', lastInteraction: '5 min ago' },
  { contact: 'José García', phone: '+51 977 555 666', status: 'paused' as ConvStatus, node: 'Mensaje bienvenida', lastMsg: 'OK, gracias', lastInteraction: '1 hr ago' },
  { contact: 'Ana Torres', phone: '+51 966 777 888', status: 'completed' as ConvStatus, node: 'Fin del flujo', lastMsg: 'Gracias!', lastInteraction: '3 hr ago' },
  { contact: 'Pedro Sánchez', phone: '+51 955 999 000', status: 'handoff' as ConvStatus, node: 'Derivar a operador', lastMsg: 'Necesito ayuda', lastInteraction: '30 min ago' },
  { contact: 'Laura Díaz', phone: '+51 944 111 222', status: 'active' as ConvStatus, node: 'Extraer datos', lastMsg: 'Mi placa es ABC-123', lastInteraction: '8 min ago' },
  { contact: 'Roberto Castro', phone: '+51 933 333 444', status: 'failed' as ConvStatus, node: 'Preguntar interés', lastMsg: 'No entiendo', lastInteraction: '2 hr ago' },
  { contact: 'Daniela Ruiz', phone: '+51 922 555 666', status: 'completed' as ConvStatus, node: 'Fin del flujo', lastMsg: 'Sí, quiero afiliarme', lastInteraction: '45 min ago' },
];

const STATUS_STYLES: Record<ConvStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-amber-100 text-amber-700',
  completed: 'bg-blue-100 text-blue-700',
  failed: 'bg-red-100 text-red-700',
  handoff: 'bg-violet-100 text-violet-700',
};

const TABS = ['All', 'Active', 'Paused', 'Completed', 'Handoff', 'Error'] as const;

export default function BotConversationsView() {
  const [tab, setTab] = useState('All');

  const filtered = tab === 'All'
    ? CONVERSATIONS
    : CONVERSATIONS.filter((c) => {
        if (tab === 'Error') return c.status === 'failed';
        return c.status === tab.toLowerCase();
      });

  return (
    <div className="flex flex-col h-full p-6 gap-4 overflow-y-auto">
      
      <div className="flex items-center gap-2 border-b pb-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors',
              tab === t
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground text-xs">
              <th className="text-left p-3 font-medium">Contact</th>
              <th className="text-left p-3 font-medium">Phone</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium">Current node</th>
              <th className="text-left p-3 font-medium">Last message</th>
              <th className="text-left p-3 font-medium">Last interaction</th>
              <th className="text-left p-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.contact} className="border-b last:border-0">
                <td className="p-3 font-medium">{c.contact}</td>
                <td className="p-3 text-xs text-muted-foreground">{c.phone}</td>
                <td className="p-3">
                  <Badge className={cn('text-xs', STATUS_STYLES[c.status])}>{c.status}</Badge>
                </td>
                <td className="p-3 text-xs">{c.node}</td>
                <td className="p-3 text-xs text-muted-foreground max-w-[140px] truncate">{c.lastMsg}</td>
                <td className="p-3 text-xs text-muted-foreground">{c.lastInteraction}</td>
                <td className="p-3">
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" disabled>
                    <ExternalLink className="size-3" /> Open
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
