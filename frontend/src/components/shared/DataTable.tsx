import { useState, useCallback, useRef, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  crmTableBodyRowClassInteractive,
  crmTableHeaderRowClass,
  crmTableHeaderRowClassSticky,
} from "@/lib/crmTableSurface";

export type { ColumnDef } from "@tanstack/react-table";

export type EditType = "text" | "number" | "date" | "datetime-local" | "select";

interface DataTableProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  onRowSelectionChange?: (ids: string[]) => void;
  getId: (row: TData) => string;
  onCellEdit?: (
    row: TData,
    columnId: string,
    newValue: string,
  ) => Promise<void>;
  readOnlyColumns?: string[];
  editTypes?: Record<string, EditType>;
  editOptions?: Record<string, { label: string; value: string }[]>;
  /** Called when user starts editing a cell. Return true to prevent default editing. */
  onEditStart?: (row: TData, columnId: string) => boolean | void;
  /** Custom filter components by column ID. Replaces the default text input. */
  filterComponents?: Record<string, React.ReactNode>;
  /** Max height for vertical scroll. */
  maxHeight?: string;
  /** Called when a column filter value changes. */
  onFilterChange?: (columnId: string, value: string) => void;
  /** Current filter values by column ID. */
  filterValues?: Record<string, string>;
}

export function DataTable<TData>({
  columns,
  data,
  onRowSelectionChange,
  getId,
  onCellEdit,
  readOnlyColumns = ["select", "actions"],
  editTypes,
  editOptions,
  onEditStart,
  filterComponents,
  maxHeight,
  onFilterChange,
  filterValues,
}: DataTableProps<TData>) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    columnId: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingCell, setSavingCell] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  const startEdit = useCallback(
    (rowId: string, columnId: string, currentValue: string) => {
      const rowIdx = table.getRowModel().rows.findIndex((r) => r.id === rowId);
      if (rowIdx === -1 || !data[rowIdx]) return;
      if (onEditStart?.(data[rowIdx], columnId)) return;
      setEditingCell({ rowId, columnId });
      setEditValue(currentValue);
    },
    [data, onEditStart],
  );

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue("");
  }, []);

  const saveEdit = useCallback(
    async (rowId: string, columnId: string) => {
      if (!onCellEdit) return;
      setSavingCell(true);
      try {
        const rowIdx = table
          .getRowModel()
          .rows.findIndex((r) => r.id === rowId);
        if (rowIdx === -1 || !data[rowIdx]) return;
        await onCellEdit(data[rowIdx], columnId, editValue);
      } finally {
        setSavingCell(false);
        setEditingCell(null);
        setEditValue("");
      }
    },
    [onCellEdit, data, editValue],
  );

  const isEditing = (rowId: string, columnId: string) =>
    editingCell?.rowId === rowId && editingCell?.columnId === columnId;

  const table = useReactTable({
    data,
    columns,
    state: { rowSelection, sorting },
    onRowSelectionChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(rowSelection) : updater;
      setRowSelection(next);
      const selectedIds = Object.keys(next)
        .filter((k) => next[k])
        .map((k) => getId(data[parseInt(k)]));
      onRowSelectionChange?.(selectedIds);
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: true,
    enableSorting: true,
    enableSortingRemoval: false,
    defaultColumn: {
      minSize: 80,
      size: 130,
      maxSize: 500,
    },
    enableColumnResizing: true,
    columnResizeMode: "onChange",
  });

  const rows = table.getRowModel().rows;

  return (
    <div className="overflow-hidden">
      <div
        className="overflow-auto scrollbar-thin"
        style={{ maxHeight }}
      >
        <table
          className="w-full border-collapse"
          style={{ width: table.getCenterTotalSize() }}
        >
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className={cn("h-[36px]", crmTableHeaderRowClassSticky)}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 align-middle overflow-hidden text-[11px] font-bold whitespace-nowrap text-[#647789] dark:text-gray-400 border-r last:border-r-0 border-border/50 relative select-none"
                    style={{ width: header.getSize() }}
                  >
                    {header.column.getCanSort() ? (
                      <button
                        type="button"
                        className="flex items-center gap-1 w-full"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {{
                          asc: <ChevronUp className="size-4 shrink-0" />,
                          desc: <ChevronDown className="size-4 shrink-0" />,
                        }[header.column.getIsSorted() as string] ?? (
                          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground/50" />
                        )}
                      </button>
                    ) : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )
                    )}
                    {header.column.getCanResize() && (
                      <div
                        className="resizer absolute right-0 top-0 h-full w-1 cursor-col-resize bg-border/50 hover:bg-foreground/30 transition-colors"
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                      />
                    )}
                  </th>
                ))}
              </tr>
            ))}
            <tr className={crmTableHeaderRowClass} style={{ top: 36, position: 'sticky', zIndex: 10 }}>
              {table.getHeaderGroups().map((headerGroup) =>
                headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-1 border-r last:border-r-0 border-border/50"
                    style={{ width: header.getSize() }}
                  >
                    {filterComponents?.[header.column.id] ??
                      (header.column.getCanFilter() ? (
                        <DebouncedFilterInput
                          value={filterValues?.[header.column.id] ?? ""}
                          onChange={(v) =>
                            onFilterChange?.(header.column.id, v)
                          }
                        />
                      ) : null)}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-12 text-center text-muted-foreground"
                >
                  No se encontraron resultados
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  data-row-id={(row.original as any)?.id || row.id}
                  className={cn("h-[48px] last:border-b-0", crmTableBodyRowClassInteractive)}
                >
                  {row.getVisibleCells().map((cell) => {
                    const colId = cell.column.id;
                    const canEdit =
                      onCellEdit && !readOnlyColumns.includes(colId);
                    const editing = isEditing(row.id, colId);

                    return (
                      <td
                        key={cell.id}
                                                className={`${(colId === 'actions' || colId === 'select') ? 'px-1' : 'px-3'} align-middle overflow-hidden border-r last:border-r-0 border-border/50`}
                        style={{ width: cell.column.getSize() }}
                        onClick={
                          editing
                            ? undefined
                            : () => {
                                if (!canEdit) return;
                                const cellFn = cell.column.columnDef.cell;
                                let el: unknown;
                                if (typeof cellFn === "function") {
                                  const rendered = (
                                    cellFn as (ctx: unknown) => unknown
                                  )(cell.getContext());
                                  el =
                                    typeof rendered === "string"
                                      ? rendered
                                      : cell.getContext().getValue();
                                } else {
                                  el = cell.getContext().getValue();
                                }
                                startEdit(row.id, colId, String(el ?? ""));
                              }
                        }
                      >
                        {editing ? (
                          editTypes?.[colId] === "select" ? (
                            <Select
                              value={editValue}
                              onValueChange={(v) => {
                                setEditValue(v);
                                setEditingCell(null);
                                if (onCellEdit) {
                                  const rowIdx = rows.findIndex(
                                    (r) => r.id === row.id,
                                  );
                                  if (rowIdx !== -1 && data[rowIdx]) {
                                    void onCellEdit(data[rowIdx], colId, v);
                                  }
                                }
                              }}
                              onOpenChange={(open) => {
                                if (!open) cancelEdit();
                              }}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(editOptions?.[colId] || []).map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <input
                              ref={inputRef}
                              type={editTypes?.[colId] || "text"}
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter")
                                  void saveEdit(row.id, colId);
                                if (e.key === "Escape") cancelEdit();
                              }}
                              onBlur={() => {
                                if (!savingCell) void saveEdit(row.id, colId);
                              }}
                              className="h-7 w-full rounded border border-ring bg-background px-1.5 text-xs outline-none"
                              disabled={savingCell}
                            />
                          )
                        ) : (
                          flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DebouncedFilterInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [local, setLocal] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setLocal(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChangeRef.current(v), 300);
  };

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return (
    <input
      type="text"
      placeholder="Filtrar..."
      value={local}
      onChange={handleChange}
      className="w-full h-6 rounded border border-input bg-background px-1.5 text-[10px] outline-none focus:border-ring"
    />
  );
}
