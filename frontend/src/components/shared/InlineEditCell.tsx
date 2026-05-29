import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { X } from 'lucide-react';
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
  onSaved?: (fieldKey: string, newValue: string | null) => void;
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
  const processingRef = useRef(false);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  useEffect(() => {
    if (editing && inputRef.current && type !== 'select') {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing, type]);

  const startEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      processingRef.current = false;
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
    (e?: React.SyntheticEvent) => {
      e?.stopPropagation();
      processingRef.current = true;
      setEditing(false);
    },
    [],
  );

  const saveUrl = useMemo(() => {
    if (fieldKey === 'operador') {
      return `/flota-prospectos/${fieldId}/operador`;
    }
    return `/flota-prospectos/${fieldId}`;
  }, [fieldKey, fieldId]);

  const save = useCallback(
    async (e?: React.SyntheticEvent) => {
      e?.stopPropagation();
      const trimmed = editValue.trim();
      if (trimmed === String(value ?? '')) {
        setEditing(false);
        return;
      }
      setSaving(true);
      try {
        const body: Record<string, unknown> = {};
        const numericValue = type === 'number' ? parseInt(trimmed, 10) : undefined;
        if (type === 'number') {
          body[fieldKey] = isNaN(numericValue!) ? null : numericValue;
        } else if (fieldKey === 'operador') {
          body.operador = trimmed || null;
        } else {
          body[fieldKey] = trimmed || null;
        }
        await api(saveUrl, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        toast.success('Actualizado');
        setEditing(false);
        const savedValue = type === 'number'
          ? (isNaN(numericValue!) ? null : String(numericValue))
          : trimmed || null;
        onSavedRef.current?.(fieldKey, savedValue);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Error al actualizar',
        );
      } finally {
        setSaving(false);
      }
    },
    [editValue, value, fieldKey, fieldId, type, onSaved, saveUrl],
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

  return (
    <div className="relative min-h-[26px]">
      {!editing ? (
        <button
          type="button"
          className={cn(
            'w-full text-left text-sm py-1 px-1 rounded transition-colors hover:bg-muted/20',
            className,
          )}
          onClick={startEdit}
        >
          {children ?? (value != null ? String(value) : <span className="text-muted-foreground italic">—</span>)}
        </button>
      ) : type === 'select' ? (
        <div className="relative z-20 flex items-center gap-1 bg-background rounded-md border shadow-md p-1" onClick={(e) => e.stopPropagation()}>
          <Select
            value={editValue}
            onValueChange={(v) => {
              processingRef.current = true;
              setEditValue(v);
              setEditing(false);
              const finalValue = v === '__none__' ? null : v;
              if ((finalValue ?? '') === (value ?? '')) {
                processingRef.current = false;
                return;
              }
              setSaving(true);
              const body: Record<string, unknown> = {
                [fieldKey]: finalValue,
              };
              api(saveUrl, {
                method: 'PATCH',
                body: JSON.stringify(body),
              })
                .then(() => {
                  toast.success('Actualizado');
                  onSavedRef.current?.(fieldKey, finalValue);
                })
                .catch((err) =>
                  toast.error(
                    err instanceof Error ? err.message : 'Error al actualizar',
                  ),
                )
                .finally(() => {
                  setSaving(false);
                  processingRef.current = false;
                });
            }}
            onOpenChange={(open) => {
              if (!open) cancel();
            }}
          >
            <SelectTrigger className="h-8 text-xs min-w-[120px]">
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
      ) : (
        <div className="absolute left-0 top-0 z-20 flex items-center rounded-md border bg-background shadow-md" onClick={(e) => e.stopPropagation()}>
          <Input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => { if (!processingRef.current) void save(); }}
            type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
            className="h-8 text-sm w-full"
            style={{ minWidth: `${Math.max(editValue?.length || 1, 10)}ch` }}
            disabled={saving}
          />
        </div>
      )}
    </div>
  );
}
