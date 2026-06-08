import { type LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Bot,
  Brain,
  BookOpen,
  Library,
  MessageCircle,
  BarChart3,
  ScrollText,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AutomationSection } from './types';

interface SidebarItem {
  key: AutomationSection;
  icon: LucideIcon;
  label: string;
}

const SECTIONS: SidebarItem[] = [
  { key: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { key: 'agentes', icon: Bot, label: 'Agentes' },
  { key: 'cerebro', icon: Brain, label: 'Cerebro IA' },
  { key: 'entrenamiento', icon: BookOpen, label: 'Entrenamiento' },
  { key: 'conocimiento', icon: Library, label: 'Conocimiento' },
  { key: 'conversaciones', icon: MessageCircle, label: 'Conversaciones' },
  { key: 'estadisticas', icon: BarChart3, label: 'Estadísticas' },
  { key: 'logs', icon: ScrollText, label: 'Logs' },
  { key: 'configuracion', icon: Settings, label: 'Configuración' },
];

export default function AutomationSidebar({
  activeSection,
  onSelect,
}: {
  activeSection: AutomationSection;
  onSelect: (section: AutomationSection) => void;
}) {
  return (
    <aside className="flex w-[200px] shrink-0 flex-col border-r border-muted bg-card py-3">
      <nav className="flex flex-col gap-0.5 px-2">
        {SECTIONS.map((item) => (
          <button
            key={item.key}
            onClick={() => onSelect(item.key)}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors text-left',
              activeSection === item.key
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <item.icon className="size-4 shrink-0" />
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
