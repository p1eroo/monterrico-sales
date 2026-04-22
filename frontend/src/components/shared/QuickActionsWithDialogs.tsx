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

/** Badges del menú: HSL explícito (referencia sales-workspace), estable en portal/TW v4. */
const ACTIVITY_MENU_BADGE: Record<QuickMenuType, string> = {
  llamada:
    'text-[hsl(142_82%_38%)] bg-[hsl(142_72%_91%)] shadow-[inset_0_0_0_1px_hsl(142_60%_78%/0.45)] dark:text-[hsl(142_82%_58%)] dark:bg-[hsl(142_71%_36%/0.32)] dark:shadow-none',
  nota:
    'text-[hsl(24_94%_46%)] bg-[hsl(34_90%_92%)] shadow-[inset_0_0_0_1px_hsl(32_78%_78%/0.42)] dark:text-[hsl(43_96%_60%)] dark:bg-[hsl(38_92%_42%/0.3)] dark:shadow-none',
  reunion:
    'text-[hsl(218_96%_52%)] bg-[hsl(212_92%_92%)] shadow-[inset_0_0_0_1px_hsl(215_75%_78%/0.4)] dark:text-[hsl(210_100%_70%)] dark:bg-[hsl(210_100%_50%/0.26)] dark:shadow-none',
  tarea:
    'text-[hsl(275_82%_50%)] bg-[hsl(278_70%_92%)] shadow-[inset_0_0_0_1px_hsl(280_55%_78%/0.4)] dark:text-[hsl(280_78%_68%)] dark:bg-[hsl(280_67%_45%/0.28)] dark:shadow-none',
  correo:
    'text-[hsl(220_24%_40%)] bg-[hsl(216_38%_91%)] shadow-[inset_0_0_0_1px_hsl(220_22%_76%/0.45)] dark:text-[hsl(214_20%_76%)] dark:bg-[hsl(215_10%_34%/0.4)] dark:shadow-none',
  archivo:
    'text-[hsl(220_18%_38%)] bg-[hsl(218_32%_90%)] shadow-[inset_0_0_0_1px_hsl(220_18%_74%/0.4)] dark:text-[hsl(214_14%_70%)] dark:bg-[hsl(215_10%_30%/0.38)] dark:shadow-none',
};

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
                        'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full [&_svg]:shrink-0 [&_svg]:text-[inherit]',
                        ACTIVITY_MENU_BADGE[option.type],
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
