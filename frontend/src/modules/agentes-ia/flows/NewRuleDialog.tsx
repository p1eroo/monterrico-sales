import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAgentesIaStore } from '../store';
import { toast } from 'sonner';

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

export function NewRuleDialog({ open, onOpenChange }: Props) {
  const addRouterRule = useAgentesIaStore((s) => s.addRouterRule);
  const agents = useAgentesIaStore((s) => s.agents);
  const [title, setTitle] = useState('');
  const [conditions, setConditions] = useState('');
  const [priority, setPriority] = useState('50');
  const [agentName, setAgentName] = useState(agents[0]?.name ?? '');
  const [status, setStatus] = useState<'activo' | 'inactivo'>('activo');

  function reset() {
    setTitle('');
    setConditions('');
    setPriority('50');
    setAgentName(agents[0]?.name ?? '');
    setStatus('activo');
  }

  function handleSave() {
    if (!title.trim() || !conditions.trim()) {
      toast.error('Nombre y condiciones son obligatorios');
      return;
    }
    const p = parseInt(priority, 10);
    addRouterRule({
      title: title.trim(),
      conditions: conditions.trim(),
      priority: Number.isFinite(p) ? p : 50,
      agentName: agentName || agents[0]?.name || '—',
      status,
    });
    toast.success('Regla creada');
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva regla de enrutamiento</DialogTitle>
          <DialogDescription>
            Prioridad numérica más baja = evaluación más temprana. Las
            condiciones admiten expresiones demo estilo política.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="rule-name">Nombre</Label>
            <Input
              id="rule-name"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Identificador legible"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rule-cond">Condiciones</Label>
            <Textarea
              id="rule-cond"
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
              rows={4}
              placeholder={`Ej.: intent = soporte AND confidence < 0.6\nO: channel IN {email, chat} AND segment = smb`}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
            <div className="grid gap-2">
              <Label htmlFor="rule-prio">Prioridad</Label>
              <Input
                id="rule-prio"
                type="number"
                min={1}
                max={99}
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Estado</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as 'activo' | 'inactivo')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Agente destino</Label>
            <Select value={agentName} onValueChange={setAgentName}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.name}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-[#13944C] hover:bg-[#0f7a3d]"
            onClick={handleSave}
          >
            Guardar regla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
