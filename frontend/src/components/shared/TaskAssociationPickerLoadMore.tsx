import { Button } from '@/components/ui/button';
import { TASK_ASSOCIATION_PICKER_BATCH_SIZE } from '@/lib/taskAssociationPicker';

type TaskAssociationPickerLoadMoreProps = {
  visibleCount: number;
  totalCount: number;
  onShowMore: () => void;
  batchSize?: number;
};

export function TaskAssociationPickerLoadMore({
  visibleCount,
  totalCount,
  onShowMore,
  batchSize = TASK_ASSOCIATION_PICKER_BATCH_SIZE,
}: TaskAssociationPickerLoadMoreProps) {
  if (visibleCount >= totalCount || totalCount === 0) return null;

  const remaining = totalCount - visibleCount;
  const nextBatch = Math.min(batchSize, remaining);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="mt-1 h-8 w-full text-xs text-muted-foreground hover:text-foreground"
      onClick={onShowMore}
    >
      Cargar más ({nextBatch} de {remaining})
    </Button>
  );
}
