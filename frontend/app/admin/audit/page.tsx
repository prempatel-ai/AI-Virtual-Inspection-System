"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { AppShell } from "../../../components/ui/AppShell";
import { DataTable, Column } from "../../../components/ui/DataTable";
import { ErrorState } from "../../../components/ui/ErrorState";
import { EmptyState } from "../../../components/ui/EmptyState";
import { TableSkeleton } from "../../../components/ui/Skeleton";
import { getAdminAudit, AuditLogItem } from "../../../lib/api";
import { formatDate } from "../../../lib/format";
import { useAuth } from "../../../lib/auth";

export default function AdminAuditPage() {
  const { hasPermission } = useAuth();

  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminAudit({
        event: eventFilter === "all" ? undefined : eventFilter,
        limit: 100,
      });
      setLogs(res.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load audit events");
    } finally {
      setLoading(false);
    }
  }, [eventFilter]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const q = searchQuery.toLowerCase();
    return logs.filter(
      (l) =>
        (l.actor_id && l.actor_id.toLowerCase().includes(q)) ||
        (l.target_user_id && l.target_user_id.toLowerCase().includes(q)) ||
        l.event.toLowerCase().includes(q) ||
        (l.ip && l.ip.includes(q))
    );
  }, [logs, searchQuery]);

  const formatEventBadge = (event: string) => {
    let colorClasses = "bg-surface border-border text-text";
    if (event === "login_success") colorClasses = "bg-emerald-50 text-emerald-800 border-emerald-200";
    else if (event === "login_failure" || event === "access_denied")
      colorClasses = "bg-risk-high-bg text-risk-high border-red-200";
    else if (event.startsWith("user_") || event === "password_reset")
      colorClasses = "bg-blue-50 text-blue-800 border-blue-200";

    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-meta font-semibold border ${colorClasses}`}
      >
        {event.replace(/_/g, " ")}
      </span>
    );
  };

  const columns: Column<AuditLogItem>[] = [
    {
      key: "created_at",
      header: "Timestamp",
      render: (item) => (
        <div className="text-meta">
          <div className="font-mono text-text font-medium">{formatDate(item.created_at)}</div>
          <div className="text-text-muted text-[11px] font-mono">
            {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>
        </div>
      ),
    },
    {
      key: "event",
      header: "Audit Event",
      render: (item) => formatEventBadge(item.event),
    },
    {
      key: "actor",
      header: "Actor ID",
      render: (item) => (
        <span className="font-mono text-meta font-medium text-text">
          {item.actor_id || <span className="text-text-muted italic">Anonymous / System</span>}
        </span>
      ),
    },
    {
      key: "target",
      header: "Target User",
      render: (item) => (
        <span className="font-mono text-meta text-text">
          {item.target_user_id || "—"}
        </span>
      ),
    },
    {
      key: "ip",
      header: "IP Address",
      render: (item) => (
        <span className="font-mono text-meta text-text-muted">
          {item.ip || "—"}
        </span>
      ),
    },
    {
      key: "detail",
      header: "Event Context & Metadata",
      render: (item) => {
        const details = item.detail || {};
        return (
          <div className="text-meta text-text text-xs space-y-0.5 max-w-md font-mono">
            {Object.entries(details).map(([k, v]) => (
              <div key={k} className="truncate">
                <span className="text-text-muted">{k}: </span>
                <span>{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
              </div>
            ))}
          </div>
        );
      },
    },
  ];

  if (!hasPermission("audit:view")) {
    return (
      <AppShell>
        <ErrorState message="You do not have administrative permission to view the security audit log." />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-title font-semibold text-text tracking-tight">
            Security Access & Audit Log
          </h1>
          <p className="text-meta text-text-muted mt-1">
            Immutable, append-only security log tracking authentication events, authorization checks, and administrative updates.
          </p>
        </div>

        {/* Filters */}
        <div className="bg-surface border border-border rounded-md p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center space-x-2">
            <label htmlFor="audit-event-filter" className="text-meta font-medium text-text-muted">
              Event Type:
            </label>
            <select
              id="audit-event-filter"
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="text-meta border border-border rounded px-2.5 py-1.5 bg-background text-text focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="all">All Events</option>
              <option value="login_success">Login Success</option>
              <option value="login_failure">Login Failure</option>
              <option value="access_denied">Access Denied (403/404)</option>
              <option value="user_created">User Created</option>
              <option value="user_updated">User Updated</option>
              <option value="password_reset">Password Reset</option>
            </select>
          </div>

          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="Search by actor, target, IP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-meta border border-border rounded px-3 py-1.5 bg-background text-text placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>

        {/* Table & States */}
        {error ? (
          <ErrorState message={error} onRetry={fetchAudit} />
        ) : loading ? (
          <TableSkeleton rows={8} cols={5} />
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            title="No audit events found"
            message="No security events match the current filter selection."
            actionLabel="Reset filters"
            onAction={() => {
              setEventFilter("all");
              setSearchQuery("");
            }}
          />
        ) : (
          <DataTable
            columns={columns}
            data={filteredLogs}
            keyField="id"
            exportFilename="security-audit-log"
            defaultPageSize={10}
          />
        )}
      </div>
    </AppShell>
  );
}
