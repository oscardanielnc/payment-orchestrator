import type { ReactNode } from 'react';

export interface Column<Row> {
  header: string;
  cell: (row: Row) => ReactNode;
  align?: 'left' | 'right';
}

export interface DataTableProps<Row> {
  caption: string;
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  onRowClick?: (row: Row) => void;
}

/** Dense, readable table (not cards). Rows with onRowClick are keyboard-operable. */
export function DataTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  onRowClick,
}: DataTableProps<Row>) {
  return (
    <div className="overflow-x-auto rounded-md border border-line bg-surface">
      <table className="w-full border-collapse text-[13px] leading-[18px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.header}
                scope="col"
                className={`border-b border-line px-3 py-2 text-xs font-semibold tracking-wide text-muted uppercase ${column.align === 'right' ? 'text-right' : 'text-left'}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={
                onRowClick
                  ? (event) => {
                      if (event.key === 'Enter') onRowClick(row);
                    }
                  : undefined
              }
              className={`border-b border-line last:border-b-0 ${onRowClick ? 'cursor-pointer hover:bg-surface-accent focus:bg-surface-accent' : ''}`}
            >
              {columns.map((column) => (
                <td
                  key={column.header}
                  className={`px-3 py-2.5 align-top ${column.align === 'right' ? 'text-right' : ''}`}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
