import { Button } from '@/components/ui/button';
import { CommandSeparator } from '@/components/ui/command';

type MultiCheckboxFilterActionsProps = {
  onSelectAll: () => void;
  onClear: () => void;
  allSelected?: boolean;
  noneSelected?: boolean;
};

export function MultiCheckboxFilterActions({
  onSelectAll,
  onClear,
  allSelected = false,
  noneSelected = false,
}: MultiCheckboxFilterActionsProps) {
  return (
    <>
      <CommandSeparator className="my-1.5 mx-1 border-dashed" />
      <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs font-semibold text-primary"
          disabled={allSelected}
          onClick={onSelectAll}
        >
          Seleccionar todos
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs font-semibold text-muted-foreground"
          disabled={noneSelected}
          onClick={onClear}
        >
          Limpiar
        </Button>
      </div>
    </>
  );
}
