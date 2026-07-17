import { useState, useMemo } from 'react';
import type { BotAgent, BotAgentStatus, BotChannel, BotBrainMode } from './types';
import { MOCK_AGENTS } from './mockAgents';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Play,
  Pause,
  Plus,
  Search,
  Settings2,
  LayoutList,
  BarChart3,
  Copy,
  Trash2,
} from 'lucide-react';
import { toast } from '@/lib/notify';

interface BotListViewProps {
  onEdit: (agent: BotAgent) => void;
  onNew: (data: { name: string; description: string; channel: BotChannel; brainMode: BotBrainMode }) => void;
}

const STATUS_CONFIG: Record<BotAgentStatus, { label: string; class: string }> = {
  active: { label: 'Activo', class: 'bg-emerald-100 text-emerald-700' },
  paused: { label: 'Pausado', class: 'bg-amber-100 text-amber-700' },
  draft: { label: 'Borrador', class: 'bg-gray-100 text-gray-700' },
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  webchat: 'Webchat',
  messenger: 'Messenger',
  all: 'Todos',
};

const BRAIN_LABELS: Record<string, string> = {
  flow_only: 'Solo flujo',
  flow_with_ai: 'Flujo + IA',
  ai_agent: 'Agente IA',
};

export default function BotListView({ onEdit, onNew }: BotListViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [agents, setAgents] = useState<BotAgent[]>(MOCK_AGENTS);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', channel: 'whatsapp' as BotChannel, brainMode: 'flow_only' as BotBrainMode });

  const filtered = useMemo(() => {
    let list = agents;
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter((a) => a.name.toLowerCase().includes(s) || a.description.toLowerCase().includes(s));
    }
    if (statusFilter !== 'all') {
      list = list.filter((a) => a.status === statusFilter);
    }
    return list;
  }, [agents, search, statusFilter]);

  const handleAction = (label: string) => {
    toast.success(`${label} (simulado con datos mock)`);
  };

  const toggleStatus = (agentId: string) => {
    setAgents((prev) =>
      prev.map((a) =>
        a.id === agentId
          ? { ...a, status: a.status === 'active' ? 'paused' : 'active' }
          : a,
      ),
    );
    const agent = agents.find((a) => a.id === agentId);
    toast.success(agent?.status === 'active' ? 'Agente pausado (mock)' : 'Agente activado (mock)');
  };

  const removeAgent = (agentId: string) => {
    setAgents((prev) => prev.filter((a) => a.id !== agentId));
    toast.success('Agente eliminado (mock)');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-3 border-b border-muted px-6 py-3 shrink-0">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar agente..."
              className="h-9 pl-9 text-xs"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-36 text-xs">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="paused">Pausados</SelectItem>
              <SelectItem value="draft">Borradores</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button className="gap-1.5 shrink-0" onClick={() => { setForm({ name: '', description: '', channel: 'whatsapp', brainMode: 'flow_only' }); setModalOpen(true); }}>
          <Plus className="size-4" /> Nuevo agente
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
            {search ? 'Sin resultados' : 'No hay agentes aún. Crea el primero.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((agent) => (
              <div
                key={agent.id}
                className="flex flex-col rounded-lg border bg-card p-4 shadow-sm transition-all hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <LayoutList className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold truncate">{agent.name}</span>
                      <Badge className={cn('text-xs font-medium shrink-0', STATUS_CONFIG[agent.status].class)}>
                        {STATUS_CONFIG[agent.status].label}
                      </Badge>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{agent.description}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                  <span>📱 {CHANNEL_LABELS[agent.channel]}</span>
                  <span>🧠 {BRAIN_LABELS[agent.brainMode]}</span>
                  {agent.activeConversations > 0 && (
                    <span>💬 {agent.activeConversations} activas</span>
                  )}
                  {agent.status === 'active' && (
                    <>
                      <span className="text-emerald-600">✓ {agent.conversionRate}% conv.</span>
                      <span className="text-amber-600">↗ {agent.handoffRate}% handoff</span>
                    </>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-1 border-t pt-3">
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => onEdit(agent)} title="Editar flujo">
                    <Settings2 className="size-4" />
                  </Button>
                  {agent.status === 'active' ? (
                    <Button variant="ghost" size="icon" className="size-8 text-amber-600" onClick={() => toggleStatus(agent.id)} title="Pausar">
                      <Pause className="size-4" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="icon" className="size-8 text-emerald-600" onClick={() => toggleStatus(agent.id)} title="Activar">
                      <Play className="size-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => handleAction('Simular')} title="Simular">
                    <BarChart3 className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => handleAction('Duplicar')} title="Duplicar">
                    <Copy className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => removeAgent(agent.id)} title="Eliminar">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo agente</DialogTitle>
            <DialogDescription>Completa la información básica del agente automatizado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Nombre *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Activación Bono Taxi"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Descripción</label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe el propósito del agente..."
                className="resize-none"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Canal</label>
                <Select value={form.channel} onValueChange={(v: any) => setForm({ ...form, channel: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="webchat">Webchat</SelectItem>
                    <SelectItem value="messenger">Messenger</SelectItem>
                    <SelectItem value="all">Todos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Modo cerebro</label>
                <Select value={form.brainMode} onValueChange={(v: any) => setForm({ ...form, brainMode: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flow_only">Solo flujo</SelectItem>
                    <SelectItem value="flow_with_ai">Flujo + IA</SelectItem>
                    <SelectItem value="ai_agent">Agente IA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => { if (!form.name.trim()) return; onNew(form); setModalOpen(false); }} disabled={!form.name.trim()}>
              Crear agente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
