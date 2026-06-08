import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { Search, BookText } from 'lucide-react';

const BLOCKS = [
  { title: 'Requisitos de afiliación', preview: 'Documentos necesarios: DNI vigente, licencia de conducir, SOAT al día, revisión técnica vigente...', category: 'Proceso', priority: 'high' as const, active: true },
  { title: 'Preguntas frecuentes', preview: '¿Cuánto tiempo tarda la afiliación? Aproximadamente 24 horas hábiles una vez presentados todos los documentos...', category: 'FAQ', priority: 'medium' as const, active: true },
  { title: 'Políticas comerciales', preview: 'Las tarifas de comisión se establecen según el plan contratado. El conductor acepta los términos y condiciones...', category: 'Legal', priority: 'high' as const, active: true },
  { title: 'Horarios de atención', preview: 'Nuestro horario de atención es de lunes a viernes de 8:00 a 18:00 y sábados de 9:00 a 13:00...', category: 'General', priority: 'low' as const, active: false },
  { title: 'Restricciones', preview: 'No se aceptan conductores con antecedentes penales ni vehículos con más de 10 años de antigüedad...', category: 'Política', priority: 'high' as const, active: true },
  { title: 'Respuestas aprobadas', preview: 'Listado de respuestas pre-aprobadas para consultas comunes sobre el servicio de Taxi Monterrico...', category: 'FAQ', priority: 'medium' as const, active: true },
];

const PRIORITY_CLASS: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-blue-100 text-blue-700',
};

export default function BotKnowledgeBase() {
  const [search, setSearch] = useState('');

  const filtered = BLOCKS.filter((b) =>
    b.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col h-full p-6 gap-4 overflow-y-auto">
      
      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search blocks..."
          className="h-9 pl-9 text-xs"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((block) => (
          <div key={block.title} className="rounded-lg border bg-card p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-semibold">{block.title}</h4>
              <Switch checked={block.active} disabled className="shrink-0 opacity-60" />
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{block.preview}</p>
            <div className="flex items-center gap-2 pt-1">
              <Badge variant="outline" className="text-[10px]">{block.category}</Badge>
              <Badge className={cn('text-[10px]', PRIORITY_CLASS[block.priority])}>
                {block.priority}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

