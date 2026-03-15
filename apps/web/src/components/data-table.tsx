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
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border/70 text-left text-sm">
          <thead className="bg-muted/50">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-5 py-4 font-medium text-muted-foreground">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-12 text-center text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={index} className={cn('bg-surface/70 transition hover:bg-muted/30')}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-5 py-4 align-top">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
