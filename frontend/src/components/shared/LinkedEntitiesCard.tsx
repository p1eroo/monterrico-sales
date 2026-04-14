import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Plus, Link2Off } from 'lucide-react';

export interface LinkedEntitiesCardProps<T> {
  title: string;
  icon: LucideIcon;
  items: T[];
  maxItems?: number;
  emptyMessage: string;
  createLabel?: string;
  onCreate?: () => void;
  onAddExisting?: () => void;
  /** Si se proporciona, muestra ícono desvincular en la última fila de cada item */
  onRemove?: (item: T) => void;
  /** Nombre del item para el aviso de confirmación (ej: "Minera Los Andes SAC") */
  getUnlinkLabel?: (item: T) => string;
  getItemKey: (item: T, index?: number) => string;
  onItemClick: (item: T) => void;
  /** Segundo parámetro: botón desvincular para colocar en la última fila (cuando hay onRemove) */
  renderItem: (item: T, unlinkButton?: React.ReactNode) => React.ReactNode;
}

/**
 * Tarjeta genérica para mostrar entidades vinculadas (contactos, oportunidades, empresas).
 * Incluye header con contador, menú Crear/Agregar existente, lista con límite y "+N más".
 */
export function LinkedEntitiesCard<T>({
  title,
  icon: Icon,
  items,
  maxItems = 3,
  emptyMessage,
  createLabel = 'Crear nuevo',
  onCreate,
  onAddExisting,
  onRemove,
  getUnlinkLabel,
  getItemKey,
  onItemClick,
  renderItem,
}: LinkedEntitiesCardProps<T>) {
  const [pendingUnlink, setPendingUnlink] = useState<T | null>(null);
  const hasActions = onCreate || onAddExisting;

  function handleUnlinkClick(item: T) {
    setPendingUnlink(item);
  }

  function handleConfirmUnlink() {
    if (pendingUnlink && onRemove) {
      onRemove(pendingUnlink);
      setPendingUnlink(null);
    }
  }

  return (
    <Card className="gap-2 border-border/70 bg-surface-elevated shadow-none">
      <CardHeader className="-mt-1 flex flex-row items-center justify-between gap-2 pb-0">
        <CardTitle className="flex items-center gap-1.5 text-[14px] text-text-primary">
          <Icon className="size-4 text-text-tertiary" />
          {title}
          <span className="font-normal text-text-tertiary">({items.length})</span>
        </CardTitle>
        {hasActions && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 shrink-0 rounded-md border border-border/70 bg-background/40 p-0 text-text-secondary hover:bg-surface-hover hover:text-text-primary"
              >
                <Plus className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onCreate && <DropdownMenuItem onClick={onCreate}>{createLabel}</DropdownMenuItem>}
              {onAddExisting && <DropdownMenuItem onClick={onAddExisting}>Agregar existente</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-background/30 px-3 py-2">
            <p className="text-center text-xs text-text-secondary">{emptyMessage}</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.slice(0, maxItems).map((item, idx) => {
              const unlinkBtn = onRemove ? (
                <div
                  className="shrink-0"
                  onClick={(e) => e.stopPropagation()}
                  title="Desvincular"
                >
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 p-0 text-text-tertiary hover:bg-stage-lost/10 hover:text-stage-lost"
                    onClick={() => handleUnlinkClick(item)}
                  >
                    <Link2Off className="size-4" />
                  </Button>
                </div>
              ) : undefined;
              return (
                <div
                  key={getItemKey(item, idx)}
                  className="cursor-pointer rounded-xl border border-border/70 bg-background/50 p-3.5 transition-colors hover:border-border hover:bg-surface-hover"
                  onClick={() => onItemClick(item)}
                >
                  {renderItem(item, unlinkBtn)}
                </div>
              );
            })}
            {items.length > maxItems && (
              <p className="pt-1 text-center text-[11px] text-text-tertiary">
                +{items.length - maxItems} más
              </p>
            )}
          </div>
        )}
      </CardContent>

      <ConfirmDialog
        open={pendingUnlink !== null}
        onOpenChange={(open) => !open && setPendingUnlink(null)}
        title="Desvincular"
        description={
          pendingUnlink
            ? getUnlinkLabel
              ? `¿Estás seguro de que deseas desvincular "${getUnlinkLabel(pendingUnlink)}"?`
              : '¿Estás seguro de que deseas desvincular este elemento?'
            : ''
        }
        onConfirm={handleConfirmUnlink}
        variant="destructive"
      />
    </Card>
  );
}
