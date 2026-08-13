import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from '@/lib/notify';
import type { Contact, Opportunity, TaskAssociation } from '@/types';
import { useActivities } from '@/hooks/useActivities';
import {
  buildCreateTaskPayloadFromForm,
  taskFormHasEntityLinks,
} from '@/lib/taskActivityUpdate';
import { contactLineFromTaskAssociations } from '@/lib/taskAssociationsFromActivity';
import { activityTypeSvgIcon } from '@/lib/activityTypeSvgIcons';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ActivityFormDialog } from './ActivityFormDialog';
import { TaskFormDialog } from './TaskFormDialog';
import type { TaskFormResult } from './TaskFormDialog';
import { ACTIVITY_TYPE_ICON_CIRCLE, ACTIVITY_ICON_INHERIT } from '@/lib/activityTypeCircleStyles';

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

type QuickMenuType = 'nota' | 'llamada' | 'reunion' | 'correo' | 'archivo' | 'tarea';

const MENU_OPTIONS: {
  type: QuickMenuType;
  label: string;
  description: string;
}[] = [
  {
    type: 'llamada',
    label: 'Llamada',
    description: 'Registra una llamada realizada',
  },
  {
    type: 'nota',
    label: 'Nota',
    description: 'Añade una nota interna',
  },
  {
    type: 'reunion',
    label: 'Reunión',
    description: 'Agenda una reunión con el cliente',
  },
  {
    type: 'tarea',
    label: 'Tarea',
    description: 'Crea una tarea de seguimiento',
  },
  {
    type: 'correo',
    label: 'Correo',
    description: 'Redacta y registra un correo',
  },
  {
    type: 'archivo',
    label: 'Archivo',
    description: 'Adjunta un archivo al registro',
  },
];

/** Mismo azul primario que sales-workspace (`--primary: 210 100% …`), no el verde de marca de Monterrico. */
const CREATE_ACTIVITY_TRIGGER_CLASS =
  'gap-1.5 border-0 bg-[hsl(210_100%_50%)] text-white shadow-none hover:bg-[hsl(210_100%_46%)] focus-visible:ring-2 focus-visible:ring-[hsl(210_100%_50%)]/35 dark:bg-[hsl(210_100%_56%)] dark:hover:bg-[hsl(210_100%_52%)] dark:focus-visible:ring-[hsl(210_100%_56%)]/40';

interface QuickActionsWithDialogsProps {
  entityName: string;
  contacts?: Contact[];
  companies?: { name: string; id?: string }[];
  opportunities?: Opportunity[];
  onTaskCreated?: (task: QuickTask) => void;
  onActivityCreated?: (activity: QuickActivityDraft) => void | Promise<void>;
  contactId?: string;
  /** Vínculos prellenados al crear tarea de seguimiento tras registrar actividad */
  followUpAssociations?: TaskAssociation[];
  excludeActions?: string[];
  inline?: boolean;
  clienteEmpresaId?: string;
  clienteEmpresaName?: string;
  contactoClienteId?: string;
  contactoClienteName?: string;
}

export function QuickActionsWithDialogs({
  entityName,
  contacts = [],
  companies = [],
  opportunities = [],
  onActivityCreated,
  followUpAssociations = [],
  excludeActions = [],
  inline = false,
  clienteEmpresaId,
  clienteEmpresaName,
  contactoClienteId,
  contactoClienteName,
}: QuickActionsWithDialogsProps) {
  const { createActivity } = useActivities();
  const [activeDialog, setActiveDialog] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState('');

  const [activityDialogType, setActivityDialogType] = useState<'llamada' | 'reunion' | 'correo' | null>(null);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [linkedTaskPromptOpen, setLinkedTaskPromptOpen] = useState(false);
  const [linkedTaskFormOpen, setLinkedTaskFormOpen] = useState(false);

  const visibleOptions = MENU_OPTIONS.filter((opt) => !excludeActions.includes(opt.type));
  const lockedClienteAssociations: TaskAssociation[] | undefined = (() => {
    const out: TaskAssociation[] = [];
    if (clienteEmpresaId && clienteEmpresaName) {
      out.push({ type: 'cliente_empresa', id: clienteEmpresaId, name: clienteEmpresaName });
    }
    if (contactoClienteId && (contactoClienteName || entityName)) {
      out.push({
        type: 'cliente_contacto',
        id: contactoClienteId,
        name: contactoClienteName ?? entityName,
      });
    }
    return out.length > 0 ? out : undefined;
  })();
  const taskDefaultAssociations =
    lockedClienteAssociations ??
    (followUpAssociations.length > 0 ? followUpAssociations : undefined);

  function handleMenuSelect(type: QuickMenuType) {
    if (type === 'llamada' || type === 'reunion' || type === 'correo') {
      setActivityDialogType(type);
    } else if (type === 'tarea') {
      setTaskFormOpen(true);
    } else {
      setActiveDialog(type);
    }
  }

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

  async function handleTaskFormSave(data: TaskFormResult) {
    if (!taskFormHasEntityLinks(data)) {
      toast.error('Debes vincular la tarea a un contacto, empresa u oportunidad');
      throw new Error('TASK_FORM_VALIDATION');
    }
    try {
      await createActivity(buildCreateTaskPayloadFromForm(data), {
        assigneeName: data.assigneeName,
        contactNameLine: contactLineFromTaskAssociations(data.associations),
      });
      toast.success('Tarea creada');
      setTaskFormOpen(false);
      setLinkedTaskFormOpen(false);
    } catch (e) {
      if (e instanceof Error && e.message === 'TASK_FORM_VALIDATION') return;
      toast.error(e instanceof Error ? e.message : 'Error al crear tarea');
      throw e;
    }
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
    setLinkedTaskPromptOpen(true);
  }

  return (
    <>
      {visibleOptions.length > 0 && (
        <div
          className={cn(
            inline ? 'inline-flex' : 'inline-flex rounded-lg border border-border/40 bg-muted/40 p-1.5',
          )}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="default"
                className={cn(
                  CREATE_ACTIVITY_TRIGGER_CLASS,
                  inline ? '' : 'text-xs',
                )}
              >
                <Plus className={inline ? 'size-4' : 'size-3.5'} />
                <span className="hidden sm:inline">Crear</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel className="text-xs font-medium text-text-tertiary">
                Nueva actividad
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {visibleOptions.map((option) => {
                const Icon = activityTypeSvgIcon(option.type);
                return (
                  <DropdownMenuItem
                    key={option.type}
                    onClick={() => handleMenuSelect(option.type)}
                    className="flex cursor-pointer items-start gap-3 py-2 focus:text-foreground data-[highlighted]:text-foreground"
                  >
                    <div
                      className={cn(
                        'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full',
                        ACTIVITY_ICON_INHERIT,
                        ACTIVITY_TYPE_ICON_CIRCLE[option.type],
                      )}
                    >
                      <Icon className="size-3.5" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-foreground">{option.label}</span>
                      <p className="truncate text-xs text-text-tertiary">{option.description}</p>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

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

      <Dialog open={linkedTaskPromptOpen} onOpenChange={setLinkedTaskPromptOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Crear tarea vinculada</DialogTitle>
            <DialogDescription>
              ¿Deseas crear una nueva tarea vinculada a esta actividad?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setLinkedTaskPromptOpen(false)}>
              No, gracias
            </Button>
            <Button
              className="bg-[#13944C] hover:bg-[#0f7a3d]"
              onClick={() => {
                setLinkedTaskPromptOpen(false);
                setLinkedTaskFormOpen(true);
              }}
            >
              Sí, crear tarea
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TaskFormDialog
        open={taskFormOpen}
        onOpenChange={setTaskFormOpen}
        title="Crear Tarea"
        description={`Crea una tarea relacionada a ${entityName}.`}
        contacts={contacts}
        companies={companies}
        opportunities={opportunities}
        defaultAssociations={taskDefaultAssociations}
        associationVariant={clienteEmpresaId ? 'cliente-cartera' : 'crm'}
        onSave={handleTaskFormSave}
      />

      <TaskFormDialog
        open={linkedTaskFormOpen}
        onOpenChange={setLinkedTaskFormOpen}
        title="Nueva Tarea Vinculada"
        description="Crea una tarea para continuar con el proceso."
        contacts={contacts}
        companies={companies}
        opportunities={opportunities}
        defaultAssociations={taskDefaultAssociations}
        associationVariant={clienteEmpresaId ? 'cliente-cartera' : 'crm'}
        onSave={handleTaskFormSave}
      />
    </>
  );
}
