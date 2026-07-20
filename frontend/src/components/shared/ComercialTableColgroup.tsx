import type { Column } from '@tanstack/react-table';
import { comercialTableFixedColStyle } from '@/lib/comercialTableLayout';

type ComercialTableColgroupProps<T> = {
  columns: Column<T, unknown>[];
};

export function ComercialTableColgroup<T>({ columns }: ComercialTableColgroupProps<T>) {
  return (
    <colgroup>
      {columns.map((column) => (
        <col key={column.id} style={comercialTableFixedColStyle(column.id)} />
      ))}
    </colgroup>
  );
}
