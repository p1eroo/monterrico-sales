import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus } from 'lucide-react';

export interface LinkedEntitiesCardProps<T> {
  title: string;
  icon: LucideIcon;
  items: T[];
  maxItems?: number;
  emptyMessage: string;
  createLabel?: string;
  onCreate?: () => void;
  onAddExisting?: () => void;
  getItemKey: (item: T, index?: number) => string;
  onItemClick: (item: T) => void;
  renderItem: (item: T) => React.ReactNode;
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
  getItemKey,
  onItemClick,
  renderItem,
}: LinkedEntitiesCardProps<T>) {
  const hasActions = onCreate || onAddExisting;

  return (
    <Card className="gap-2">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-0 -mt-1">
        <CardTitle className="flex items-center gap-1.5 text-[14px]">
          <Icon className="size-4.5 text-muted-foreground" />
          {title}
          <span className="text-muted-foreground font-normal">({items.length})</span>
        </CardTitle>
        {hasActions && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-6 w-6 shrink-0 p-0">
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
          <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
            <p className="text-center text-xs text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.slice(0, maxItems).map((item, idx) => (
              <div
                key={getItemKey(item, idx)}
                className="rounded-xl border bg-card p-3.5 hover:shadow-sm transition-shadow cursor-pointer"
                onClick={() => onItemClick(item)}
              >
                {renderItem(item)}
              </div>
            ))}
            {items.length > maxItems && (
              <p className="text-[11px] text-muted-foreground text-center pt-1">
                +{items.length - maxItems} más
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
