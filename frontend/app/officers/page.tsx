"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../components/ui/AppShell";
import { KpiCard } from "../../components/ui/KpiCard";
import { DataTable, Column } from "../../components/ui/DataTable";
import { ErrorState } from "../../components/ui/ErrorState";
import { EmptyState } from "../../components/ui/EmptyState";
import { getOfficers, OfficerListItem } from "../../lib/api";

export default function OfficersPage() {
  const router = useRouter();

  const [officers, setOfficers] = useState<OfficerListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const fetchOfficers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getOfficers({
        role: roleFilter === "all" ? undefined : roleFilter,
      });
      setOfficers(res.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load officers list");
    } finally {
      setLoading(false);
    }
  }, [roleFilter]);

  useEffect(() => {
    fetchOfficers();
  }, [fetchOfficers]);

  const filteredOfficers = useMemo(() => {
    if (!searchQuery.trim()) return officers;
    const q = searchQuery.toLowerCase();
    return officers.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.user_id.toLowerCase().includes(q) ||
        (o.district && o.district.toLowerCase().includes(q)) ||
        (o.taluka && o.taluka.toLowerCase().includes(q))
    );
  }, [officers, searchQuery]);

  const stats = useMemo(() => {
    const totalOfficers = officers.length;
    const totalAssigned = officers.reduce((acc, o) => acc + o.stats.assigned_cases, 0);
    const totalOpen = officers.reduce((acc, o) => acc + o.stats.open_cases, 0);
    const totalOverdue = officers.reduce((acc, o) => acc + o.stats.overdue_cases, 0);

    return { totalOfficers, totalAssigned, totalOpen, totalOverdue };
  }, [officers]);

  const columns: Column<OfficerListItem>[] = [
    {
      key: "name",
      header: "Officer Name",
      render: (item) => (
        <div>
          <div className="font-medium text-text text-body">{item.name}</div>
          <div className="text-meta text-text-muted font-mono text-[11px]">{item.user_id}</div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (item) => (
        <span className="capitalize text-meta font-medium px-2 py-0.5 rounded bg-surface border border-border text-text">
          {item.role.replace("_", " ")}
        </span>
      ),
    },
    {
      key: "jurisdiction",
      header: "Jurisdiction",
      render: (item) => (
        <div className="text-meta text-text">
          {item.taluka ? `${item.district} • ${item.taluka}` : item.district ? `${item.district} District` : "State"}
        </div>
      ),
    },
    {
      key: "assigned",
      header: "Assigned",
      render: (item) => (
        <span className="font-mono text-text tabular-nums">{item.stats.assigned_cases}</span>
      ),
    },
    {
      key: "open",
      header: "Open Cases",
      render: (item) => (
        <span className="font-mono text-text tabular-nums">{item.stats.open_cases}</span>
      ),
    },
    {
      key: "overdue",
      header: "Overdue",
      render: (item) => (
        <span
          className={`font-mono tabular-nums font-semibold ${
            item.stats.overdue_cases > 0 ? "text-risk-high" : "text-text-muted"
          }`}
        >
          {item.stats.overdue_cases}
        </span>
      ),
    },
    {
      key: "confirmed_rate",
      header: "Confirmed Rate",
      render: (item) => (
        <span className="font-mono text-text tabular-nums">
          {item.stats.confirmed_rate !== null && item.stats.confirmed_rate !== undefined
            ? `${(item.stats.confirmed_rate * 100).toFixed(1)}%`
            : "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item) => (
        <span
          className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
            item.is_active ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"
          }`}
        >
          {item.is_active ? "Active" : "Inactive"}
        </span>
      ),
    },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-title font-semibold text-text tracking-tight">
            Inspection Officers
          </h1>
          <p className="text-meta text-text-muted mt-1">
            Operational workload, case distribution, and verification performance across field officers in your scope.
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard
            label="Officers in Scope"
            value={stats.totalOfficers}
            unit="officers"
            context="Field and supervisory personnel"
          />
          <KpiCard
            label="Total Cases Assigned"
            value={stats.totalAssigned}
            unit="cases"
            context="Cumulative assignments"
          />
          <KpiCard
            label="Active Open Workload"
            value={stats.totalOpen}
            unit="cases"
            context="In progress or under verification"
          />
          <KpiCard
            label="Overdue Workload"
            value={stats.totalOverdue}
            unit="cases"
            context="Actions pending > 7 days"
          />
        </div>

        {/* Controls Bar */}
        <div className="bg-surface border border-border rounded-md p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center space-x-2">
            <label htmlFor="officer-role-filter" className="text-meta font-medium text-text-muted">
              Role:
            </label>
            <select
              id="officer-role-filter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="text-meta border border-border rounded px-2.5 py-1.5 bg-background text-text focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="all">All Roles</option>
              <option value="inspector">Inspectors</option>
              <option value="mamlatdar">Mamlatdars</option>
              <option value="district_officer">District Officers</option>
              <option value="vigilance">Vigilance</option>
              <option value="admin">Administrators</option>
            </select>
          </div>

          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="Search officer name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-meta border border-border rounded px-3 py-1.5 bg-background text-text placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>

        {/* Table / States */}
        {error ? (
          <ErrorState message={error} onRetry={fetchOfficers} />
        ) : loading ? (
          <div className="bg-surface border border-border rounded-md p-12 text-center text-meta text-text-muted animate-pulse">
            Loading officer roster...
          </div>
        ) : filteredOfficers.length === 0 ? (
          <EmptyState
            title="No officers found"
            message="No officers match the current filter selection."
            actionLabel="Reset filters"
            onAction={() => {
              setRoleFilter("all");
              setSearchQuery("");
            }}
          />
        ) : (
          <DataTable
            columns={columns}
            data={filteredOfficers}
            keyField="user_id"
            exportFilename="officers-roster"
            defaultPageSize={25}
            onRowClick={(item) => router.push(`/officers/${item.user_id}`)}
          />
        )}
      </div>
    </AppShell>
  );
}
