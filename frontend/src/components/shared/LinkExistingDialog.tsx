import { Search, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  AssociationChip,
  type AssociationChipKind,
} from '@/components/shared/AssociationPickerField';
import {
  FormDialogActions,
  FormDialogShell,
  formDialogInputClass,
  formDialogScrollListClass,
} from '@/components/ui/form-dialog';
import { cn } from '@/lib/utils';

export interface LinkExistingItem {
  id: string;
  title: string;
  subtitle?: string;
  /** Etiqueta opcional a la derecha (p. ej. etapa real). Evitar valores fijos sin sentido. */
  status?: string;
  icon?: React.ReactNode;
  /** Tipo para chips de selección (default: según `itemKind` del diálogo). */
  kind?: AssociationChipKind;
}

interface LinkExistingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  searchPlaceholder: string;
  /** Nombre de la entidad a la que se vinculan los registros (texto descriptivo) */
  leadName?: string;
  /** Alias de `leadName` (misma finalidad; usado en varias pantallas) */
  contactName?: string;
  items: LinkExistingItem[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onConfirm: () => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  emptyMessage?: string;
  /** `single`: solo un ítem a la vez (p. ej. empresa en nuevo contacto) */
  selectionMode?: 'single' | 'multiple';
  /** Texto del botón principal (default: Vincular) */
  confirmLabel?: string;
  /** p. ej. z-index cuando el diálogo se abre encima de otro modal */
  contentClassName?: string;
  overlayClassName?: string;
  /** Si true, no filtra en cliente: `items` ya vienen acotados del servidor (p. ej. búsqueda paginada). */
  serverFilteredList?: boolean;
  listLoading?: boolean;
  listLoadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  /** Tipo por defecto de chips cuando el ítem no define `kind`. */
  itemKind?: AssociationChipKind;
}

export function LinkExistingDialog({
  open,
  onOpenChange,
  title,
  searchPlaceholder,
  leadName: _leadName,
  contactName: _contactName,
  items,
  selectedIds,
  onSelectionChange,
  onConfirm,
  searchValue,
  onSearchChange,
  emptyMessage = 'No hay registros disponibles para vincular.',
  selectionMode = 'multiple',
  confirmLabel = 'Vincular',
  contentClassName,
  overlayClassName,
  serverFilteredList = false,
  listLoading = false,
  listLoadingMore = false,
  hasMore = false,
  onLoadMore,
  itemKind = 'empresa',
}: LinkExistingDialogProps) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) setConfirming(false);
  }, [open]);

  const toggleSelection = (id: string) => {
    if (selectionMode === 'single') {
      if (selectedIds.includes(id)) {
        onSelectionChange([]);
      } else {
        onSelectionChange([id]);
      }
      return;
    }
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((i) => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const filteredItems = serverFilteredList
    ? items
    : items.filter(
        (item) =>
          item.title.toLowerCase().includes(searchValue.toLowerCase()) ||
          item.subtitle?.toLowerCase().includes(searchValue.toLowerCase()),
      );

  const selectedItems = selectedIds
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is LinkExistingItem => !!item);

  const handleListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!onLoadMore || !hasMore || listLoadingMore || listLoading) return;
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) {
      onLoadMore();
    }
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      maxWidthClassName="sm:max-w-lg"
      overlayClassName={overlayClassName}
      contentClassName={contentClassName}
      footer={(
        <FormDialogActions
          submitLabel={confirming ? 'Vinculando…' : confirmLabel}
          submitting={confirming}
          submitDisabled={selectedIds.length === 0}
          onSubmit={() => {
            setConfirming(true);
            onConfirm();
          }}
        />
      )}
    >
      <div className="space-y-3.5">
        {selectedItems.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {selectedItems.map((item) => {
              const kind = item.kind ?? itemKind;
              return (
                <AssociationChip
                  key={item.id}
                  kind={kind}
                  label={item.title}
                  showTypeLabel={false}
                  onRemove={() => toggleSelection(item.id)}
                />
              );
            })}
          </div>
        ) : null}

        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className={`${formDialogInputClass} h-11 pl-9`}
          />
        </div>

        <div
          className={cn(formDialogScrollListClass, 'max-h-80 space-y-1.5 pr-1')}
          onScroll={handleListScroll}
          onWheel={(e) => e.stopPropagation()}
        >
          {listLoading && filteredItems.length === 0 ? (
            <div className="flex justify-center py-12 text-muted-foreground">
              <Loader2 className="size-8 animate-spin" aria-label="Cargando" />
            </div>
          ) : filteredItems.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
          ) : (
            <>
              {filteredItems.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                return (
                  <label
                    key={item.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-xl border border-border/70 bg-background px-3 py-2.5 transition-colors hover:bg-muted/50',
                      isSelected && 'border-[#13944C]/40 bg-[#13944C]/5',
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelection(item.id)}
                      className="size-3.5 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                      {item.subtitle ? (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.subtitle}</p>
                      ) : null}
                    </div>
                    {item.status ? (
                      <Badge
                        variant="secondary"
                        className="shrink-0 border-[#13944C]/20 bg-[#13944C]/10 text-[11px] font-medium text-[#13944C]"
                      >
                        {item.status}
                      </Badge>
                    ) : null}
                  </label>
                );
              })}
              {listLoadingMore ? (
                <div className="flex justify-center py-3 text-muted-foreground">
                  <Loader2 className="size-5 animate-spin" aria-label="Cargando más" />
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </FormDialogShell>
  );
}
