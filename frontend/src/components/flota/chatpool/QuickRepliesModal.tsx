import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/lib/notify';
import { cn } from '@/lib/utils';
import type { QuickReply } from './quickReplies';

interface QuickRepliesModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (reply: QuickReply) => void;
  replies: QuickReply[];
  createReply: (input: { label: string; text: string }) => QuickReply;
  updateReply: (id: string, input: { label: string; text: string }) => void;
  deleteReply: (id: string) => void;
}

type FormMode = 'list' | 'create' | 'edit';

export function QuickRepliesModal({
  open,
  onClose,
  onSelect,
  replies,
  createReply,
  updateReply,
  deleteReply,
}: QuickRepliesModalProps) {
  const [mode, setMode] = useState<FormMode>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setMode('list');
      setEditingId(null);
      setExpandedId(null);
      setLabel('');
      setText('');
      setSaving(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (mode !== 'list') {
        setMode('list');
        setEditingId(null);
        setLabel('');
        setText('');
      } else {
        onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, mode, onClose]);

  if (!open) return null;

  const isFormMode = mode === 'create' || mode === 'edit';

  function startCreate() {
    setLabel('');
    setText('');
    setEditingId(null);
    setExpandedId(null);
    setMode('create');
  }

  function startEdit(reply: QuickReply) {
    setEditingId(reply.id);
    setLabel(reply.label);
    setText(reply.text);
    setMode('edit');
  }

  function resetForm() {
    setLabel('');
    setText('');
    setEditingId(null);
    setMode('list');
  }

  function handleSave() {
    setSaving(true);
    try {
      if (mode === 'edit' && editingId) {
        updateReply(editingId, { label, text });
        toast.success('Respuesta actualizada');
      } else {
        createReply({ label, text });
        toast.success('Respuesta creada');
      }
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(id: string) {
    deleteReply(id);
    if (editingId === id) resetForm();
    if (expandedId === id) setExpandedId(null);
    toast.success('Respuesta eliminada');
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative flex max-h-[min(80vh,640px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 px-4 pb-3 pt-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">
              {isFormMode
                ? mode === 'edit'
                  ? 'Editar respuesta'
                  : 'Nueva respuesta'
                : 'Respuestas rápidas'}
            </h2>
            {!isFormMode ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {replies.length} {replies.length === 1 ? 'respuesta' : 'respuestas'} · también con{' '}
                <span className="font-medium text-foreground">/</span> en el chat
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onClose}
            title="Cerrar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {!isFormMode ? (
          <div className="shrink-0 px-4 pb-3">
            <button
              type="button"
              onClick={startCreate}
              className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-muted/40 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <Plus className="h-4 w-4" />
              Añadir respuesta
            </button>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {isFormMode ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Título</label>
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Ej. Saludo inicial"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Contenido</label>
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Mensaje que se insertará en el chat…"
                  rows={5}
                  className="resize-none"
                />
                {text.trim() ? (
                  <div className="mt-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Vista previa
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {text}
                    </p>
                  </div>
                ) : null}
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={resetForm} disabled={saving}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !label.trim() || !text.trim()}
                  className="gap-1.5"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Guardar
                </Button>
              </div>
            </div>
          ) : replies.length === 0 ? (
            <div className="px-2 py-12 text-center">
              <p className="mb-1 text-sm font-medium text-foreground">Aún no hay respuestas</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Añade atajos para usarlos con el botón o escribiendo{' '}
                <span className="text-foreground">/</span> en el chat.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {replies.map((reply) => {
                const expanded = expandedId === reply.id;
                return (
                  <div
                    key={reply.id}
                    className={cn(
                      'overflow-hidden rounded-xl border border-border bg-muted/30 transition-colors',
                      expanded && 'border-primary/40',
                    )}
                  >
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId((prev) => (prev === reply.id ? null : reply.id))
                        }
                        className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
                      >
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                            expanded && 'rotate-180',
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {reply.label}
                          </p>
                          {!expanded ? (
                            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                              {reply.text}
                            </p>
                          ) : null}
                        </div>
                      </button>
                      <div className="flex shrink-0 items-center gap-0.5 pr-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground"
                          title="Editar"
                          onClick={() => startEdit(reply)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          title="Eliminar"
                          onClick={() => handleDelete(reply.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div
                      className={cn(
                        'grid transition-[grid-template-rows] duration-200 ease-out',
                        expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                      )}
                    >
                      <div className="min-h-0 overflow-hidden">
                        <div className="space-y-2.5 border-t border-border/60 px-3 pb-3 pt-2">
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                            {reply.text}
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            className="h-8"
                            onClick={() => onSelect(reply)}
                          >
                            Usar en el mensaje
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
