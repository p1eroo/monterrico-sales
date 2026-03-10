import { Search, Link2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export interface LinkExistingItem {
  id: string;
  title: string;
  subtitle?: string;
  status?: string;
  icon?: React.ReactNode;
}

interface LinkExistingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  searchPlaceholder: string;
  leadName: string;
  items: LinkExistingItem[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onConfirm: () => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  emptyMessage?: string;
}

export function LinkExistingDialog({
  open,
  onOpenChange,
  title,
  searchPlaceholder,
  leadName,
  items,
  selectedIds,
  onSelectionChange,
  onConfirm,
  searchValue,
  onSearchChange,
  emptyMessage = 'No hay registros disponibles para vincular.',
}: LinkExistingDialogProps) {
  const toggleSelection = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((i) => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const filteredItems = items.filter(
    (item) =>
      item.title.toLowerCase().includes(searchValue.toLowerCase()) ||
      item.subtitle?.toLowerCase().includes(searchValue.toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-left">
            <Link2 className="size-5 text-[#13944C]" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-left">
            Selecciona los registros que deseas vincular a {leadName}.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-10 pl-9 rounded-lg border-[#13944C]/30 focus-visible:ring-[#13944C]/50"
            />
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto border-y px-6 py-3">
          {filteredItems.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
          ) : (
            <div className="space-y-2">
              {filteredItems.map((item) => (
                <label
                  key={item.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50',
                    selectedIds.includes(item.id) && 'border-[#13944C]/50 bg-emerald-50/50',
                  )}
                >
                  <Checkbox
                    checked={selectedIds.includes(item.id)}
                    onCheckedChange={() => toggleSelection(item.id)}
                  />
                  {item.icon && (
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      {item.icon}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{item.title}</p>
                    {item.subtitle && (
                      <p className="mt-0.5 text-sm text-muted-foreground truncate">{item.subtitle}</p>
                    )}
                  </div>
                  {item.status && (
                    <Badge
                      variant="secondary"
                      className="shrink-0 bg-emerald-100 text-emerald-700 border-emerald-200"
                    >
                      {item.status}
                    </Badge>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-4 px-6 py-4">
          <span className="text-sm text-muted-foreground">
            {selectedIds.length} seleccionado{selectedIds.length !== 1 ? 's' : ''}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-[#13944C] hover:bg-[#0f7a3d]"
              onClick={onConfirm}
              disabled={selectedIds.length === 0}
            >
              Vincular
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
