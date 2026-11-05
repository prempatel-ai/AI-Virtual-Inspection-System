"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../components/ui/AppShell";
import { DataTable, Column } from "../../components/ui/DataTable";
import { ErrorState } from "../../components/ui/ErrorState";
import { EmptyState } from "../../components/ui/EmptyState";
import { getActionFeed, ActionFeedItem } from "../../lib/api";
import { formatDate } from "../../lib/format";

export default function ActionsPage() {
  const router = useRouter();

  const [actions, setActions] = useState<ActionFeedItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const fetchActions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getActionFeed({
        type: typeFilter === "all" ? undefined : typeFilter,
        limit: 100,
      });
      setActions(res.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load activity feed");
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  const filteredActions = useMemo(() => {
    if (!searchQuery.trim()) return actions;
    const q = searchQuery.toLowerCase();
    return actions.filter(
      (a) =>
        a.shop_name.toLowerCase().includes(q) ||
        a.shop_id.toLowerCase().includes(q) ||
        a.case_id.toLowerCase().includes(q) ||
        (a.actor_name && a.actor_name.toLowerCase().includes(q))
    );
  }, [actions, searchQuery]);

  const formatActionName = (type: string) => {
    switch (type) {
      case "create":
        return "Case Opened";
      case "assign":
        return "Assigned";
      case "start_inspection":
        return "Started Inspection";
      case "record_outcome":
        return "Recorded Outcome";
      case "add_note":
        return "Note Added";
      case "escalate":
        return "Escalated";
      case "reassign":
        return "Reassigned";
      case "close":
        return "Closed";
      case "reopen":
        return "Reopened";
      default:
        return type.replace(/_/g, " ");
    }
  };

  const columns: Column<ActionFeedItem>[] = [
    {
      key: "created_at",
      header: "Timestamp",
      render: (item) => (
        <div className="text-meta">
          <div className="font-mono text-text font-medium">{formatDate(item.created_at)}</div>
          <div className="text-text-muted text-[11px] font-mono">
            {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      ),
    },
    {
      key: "case",
      header: "Case & Shop",
      render: (item) => (
        <div>
          <span className="font-mono text-meta font-semibold text-accent block hover:underline">
            {item.case_id}
          </span>
          <span className="font-medium text-text text-body">{item.shop_name}</span>
          <span className="text-meta text-text-muted font-mono text-[11px] block">{item.shop_id}</span>
        </div>
      ),
    },
    {
      key: "actor",
      header: "Officer / Actor",
      render: (item) => (
        <div>
          <div className="font-medium text-text text-body">{item.actor_name || "System"}</div>
          <div className="text-meta text-text-muted capitalize text-[11px]">
            {item.actor_role.replace("_", " ")}
          </div>
        </div>
      ),
    },
    {
      key: "action",
      header: "Action Taken",
      render: (item) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-meta font-semibold bg-surface border border-border text-text">
          {formatActionName(item.type)}
        </span>
      ),
    },
    {
      key: "details",
      header: "Notes & Findings",
      render: (item) => {
        const p = item.payload || {};
        return (
          <div className="text-meta text-text text-xs space-y-0.5 max-w-md">
            {Boolean(p.reason) && (
              <div>
                <span className="text-text-muted font-medium">Reason: </span>
                <span>{String(p.reason)}</span>
              </div>
            )}
            {Boolean(p.note) && (
              <div>
                <span className="text-text-muted font-medium">Note: </span>
                <span>{String(p.note)}</span>
              </div>
            )}
            {Boolean(p.action_taken) && (
              <div>
                <span className="text-text-muted font-medium">Enforcement: </span>
                <span className="capitalize">{String(p.action_taken).replace(/_/g, " ")}</span>
              </div>
            )}
            {Boolean(p.outcome) && (
              <div>
                <span className="text-text-muted font-medium">Finding: </span>
                <span className="font-semibold capitalize">{String(p.outcome)}</span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: "score",
      header: "Risk Score",
      render: (item) => (
        <span className="font-mono text-text tabular-nums font-semibold">
          {item.risk_score_at_action !== null && item.risk_score_at_action !== undefined
            ? item.risk_score_at_action.toFixed(1)
            : "—"}
        </span>
      ),
    },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-title font-semibold text-text tracking-tight">
            Case Activity Feed
          </h1>
          <p className="text-meta text-text-muted mt-1">
            Immutable chronicle of all inspections, reassignments, escalations, and outcomes recorded in your jurisdiction.
          </p>
        </div>

        {/* Filters */}
        <div className="bg-surface border border-border rounded-md p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center space-x-2">
            <label htmlFor="action-type-filter" className="text-meta font-medium text-text-muted">
              Action Type:
            </label>
            <select
              id="action-type-filter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-meta border border-border rounded px-2.5 py-1.5 bg-background text-text focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="all">All Actions</option>
              <option value="create">Case Opened</option>
              <option value="assign">Assigned</option>
              <option value="start_inspection">Started Inspection</option>
              <option value="record_outcome">Recorded Outcome</option>
              <option value="add_note">Note Added</option>
              <option value="escalate">Escalated</option>
              <option value="reassign">Reassigned</option>
              <option value="close">Closed</option>
              <option value="reopen">Reopened</option>
            </select>
          </div>

          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="Search shop, case ID, or officer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-meta border border-border rounded px-3 py-1.5 bg-background text-text placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>

        {/* Table & States */}
        {error ? (
          <ErrorState message={error} onRetry={fetchActions} />
        ) : loading ? (
          <div className="bg-surface border border-border rounded-md p-12 text-center text-meta text-text-muted animate-pulse">
            Loading activity feed...
          </div>
        ) : filteredActions.length === 0 ? (
          <EmptyState
            title="No actions found"
            message="No case actions match the current filter criteria."
            actionLabel="Reset filters"
            onAction={() => {
              setTypeFilter("all");
              setSearchQuery("");
            }}
          />
        ) : (
          <DataTable
            columns={columns}
            data={filteredActions}
            keyField="id"
            onRowClick={(item) => router.push(`/cases/${item.case_id}`)}
          />
        )}
      </div>
    </AppShell>
  );
}
