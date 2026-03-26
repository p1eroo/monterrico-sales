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
import { Badge } from '@/components/ui/badge';
import type { AgentStatus } from '../mockData';
import { useAgentesIaStore } from '../store';
import { toast } from 'sonner';

const MODELS = [
  'gpt-4o-mini',
  'gpt-4o',
  'claude-3-5-sonnet',
  'claude-3-haiku',
];

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export function NewAgentDialog({ open, onOpenChange }: Props) {
  const addAgent = useAgentesIaStore((s) => s.addAgent);
  const [name, setName] = useState('');
  const [internalName, setInternalName] = useState('');
  const [description, setDescription] = useState('');
  const [purpose, setPurpose] = useState('');
  const [model, setModel] = useState(MODELS[0]);
  const [status, setStatus] = useState<AgentStatus>('borrador');
  const [tagsRaw, setTagsRaw] = useState('');

  function reset() {
    setName('');
    setInternalName('');
    setDescription('');
    setPurpose('');
    setModel(MODELS[0]);
    setStatus('borrador');
    setTagsRaw('');
  }

  function handleSave() {
    if (!name.trim() || !purpose.trim()) {
      toast.error('Nombre y propósito son obligatorios');
      return;
    }
    const tags = tagsRaw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    addAgent({
      name: name.trim(),
      internalName: internalName.trim() || name.trim().toLowerCase().replace(/\s+/g, '_'),
      description: description.trim() || '—',
      purpose: purpose.trim(),
      status,
      model,
      tags,
    });
    toast.success('Agente creado', { description: name.trim() });
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
      <DialogContent className="max-h-[min(90dvh,720px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo agente</DialogTitle>
          <DialogDescription>
            Define el comportamiento base. Podrás enlazar herramientas y flujos
            en el editor visual.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="agent-name">Nombre visible</Label>
            <Input
              id="agent-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="p. ej. Agente ventas — calificación"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="agent-internal">Nombre interno</Label>
            <Input
              id="agent-internal"
              value={internalName}
              onChange={(e) => setInternalName(e.target.value)}
              placeholder="slug_para_api_y_logs"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="agent-desc">Descripción</Label>
            <Textarea
              id="agent-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Resumen para el equipo de operaciones"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="agent-purpose">Propósito</Label>
            <Textarea
              id="agent-purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={2}
              placeholder="Qué problema resuelve y cuándo debe activarse"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
            <div className="grid gap-2">
              <Label>Modelo por defecto</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODELS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Estado</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as AgentStatus)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="borrador">Borrador</SelectItem>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="agent-tags">Etiquetas (separadas por coma)</Label>
            <Input
              id="agent-tags"
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="ventas, externo, calidad"
            />
            {tagsRaw && (
              <div className="flex flex-wrap gap-1">
                {tagsRaw
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean)
                  .map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px]">
                      {t}
                    </Badge>
                  ))}
              </div>
            )}
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
            Guardar agente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
