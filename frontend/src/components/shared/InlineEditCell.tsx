import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/notify';
import {
  formDialogInputClass,
  formDialogSelectTriggerClass,
} from '@/components/ui/form-dialog';

interface SelectOption {
  label: string;
  value: string;
}

interface InlineEditCellProps {
  value: string | number | null | undefined;
  fieldId: string;
  fieldKey: string;
  type?: 'text' | 'number' | 'select' | 'date' | 'datetime-local' | 'readonly';
  options?: SelectOption[];
  onSaved?: (fieldKey: string, newValue: string | null) => void;
  onNavigate?: () => void;
  className?: string;
  /** Renderiza el display sin editarlo — viaja al detalle con onNavigate */
  linkToDetail?: boolean;
  children?: React.ReactNode;
  /** Reemplaza el guardado por defecto (PATCH al backend). Recibe el valor editado crudo. */
  onSaveOverride?: (rawValue: string) => Promise<void>;
}

function toEditString(
  value: string | number | null | undefined,
  type: InlineEditCellProps['type'],
): string {
  let raw = value != null ? String(value) : '';
  if (type === 'date' && raw.includes('T')) {
    raw = raw.split('T')[0];
  }
  return raw;
}

function displayText(value: string | number | null | undefined): string {
  if (value == null || String(value) === '') return '—';
  return String(value);
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
  onSaveOverride,
}: InlineEditCellProps) {
  const [draft, setDraft] = useState(() => toEditString(value, type));
  const [saving, setSaving] = useState(false);
  const focusedRef = useRef(false);
  const processingRef = useRef(false);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  const onSaveOverrideRef = useRef(onSaveOverride);
  onSaveOverrideRef.current = onSaveOverride;

  useEffect(() => {
    if (focusedRef.current || processingRef.current) return;
    setDraft(toEditString(value, type));
  }, [value, type]);

  const saveUrl = useMemo(() => {
    if (fieldKey === 'operador') {
      return `/flota-prospectos/${fieldId}/operador`;
    }
    return `/flota-prospectos/${fieldId}`;
  }, [fieldKey, fieldId]);

  const persist = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      const current = String(value ?? '');
      if (trimmed === current) return;

      setSaving(true);
      processingRef.current = true;
      try {
        if (onSaveOverrideRef.current) {
          await onSaveOverrideRef.current(trimmed);
          toast.success('Actualizado');
          onSavedRef.current?.(fieldKey, trimmed || null);
        } else {
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
          const savedValue =
            type === 'number'
              ? isNaN(numericValue!)
                ? null
                : String(numericValue)
              : trimmed || null;
          onSavedRef.current?.(fieldKey, savedValue);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al actualizar');
        setDraft(toEditString(value, type));
      } finally {
        setSaving(false);
        processingRef.current = false;
      }
    },
    [value, fieldKey, type, saveUrl],
  );

  const persistSelect = useCallback(
    async (next: string) => {
      const finalValue = next === '__none__' ? null : next;
      if ((finalValue ?? '') === (value ?? '')) return;

      setSaving(true);
      processingRef.current = true;
      setDraft(finalValue ?? '');
      try {
        if (onSaveOverrideRef.current) {
          await onSaveOverrideRef.current(finalValue ?? '');
          toast.success('Actualizado');
          onSavedRef.current?.(fieldKey, finalValue);
        } else {
          await api(saveUrl, {
            method: 'PATCH',
            body: JSON.stringify({ [fieldKey]: finalValue }),
          });
          toast.success('Actualizado');
          onSavedRef.current?.(fieldKey, finalValue);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al actualizar');
        setDraft(toEditString(value, type));
      } finally {
        setSaving(false);
        processingRef.current = false;
      }
    },
    [value, fieldKey, type, saveUrl],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.currentTarget.blur();
      }
      if (e.key === 'Escape') {
        setDraft(toEditString(value, type));
        focusedRef.current = false;
        e.currentTarget.blur();
      }
    },
    [value, type],
  );

  if (type === 'readonly' || linkToDetail) {
    if (children) {
      return (
        <div
          role={linkToDetail ? 'button' : undefined}
          tabIndex={linkToDetail ? 0 : undefined}
          className={cn(
            formDialogInputClass,
            'flex items-center bg-muted/40',
            linkToDetail ? 'cursor-pointer' : 'cursor-default',
            className,
          )}
          onClick={
            linkToDetail
              ? (e) => {
                  e.stopPropagation();
                  onNavigate?.();
                }
              : undefined
          }
        >
          {children}
        </div>
      );
    }

    return (
      <Input
        readOnly
        value={displayText(value)}
        className={cn(
          formDialogInputClass,
          'bg-muted/40',
          linkToDetail ? 'cursor-pointer' : 'cursor-default',
          className,
        )}
        onClick={
          linkToDetail
            ? (e) => {
                e.stopPropagation();
                onNavigate?.();
              }
            : undefined
        }
      />
    );
  }

  if (type === 'select') {
    const selectValue = draft || '__none__';
    return (
      <Select
        value={selectValue}
        disabled={saving}
        onValueChange={(v) => {
          void persistSelect(v);
        }}
      >
        <SelectTrigger
          className={cn(formDialogSelectTriggerClass, className)}
          onClick={(e) => e.stopPropagation()}
        >
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">—</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
          {draft && !options.some((o) => o.value === draft) ? (
            <SelectItem value={draft}>{draft}</SelectItem>
          ) : null}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onBlur={() => {
        focusedRef.current = false;
        if (!processingRef.current) void persist(draft);
      }}
      onKeyDown={handleKeyDown}
      onClick={(e) => e.stopPropagation()}
      type={
        type === 'number'
          ? 'number'
          : type === 'date'
            ? 'date'
            : type === 'datetime-local'
              ? 'datetime-local'
              : 'text'
      }
      disabled={saving}
      placeholder="—"
      className={cn(formDialogInputClass, className)}
    />
  );
}
