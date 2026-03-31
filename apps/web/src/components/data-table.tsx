import type { ReactNode } from 'react';

export function DataTable({
  columns,
  rows,
  emptyMessage = 'No data available.',
}: {
  columns: string[];
  rows: ReactNode[][];
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-border/40 bg-white p-8 text-center text-sm text-muted-foreground shadow-card">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/40 bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/40 bg-surface/40">
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-5 py-3.5 text-left text-xs font-medium text-muted-foreground"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="border-b border-border/20 last:border-0 transition-colors hover:bg-surface/30"
              >
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-5 py-3.5 text-sm text-foreground">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
