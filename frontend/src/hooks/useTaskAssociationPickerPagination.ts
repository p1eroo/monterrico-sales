import { useCallback, useEffect, useState } from 'react';
import { TASK_ASSOCIATION_PICKER_BATCH_SIZE } from '@/lib/taskAssociationPicker';

/** Reinicia el lote visible al cambiar pestaña o búsqueda del picker de asociaciones. */
export function useTaskAssociationPickerPagination(
  resetKey: string,
  batchSize = TASK_ASSOCIATION_PICKER_BATCH_SIZE,
) {
  const [visibleCount, setVisibleCount] = useState(batchSize);

  useEffect(() => {
    setVisibleCount(batchSize);
  }, [resetKey, batchSize]);

  const showMore = useCallback(() => {
    setVisibleCount((n) => n + batchSize);
  }, [batchSize]);

  return { visibleCount, showMore };
}
