import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, BookOpen } from 'lucide-react';

const INTENTS = [
  { name: 'quiere_bono', phrases: 8, fields: 'monto, fecha_vencimiento', status: 'active' as const },
  { name: 'consulta_requisitos', phrases: 5, fields: 'tipo_documento, edad', status: 'active' as const },
  { name: 'agendar_cita', phrases: 6, fields: 'fecha, hora, sucursal', status: 'active' as const },
  { name: 'reportar_problema', phrases: 4, fields: 'descripcion, prioridad', status: 'inactive' as const },
  { name: 'solicitar_info', phrases: 7, fields: 'tema, canal_preferido', status: 'active' as const },
];

export default function BotTrainingView() {
  const [search, setSearch] = useState('');

  const filtered = INTENTS.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col h-full p-6 gap-4 overflow-y-auto">
      
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter intents..."
            className="h-9 pl-9 text-xs"
          />
        </div>
        <Button variant="default" size="sm" className="gap-1.5" disabled>
          <Plus className="size-4" /> Add intent
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground text-xs">
              <th className="text-left p-3 font-medium">Intent name</th>
              <th className="text-left p-3 font-medium">Phrases</th>
              <th className="text-left p-3 font-medium">Capture fields</th>
              <th className="text-left p-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((intent) => (
              <tr key={intent.name} className="border-b last:border-0">
                <td className="p-3 font-mono text-xs font-medium">{intent.name}</td>
                <td className="p-3">{intent.phrases} phrases</td>
                <td className="p-3 text-xs text-muted-foreground">{intent.fields}</td>
                <td className="p-3">
                  <Badge
                    className={cn(
                      'text-xs',
                      intent.status === 'active'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-500',
                    )}
                  >
                    {intent.status}
                  </Badge>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-sm text-muted-foreground">
                  No intents match your search
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
