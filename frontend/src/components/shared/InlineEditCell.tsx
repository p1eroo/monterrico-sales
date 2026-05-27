import { useState, useRef, useEffect, useCallback } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface SelectOption {
  label: string;
  value: string;
}

interface InlineEditCellProps {
  value: string | number | null | undefined;
  fieldId: string;
  fieldKey: string;
  type?: 'text' | 'number' | 'select' | 'date' | 'readonly';
  options?: SelectOption[];
  onSaved?: () => void;
  onNavigate?: () => void;
  className?: string;
  /** Renderiza el display sin editarlo — viaja al detalle con onNavigate */
  linkToDetail?: boolean;
  children?: React.ReactNode;
}

export function InlineEditCell({
  value,
  fieldId,
  fieldKey,
  type = 'text',
  options = [],
  onSaved,
  onNavigate,
  className,
  linkToDetail,
  children,
}: InlineEditCellProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current && type !== 'select') {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing, type]);

  const startEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      let raw = value != null ? String(value) : '';
      if (type === 'date' && raw.includes('T')) {
        raw = raw.split('T')[0];
      }
      setEditValue(!raw && type === 'select' ? '__none__' : raw);
      setEditing(true);
    },
    [value, type],
  );

  const cancel = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      setEditing(false);
    },
    [],
  );

  const save = useCallback(
    async (e?: React.MouseEvent) => {
      e?.stopPropagation();
      const trimmed = editValue.trim();
      if (trimmed === String(value ?? '')) {
        setEditing(false);
        return;
      }
      setSaving(true);
      try {
        const body: Record<string, unknown> = {};
        if (type === 'number') {
          const num = parseInt(trimmed, 10);
          body[fieldKey] = isNaN(num) ? null : num;
        } else {
          body[fieldKey] = trimmed || null;
        }
        await api(`/flota-prospectos/${fieldId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        toast.success('Actualizado');
        setEditing(false);
        onSaved?.();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Error al actualizar',
        );
      } finally {
        setSaving(false);
      }
    },
    [editValue, value, fieldKey, fieldId, type, onSaved],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') void save();
      if (e.key === 'Escape') cancel();
    },
    [save, cancel],
  );

  if (type === 'readonly') {
    return (
      <div className={cn('py-1', className)}>
        {children ?? (value != null ? String(value) : '—')}
      </div>
    );
  }

  if (linkToDetail) {
    return (
      <div
        className={cn('cursor-pointer py-1', className)}
        onClick={(e) => {
          e.stopPropagation();
          onNavigate?.();
        }}
        role="button"
        tabIndex={0}
      >
        {children ?? (value != null ? String(value) : '—')}
      </div>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        className={cn(
          'group relative w-full min-h-[26px] rounded px-1.5 py-1 text-left transition-colors',
          'border border-dashed border-transparent hover:border-muted-foreground/20 hover:bg-muted/40',
          className,
        )}
        onClick={startEdit}
      >
        {children ?? (value != null ? String(value) : '—')}
      </button>
    );
  }

  if (type === 'select') {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <Select
          value={editValue}
          onValueChange={(v) => {
            setEditValue(v);
            setEditing(false);
            const finalValue = v === '__none__' ? null : v;
            if ((finalValue ?? '') === (value ?? '')) return;
            setSaving(true);
            api(`/flota-prospectos/${fieldId}`, {
              method: 'PATCH',
              body: JSON.stringify({
                [fieldKey]: finalValue,
              }),
            })
              .then(() => {
                toast.success('Actualizado');
                onSaved?.();
              })
              .catch((err) =>
                toast.error(
                  err instanceof Error ? err.message : 'Error al actualizar',
                ),
              )
              .finally(() => setSaving(false));
          }}
          onOpenChange={(open) => {
            if (!open) cancel();
          }}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">—</SelectItem>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0"
          onClick={cancel}
        >
          <X className="size-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <Input
        ref={inputRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        type={type === 'number' ? 'number' : 'text'}
        className="h-8 text-xs"
        disabled={saving}
      />
      {saving ? (
        <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
      ) : (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 shrink-0 text-emerald-600"
            onClick={(e) => void save(e)}
          >
            <Check className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 shrink-0 text-destructive"
            onClick={cancel}
          >
            <X className="size-3" />
          </Button>
        </>
      )}
    </div>
  );
}
