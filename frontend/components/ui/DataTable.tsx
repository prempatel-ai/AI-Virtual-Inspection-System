import React from "react";

export interface Column<T> {
  key: string;
  header: string;
  unit?: string;
  align?: "left" | "right" | "center";
  render: (item: T, index: number) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T | ((item: T) => string);
  onRowClick?: (item: T) => void;
  getRowHref?: (item: T) => string;
}

export function DataTable<T>({
  columns,
  data,
  keyField,
  onRowClick,
  getRowHref,
}: DataTableProps<T>) {
  return (
    <div className="w-full overflow-x-auto bg-bg border border-border rounded-md">
      <table className="w-full border-collapse text-body">
        <thead>
          <tr className="border-b border-border bg-surface text-meta text-text-muted sticky top-0">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`py-2 px-3 font-medium ${
                  col.align === "right"
                    ? "text-right"
                    : col.align === "center"
                    ? "text-center"
                    : "text-left"
                }`}
              >
                <span>{col.header}</span>
                {col.unit && <span className="text-text-muted font-normal ml-1">({col.unit})</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => {
            const key = typeof keyField === "function" ? keyField(item) : String(item[keyField]);
            const href = getRowHref ? getRowHref(item) : undefined;

            const handleNavigate = () => {
              if (onRowClick) {
                onRowClick(item);
              } else if (href && typeof window !== "undefined") {
                window.location.href = href;
              }
            };

            return (
              <tr
                key={key}
                tabIndex={0}
                onClick={handleNavigate}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleNavigate();
                  }
                }}
                className={`border-b border-border last:border-b-0 h-[44px] hover:bg-surface transition-colors ${
                  href || onRowClick ? "cursor-pointer focus:bg-surface focus:outline-none" : ""
                }`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`py-2 px-3 ${
                      col.align === "right"
                        ? "text-right tabular-nums"
                        : col.align === "center"
                        ? "text-center"
                        : "text-left"
                    }`}
                  >
                    {href && (col.key === "shop" || col.key === "rank" || col === columns[0] || col === columns[1]) ? (
                      <a
                        href={href}
                        onClick={(e) => {
                          if (onRowClick) {
                            e.preventDefault();
                            onRowClick(item);
                          }
                        }}
                        className="text-accent font-medium hover:underline block"
                      >
                        {col.render(item, index)}
                      </a>
                    ) : (
                      col.render(item, index)
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
