import { useState } from 'react';
import {
  MessageSquare, Phone, Calendar, Mail, Paperclip, ClipboardList,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Contact, Opportunity, TaskAssociation } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ActivityFormDialog } from './ActivityFormDialog';
import { TaskFormDialog } from './TaskFormDialog';
import type { TaskFormResult } from './TaskFormDialog';

type TaskStatus = 'pendiente' | 'en_progreso' | 'completada' | 'vencida';
type TaskPriority = 'alta' | 'media' | 'baja';
type TaskType = 'llamada' | 'reunion' | 'correo' | 'whatsapp';

export interface QuickTask {
  id: string;
  title: string;
  status: TaskStatus;
  type?: TaskType;
  priority: TaskPriority;
  company?: string;
  startDate?: string;
  dueDate: string;
  startTime?: string;
  assignee: string;
  associations?: TaskAssociation[];
}

export interface QuickActivityDraft {
  type: 'nota' | 'llamada' | 'reunion' | 'correo';
  title: string;
  description: string;
  dueDate: string;
  startDate?: string;
  startTime?: string;
}

const actions = [
  { type: 'nota', icon: MessageSquare, label: 'Nota' },
  { type: 'llamada', icon: Phone, label: 'Llamada' },
  { type: 'reunion', icon: Calendar, label: 'Reunión' },
  { type: 'correo', icon: Mail, label: 'Correo' },
  { type: 'archivo', icon: Paperclip, label: 'Archivo' },
  { type: 'tarea', icon: ClipboardList, label: 'Tarea' },
];

interface QuickActionsWithDialogsProps {
  entityName: string;
  contacts?: Contact[];
  companies?: { name: string }[];
  opportunities?: Opportunity[];
  onTaskCreated?: (task: QuickTask) => void;
  onActivityCreated?: (activity: QuickActivityDraft) => void | Promise<void>;
  contactId?: string;
  excludeActions?: string[];
  inline?: boolean;
}

export function QuickActionsWithDialogs({
  entityName,
  contacts = [],
  companies = [],
  opportunities = [],
  onTaskCreated,
  onActivityCreated,
  excludeActions = [],
  inline = false,
}: QuickActionsWithDialogsProps) {
  const [activeDialog, setActiveDialog] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState('');

  const [activityDialogType, setActivityDialogType] = useState<'llamada' | 'reunion' | 'correo' | null>(null);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const visibleActions = actions.filter((action) => !excludeActions.includes(action.type));

  async function submitQuickAction() {
    if (activeDialog === 'nota') {
      const description = noteContent.trim();
      await Promise.resolve(onActivityCreated?.({
        type: 'nota',
        title: 'Nota',
        description,
        dueDate: new Date().toISOString().slice(0, 10),
      }));
      setNoteContent('');
      setActiveDialog(null);
      return;
    }
    const actionLabels: Record<string, string> = {
      nota: 'Nota agregada',
      archivo: 'Archivo adjuntado',
    };
    toast.success(actionLabels[activeDialog ?? ''] ?? 'Acción completada');
    setActiveDialog(null);
  }

  function handleTaskFormSave(data: TaskFormResult) {
    const companyFromAssoc = data.associations?.find((a) => a.type === 'empresa')?.name;
    const task: QuickTask = {
      id: `t${Date.now()}`,
      title: data.title,
      status: data.status as TaskStatus,
      type: data.type as TaskType,
      priority: data.priority,
      company: companyFromAssoc,
      startDate: data.startDate,
      dueDate: data.dueDate,
      startTime: data.startTime,
      assignee: data.assigneeName,
      associations: data.associations,
    };
    onTaskCreated?.(task);
    setTaskFormOpen(false);
  }

  async function handleActivitySave(data: import('./ActivityFormDialog').ActivityFormData) {
    if (!activityDialogType) return;
    const title = data.title || (activityDialogType === 'llamada' ? 'Llamada' : activityDialogType === 'reunion' ? 'Reunión' : 'Correo');
    const dueDate = activityDialogType === 'reunion' && data.dateTime
      ? data.dateTime.slice(0, 10)
      : data.date || new Date().toISOString().slice(0, 10);
    const startTime = activityDialogType === 'reunion' && data.dateTime
      ? (data.dateTime.slice(11, 16) || undefined)
      : activityDialogType === 'llamada'
        ? (data.time || undefined)
        : undefined;
    const startDate = activityDialogType === 'reunion' && data.dateTime
      ? dueDate
      : activityDialogType === 'llamada'
        ? dueDate
        : undefined;
    await Promise.resolve(onActivityCreated?.({
      type: activityDialogType,
      title,
      description: data.description || '',
      dueDate,
      startDate,
      startTime,
    }));
    setNoteContent('');
    setActivityDialogType(null);
    setActiveDialog(null);
  }

  return (
    <>
      <div className={inline ? 'flex flex-wrap items-center gap-2' : 'flex flex-wrap gap-1 rounded-lg border border-border/40 bg-muted/40 p-1.5'}>
        {visibleActions.map((a) => (
          <Button
            key={a.type}
            variant={inline ? 'secondary' : 'ghost'}
            size="sm"
            className={inline ? 'h-9 gap-1.5 px-3' : 'text-muted-foreground hover:text-foreground'}
            onClick={() => {
              if (a.type === 'llamada' || a.type === 'reunion' || a.type === 'correo') {
                setActivityDialogType(a.type);
              } else if (a.type === 'tarea') {
                setTaskFormOpen(true);
              } else {
                setActiveDialog(a.type);
              }
            }}
          >
            <a.icon className="size-4" /> {a.label}
          </Button>
        ))}
      </div>

      <Dialog open={!!activeDialog && activeDialog !== 'llamada' && activeDialog !== 'reunion' && activeDialog !== 'correo' && activeDialog !== 'tarea'} onOpenChange={(open) => {
        if (!open) {
          setActiveDialog(null);
          setNoteContent('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {activeDialog === 'nota' && 'Agregar Nota'}
              {activeDialog === 'archivo' && 'Adjuntar Archivo'}
            </DialogTitle>
            <DialogDescription>
              {activeDialog === 'nota' && `Agrega una nota sobre ${entityName}.`}
              {activeDialog === 'archivo' && `Adjunta un archivo relacionado a ${entityName}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {activeDialog === 'nota' && (
              <div className="space-y-2">
                <Label>Contenido de la nota</Label>
                <Textarea
                  placeholder="Escribe tu nota aquí..."
                  rows={4}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                />
              </div>
            )}
            {activeDialog === 'archivo' && (
              <div className="space-y-2">
                <Label>Archivo</Label>
                <Input type="file" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActiveDialog(null); setNoteContent(''); }}>Cancelar</Button>
            <Button onClick={() => void submitQuickAction()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {activityDialogType && (
        <ActivityFormDialog
          type={activityDialogType}
          open={!!activityDialogType}
          onOpenChange={(open) => { if (!open) setActivityDialogType(null); }}
          onSave={handleActivitySave}
        />
      )}

      <TaskFormDialog
        open={taskFormOpen}
        onOpenChange={setTaskFormOpen}
        title="Crear Tarea"
        description={`Crea una tarea relacionada a ${entityName}.`}
        contacts={contacts}
        companies={companies}
        opportunities={opportunities}
        onSave={handleTaskFormSave}
      />
    </>
  );
}
