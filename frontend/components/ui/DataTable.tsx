import React, { useState, useMemo } from "react";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

export interface Column<T> {
  key: string;
  header: string;
  unit?: string;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  sortValue?: (item: T) => string | number | boolean | null | undefined;
  render: (item: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T | ((item: T) => string);
  onRowClick?: (item: T) => void;
  getRowHref?: (item: T) => string;
  enablePagination?: boolean;
  defaultPageSize?: number;
  pageSizeOptions?: number[];
  enableSearch?: boolean;
  searchPlaceholder?: string;
  enableExport?: boolean;
  exportFilename?: string;
  emptyMessage?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyField,
  onRowClick,
  getRowHref,
  enablePagination = true,
  defaultPageSize = 10,
  pageSizeOptions = [10, 25, 50, 100, 0],
  enableSearch,
  searchPlaceholder = "Search in table...",
  enableExport = true,
  exportFilename = "export-data",
  emptyMessage = "No matching records found.",
}: DataTableProps<T>) {
  // Sort state
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Pagination state
  const [pageSize, setPageSize] = useState<number>(defaultPageSize);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Auto-enable search for datasets with 8+ rows if not explicitly configured
  const showSearch = enableSearch !== undefined ? enableSearch : data.length >= 8;
  const showExport = enableExport && data.length > 0;

  // 1. Filtered data
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase().trim();

    return data.filter((item) => {
      // Check each column
      return columns.some((col) => {
        if (col.sortValue) {
          const val = col.sortValue(item);
          if (val !== null && val !== undefined && String(val).toLowerCase().includes(q)) {
            return true;
          }
        }
        const directVal = (item as Record<string, unknown>)[col.key];
        if (directVal !== null && directVal !== undefined && String(directVal).toLowerCase().includes(q)) {
          return true;
        }
        return false;
      });
    });
  }, [data, searchQuery, columns]);

  // 2. Sorted data
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return filteredData;

    return [...filteredData].sort((a, b) => {
      let valA: unknown = col.sortValue ? col.sortValue(a) : (a as Record<string, unknown>)[col.key];
      let valB: unknown = col.sortValue ? col.sortValue(b) : (b as Record<string, unknown>)[col.key];

      if (valA === null || valA === undefined) valA = "";
      if (valB === null || valB === undefined) valB = "";

      if (typeof valA === "number" && typeof valB === "number") {
        return sortDir === "asc" ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();

      const cmp = strA.localeCompare(strB, undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredData, sortKey, sortDir, columns]);

  // Reset to page 1 when search or sort changes
  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDir === "asc") {
        setSortDir("desc");
      } else {
        setSortKey(null);
        setSortDir("asc");
      }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setCurrentPage(1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setCurrentPage(1);
  };

  // 3. Paginated data
  const totalItems = sortedData.length;
  const isAll = pageSize === 0;
  const totalPages = isAll ? 1 : Math.ceil(totalItems / pageSize) || 1;
  const activePage = Math.min(Math.max(currentPage, 1), totalPages);

  const paginatedData = useMemo(() => {
    if (!enablePagination || isAll) return sortedData;
    const start = (activePage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, enablePagination, isAll, activePage, pageSize]);

  // CSV Export handler
  const handleExportCSV = () => {
    if (sortedData.length === 0) return;

    const headers = columns.map((col) => `"${col.header.replace(/"/g, '""')}"`);
    const rows = sortedData.map((item) => {
      return columns
        .map((col) => {
          let val: unknown = col.sortValue ? col.sortValue(item) : (item as Record<string, unknown>)[col.key];
          if (val === null || val === undefined) {
            val = "";
          }
          const cleanStr = String(val).replace(/"/g, '""');
          return `"${cleanStr}"`;
        })
        .join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute("href", url);
    link.setAttribute("download", `${exportFilename}-${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const startRecord = isAll ? 1 : Math.min((activePage - 1) * pageSize + 1, totalItems);
  const endRecord = isAll ? totalItems : Math.min(activePage * pageSize, totalItems);

  return (
    <div className="w-full space-y-3">
      {/* Top Table Controls: Search & CSV Export */}
      {(showSearch || showExport) && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-meta">
          <div className="flex-1 min-w-[200px] max-w-sm">
            {showSearch && (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder={searchPlaceholder}
                  className="w-full pl-8 pr-7 py-1.5 bg-bg border border-border rounded-sm text-meta text-text placeholder-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text p-0.5"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {showExport && (
              <button
                type="button"
                onClick={handleExportCSV}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-surface hover:bg-bg border border-border text-text rounded-sm text-meta font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-accent"
                title="Export active table rows to CSV"
              >
                <Download className="w-3.5 h-3.5 text-accent" />
                <span>Export CSV</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Table Container */}
      <div className="w-full overflow-x-auto bg-bg border border-border rounded-md shadow-xs">
        <table className="w-full border-collapse text-body">
          <thead>
            <tr className="border-b border-border bg-surface text-meta text-text-muted sticky top-0">
              {columns.map((col) => {
                const isSorted = sortKey === col.key;
                const canSort = col.sortable !== false;

                return (
                  <th
                    key={col.key}
                    onClick={canSort ? () => handleSort(col.key) : undefined}
                    className={`py-2.5 px-3 font-medium transition-colors select-none ${
                      canSort ? "cursor-pointer hover:text-text hover:bg-border/30" : ""
                    } ${
                      col.align === "right"
                        ? "text-right"
                        : col.align === "center"
                        ? "text-center"
                        : "text-left"
                    } ${isSorted ? "text-accent font-semibold" : ""}`}
                  >
                    <div
                      className={`inline-flex items-center space-x-1 ${
                        col.align === "right" ? "justify-end" : col.align === "center" ? "justify-center" : "justify-start"
                      }`}
                    >
                      <span>{col.header}</span>
                      {col.unit && <span className="text-text-muted font-normal ml-0.5">({col.unit})</span>}

                      {canSort && (
                        <span className="ml-1 text-text-muted">
                          {isSorted ? (
                            sortDir === "asc" ? (
                              <ArrowUp className="w-3.5 h-3.5 text-accent" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-accent" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-40 hover:opacity-100" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-8 px-4 text-center text-text-muted text-meta"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((item, index) => {
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
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {enablePagination && totalItems > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-meta text-text-muted">
          {/* Record range */}
          <div>
            Showing <span className="font-medium text-text font-mono">{startRecord}</span> to{" "}
            <span className="font-medium text-text font-mono">{endRecord}</span> of{" "}
            <span className="font-medium text-text font-mono">{totalItems}</span> records
          </div>

          <div className="flex items-center space-x-4">
            {/* Rows per page selector: 10, 25, 50, 100, All */}
            <div className="flex items-center space-x-1.5">
              <span>Rows per page:</span>
              <div className="inline-flex border border-border rounded-sm overflow-hidden bg-bg">
                {pageSizeOptions.map((opt) => {
                  const label = opt === 0 ? "All" : String(opt);
                  const isSelected = pageSize === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setPageSize(opt);
                        setCurrentPage(1);
                      }}
                      className={`px-2 py-0.5 text-xs font-mono font-medium transition-colors ${
                        isSelected
                          ? "bg-accent text-accent-fg"
                          : "text-text hover:bg-surface"
                      } border-r border-border last:border-r-0`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Page navigation buttons */}
            {!isAll && totalPages > 1 && (
              <div className="inline-flex items-center space-x-1">
                <button
                  type="button"
                  disabled={activePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  className="p-1 border border-border rounded-sm bg-bg hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4 text-text" />
                </button>

                <span className="px-2 font-mono text-text">
                  Page {activePage} of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={activePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  className="p-1 border border-border rounded-sm bg-bg hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4 text-text" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
