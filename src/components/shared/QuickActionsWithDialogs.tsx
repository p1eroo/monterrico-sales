import { useState } from 'react';
import {
  MessageSquare, Phone, Calendar, Mail, Paperclip, ClipboardList,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCRMStore } from '@/store/crmStore';
import { users } from '@/data/mock';
import type { Contact, Opportunity } from '@/types';

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
type TaskType = 'llamada' | 'reunion' | 'correo';

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

export interface TaskAssociation {
  type: 'contacto' | 'empresa' | 'negocio';
  id: string;
  name: string;
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
  onActivityCreated?: (activity: { id: string; type: import('@/types').ActivityType; title: string; description: string; assignedTo: string; assignedToName: string; status: import('@/types').ActivityStatus; dueDate: string; createdAt: string; contactId?: string }) => void;
  contactId?: string;
}

export function QuickActionsWithDialogs({
  entityName,
  contacts = [],
  companies = [],
  opportunities = [],
  onTaskCreated,
  onActivityCreated,
  contactId,
}: QuickActionsWithDialogsProps) {
  const { contacts: storeContacts } = useCRMStore();
  const [activeDialog, setActiveDialog] = useState<string | null>(null);

  const [activityDialogType, setActivityDialogType] = useState<'llamada' | 'reunion' | 'correo' | null>(null);
  const [taskFormOpen, setTaskFormOpen] = useState(false);

  function submitQuickAction() {
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
      type: (data.type || undefined) as TaskType | undefined,
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

  function handleActivitySave(data: import('./ActivityFormDialog').ActivityFormData) {
    if (!activityDialogType) return;
    const title = data.title || (activityDialogType === 'llamada' ? 'Llamada' : activityDialogType === 'reunion' ? 'Reunión' : 'Correo');
    const dueDate = activityDialogType === 'reunion' && data.dateTime
      ? data.dateTime.slice(0, 10)
      : data.date || new Date().toISOString().slice(0, 10);
    const defaultAssignee = users[0];
    onActivityCreated?.({
      id: `act-${Date.now()}`,
      type: activityDialogType,
      title,
      description: data.description || '',
      assignedTo: defaultAssignee?.id ?? '',
      assignedToName: defaultAssignee?.name ?? '',
      status: 'completada' as import('@/types').ActivityStatus,
      dueDate,
      createdAt: new Date().toISOString().slice(0, 10),
      contactId,
    });
    setActivityDialogType(null);
    setActiveDialog(null);
  }

  return (
    <>
      <div className="flex flex-wrap gap-1 rounded-lg bg-muted/40 p-1.5 border border-border/40">
        {actions.map((a) => (
          <Button
            key={a.type}
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
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

      <Dialog open={!!activeDialog && activeDialog !== 'llamada' && activeDialog !== 'reunion' && activeDialog !== 'correo' && activeDialog !== 'tarea'} onOpenChange={(open) => { if (!open) setActiveDialog(null); }}>
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
                <Textarea placeholder="Escribe tu nota aquí..." rows={4} />
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
            <Button variant="outline" onClick={() => setActiveDialog(null)}>Cancelar</Button>
            <Button onClick={submitQuickAction}>Guardar</Button>
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
        contacts={contacts.length > 0 ? contacts : storeContacts}
        companies={companies}
        opportunities={opportunities}
        onSave={handleTaskFormSave}
      />
    </>
  );
}
