import type { ReactNode } from 'react';

import { Card, cn } from '@study-assistant/ui';

export function DataTable({
  columns,
  rows,
  emptyMessage = 'No rows available.',
}: {
  columns: string[];
  rows: ReactNode[][];
  emptyMessage?: string;
}) {
  return (
    <div className="border-4 border-black bg-background shadow-solid-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm border-collapse">
          <thead className="bg-surface border-b-4 border-black">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-5 py-4 font-black uppercase tracking-widest text-black border-r-2 border-border/50 last:border-r-0">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-border font-medium">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-16 text-center text-muted-foreground font-black uppercase tracking-widest bg-surface/50">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={index} className="bg-background transition-colors hover:bg-accent/10 group">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-5 py-4 align-top border-r-2 border-border/50 text-foreground group-hover:text-black font-semibold">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
