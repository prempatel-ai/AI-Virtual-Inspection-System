"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../components/ui/AppShell";
import { KpiCard } from "../../components/ui/KpiCard";
import { DataTable, Column } from "../../components/ui/DataTable";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { RiskBadge } from "../../components/ui/RiskBadge";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { getCases, CaseListItem } from "../../lib/api";
import { useAuth } from "../../lib/auth";

export default function QueuePage() {
  const router = useRouter();
  const { user, scope } = useAuth();

  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [bandFilter, setBandFilter] = useState<string>("all");
  const [onlyOverdue, setOnlyOverdue] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCases({
        status: statusFilter === "all" ? undefined : statusFilter,
        band: bandFilter === "all" ? undefined : bandFilter,
        overdue: onlyOverdue ? true : undefined,
      });
      setCases(res.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load case queue");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, bandFilter, onlyOverdue]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Derived filtered items based on client-side search query
  const filteredCases = useMemo(() => {
    if (!searchQuery.trim()) return cases;
    const q = searchQuery.toLowerCase();
    return cases.filter(
      (c) =>
        c.shop_name.toLowerCase().includes(q) ||
        c.shop_id.toLowerCase().includes(q) ||
        c.taluka.toLowerCase().includes(q) ||
        c.district.toLowerCase().includes(q) ||
        c.case_id.toLowerCase().includes(q)
    );
  }, [cases, searchQuery]);

  // KPIs
  const stats = useMemo(() => {
    const total = cases.length;
    const open = cases.filter((c) => c.status !== "closed").length;
    const overdue = cases.filter((c) => c.is_overdue).length;
    const inspected = cases.filter((c) => c.status === "inspected" || c.status === "closed").length;
    const highRisk = cases.filter((c) => c.band_latest.toLowerCase() === "high").length;

    return { total, open, overdue, inspected, highRisk };
  }, [cases]);

  const columns: Column<CaseListItem>[] = [
    {
      key: "case_id",
      header: "Case ID",
      render: (item) => (
        <span className="font-mono text-meta font-semibold text-accent">
          {item.case_id}
        </span>
      ),
    },
    {
      key: "shop",
      header: "Shop Details",
      render: (item) => (
        <div>
          <div className="font-medium text-text text-body leading-tight">
            {item.shop_name}
          </div>
          <div className="text-meta text-text-muted font-mono text-[11px]">
            {item.shop_id}
          </div>
        </div>
      ),
    },
    {
      key: "location",
      header: "Taluka / District",
      render: (item) => (
        <div>
          <div className="text-body text-text font-medium">{item.taluka}</div>
          <div className="text-meta text-text-muted">{item.district}</div>
        </div>
      ),
    },
    {
      key: "score",
      header: "Priority Score",
      render: (item) => (
        <div className="flex items-center space-x-2">
          <span className="font-mono font-semibold text-body text-text">
            {item.risk_score_latest.toFixed(1)}
          </span>
          <RiskBadge level={item.band_latest} />
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item) => (
        <StatusBadge status={item.status} isOverdue={item.is_overdue} />
      ),
    },
    {
      key: "days_open",
      header: "Opened",
      render: (item) => (
        <span className="text-meta text-text-muted font-mono">
          {item.opened_week}
        </span>
      ),
    },
    {
      key: "assignee",
      header: "Assignee",
      render: (item) => (
        <span className="text-meta text-text">
          {item.assignee_name || (
            <span className="text-text-muted italic">Unassigned</span>
          )}
        </span>
      ),
    },
  ];

  const scopeLabel = scope?.taluka
    ? `${scope.district} • ${scope.taluka}`
    : scope?.district
    ? `${scope.district} District`
    : "State Jurisdiction";

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-title font-semibold text-text tracking-tight">
            Inspection Queue
          </h1>
          <p className="text-meta text-text-muted mt-1">
            {user?.role === "inspector"
              ? "Assigned fair price shops requiring virtual verification or on-site field visits."
              : `Active flagged cases within your jurisdiction (${scopeLabel}).`}
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard
            label="Open Cases"
            value={stats.open}
            unit="active"
            context={`${stats.total} total cases in scope`}
          />
          <KpiCard
            label="Overdue Inspection"
            value={stats.overdue}
            unit="cases"
            context="Past 7-day action threshold"
          />
          <KpiCard
            label="High Risk Cases"
            value={stats.highRisk}
            unit="cases"
            context="Priority attention required"
          />
          <KpiCard
            label="Inspected / Closed"
            value={stats.inspected}
            unit="completed"
            context="Verification recorded"
          />
        </div>

        {/* Filter Bar */}
        <div className="bg-surface border border-border rounded-md p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-1.5">
              <label htmlFor="queue-status-filter" className="text-meta font-medium text-text-muted">
                Status:
              </label>
              <select
                id="queue-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-meta border border-border rounded px-2.5 py-1.5 bg-background text-text focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="all">All statuses</option>
                <option value="new">New</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="inspected">Inspected</option>
                <option value="escalated">Escalated</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div className="flex items-center space-x-1.5">
              <label htmlFor="queue-band-filter" className="text-meta font-medium text-text-muted">
                Risk Band:
              </label>
              <select
                id="queue-band-filter"
                value={bandFilter}
                onChange={(e) => setBandFilter(e.target.value)}
                className="text-meta border border-border rounded px-2.5 py-1.5 bg-background text-text focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="all">All bands</option>
                <option value="high">High Risk</option>
                <option value="medium">Medium Risk</option>
                <option value="low">Low Risk</option>
              </select>
            </div>

            <label className="flex items-center space-x-1.5 cursor-pointer text-meta text-text font-medium select-none">
              <input
                type="checkbox"
                checked={onlyOverdue}
                onChange={(e) => setOnlyOverdue(e.target.checked)}
                className="rounded border-border text-accent focus:ring-accent h-4 w-4"
              />
              <span>Only Overdue ({">"} 7d)</span>
            </label>
          </div>

          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="Search shop name, code, or area..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-meta border border-border rounded px-3 py-1.5 bg-background text-text placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>

        {/* Content Table / States */}
        {error ? (
          <ErrorState
            message={error}
            onRetry={fetchQueue}
          />
        ) : loading ? (
          <div className="bg-surface border border-border rounded-md p-12 text-center text-meta text-text-muted animate-pulse">
            Loading inspection queue...
          </div>
        ) : filteredCases.length === 0 ? (
          <EmptyState
            title="No cases found"
            message={
              cases.length === 0
                ? "You currently have no cases matching your scope."
                : "No cases match the selected filter criteria."
            }
            actionLabel="Reset filters"
            onAction={() => {
              setStatusFilter("all");
              setBandFilter("all");
              setOnlyOverdue(false);
              setSearchQuery("");
            }}
          />
        ) : (
          <DataTable
            columns={columns}
            data={filteredCases}
            keyField="case_id"
            onRowClick={(item) => router.push(`/cases/${item.case_id}`)}
          />
        )}
      </div>
    </AppShell>
  );
}
