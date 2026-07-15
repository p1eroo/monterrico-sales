import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { Activity } from '@/types';
import { ActivityDetailDialog } from '@/components/shared/ActivityDetailDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { UpdateActivityPayload } from '@/lib/activityApi';

type EntityNotesTabProps = {
  notes: Activity[];
  noteText: string;
  onNoteTextChange: (value: string) => void;
  onAddNote: () => void;
  onUpdateActivity?: (id: string, payload: UpdateActivityPayload) => Promise<Activity>;
  onDeleteActivity?: (id: string) => Promise<void>;
  title?: string;
};

export function EntityNotesTab({
  notes,
  noteText,
  onNoteTextChange,
  onAddNote,
  onUpdateActivity,
  onDeleteActivity,
  title = 'Notas',
}: EntityNotesTabProps) {
  const [selectedNote, setSelectedNote] = useState<Activity | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const canEdit = Boolean(onUpdateActivity);

  const openNote = (note: Activity) => {
    if (!canEdit) return;
    setSelectedNote(note);
    setDialogOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-3 sm:p-5 sm:space-y-4">
          <div className="space-y-2">
            <Textarea
              placeholder="Escribe una nota..."
              value={noteText}
              onChange={(e) => onNoteTextChange(e.target.value)}
              rows={3}
            />
            <Button size="sm" onClick={onAddNote} disabled={!noteText.trim()}>
              <Plus className="size-4" /> Agregar nota
            </Button>
          </div>
          <div className="space-y-3">
            {notes.map((note) => (
              <button
                key={note.id}
                type="button"
                disabled={!canEdit}
                onClick={() => openNote(note)}
                className={cn(
                  'w-full rounded-lg border p-4 text-left transition-colors',
                  canEdit && 'cursor-pointer hover:border-primary/40 hover:bg-muted/30',
                  !canEdit && 'cursor-default',
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{note.description}</p>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium">{note.assignedToName}</span>
                  <span>·</span>
                  <span>{formatDate(note.createdAt || note.dueDate)}</span>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <ActivityDetailDialog
        activity={selectedNote}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setSelectedNote(null);
        }}
        initialEditing
        onUpdateActivity={onUpdateActivity}
        onDeleteActivity={onDeleteActivity}
      />
    </>
  );
}
