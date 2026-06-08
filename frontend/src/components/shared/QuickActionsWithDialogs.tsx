import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Plus,
  Phone,
  StickyNote,
  CalendarPlus,
  Mail,
  Paperclip,
  CheckSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Contact, Opportunity, TaskAssociation } from '@/types';

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
  icon: LucideIcon;
  shortcut?: string;
}[] = [
  {
    type: 'llamada',
    label: 'Llamada',
    description: 'Registra una llamada realizada',
    icon: Phone,
    shortcut: 'L',
  },
  {
    type: 'nota',
    label: 'Nota',
    description: 'Añade una nota interna',
    icon: StickyNote,
    shortcut: 'N',
  },
  {
    type: 'reunion',
    label: 'Reunión',
    description: 'Agenda una reunión con el cliente',
    icon: CalendarPlus,
    shortcut: 'R',
  },
  {
    type: 'tarea',
    label: 'Tarea',
    description: 'Crea una tarea de seguimiento',
    icon: CheckSquare,
    shortcut: 'T',
  },
  {
    type: 'correo',
    label: 'Correo',
    description: 'Redacta y registra un correo',
    icon: Mail,
    shortcut: 'E',
  },
  {
    type: 'archivo',
    label: 'Archivo',
    description: 'Adjunta un archivo al registro',
    icon: Paperclip,
  },
];

/** Mismo azul primario que sales-workspace (`--primary: 210 100% …`), no el verde de marca de Monterrico. */
const CREATE_ACTIVITY_TRIGGER_CLASS =
  'gap-1.5 border-0 bg-[hsl(210_100%_50%)] text-white shadow-none hover:bg-[hsl(210_100%_46%)] focus-visible:ring-2 focus-visible:ring-[hsl(210_100%_50%)]/35 dark:bg-[hsl(210_100%_56%)] dark:hover:bg-[hsl(210_100%_52%)] dark:focus-visible:ring-[hsl(210_100%_56%)]/40';

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

  const visibleOptions = MENU_OPTIONS.filter((opt) => !excludeActions.includes(opt.type));

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
                const Icon = option.icon;
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
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground">{option.label}</span>
                        {option.shortcut && (
                          <kbd className="hidden h-5 items-center rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-text-tertiary sm:inline-flex">
                            {option.shortcut}
                          </kbd>
                        )}
                      </div>
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
