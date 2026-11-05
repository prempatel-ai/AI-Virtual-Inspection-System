"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "../../../components/ui/AppShell";
import { KpiCard } from "../../../components/ui/KpiCard";
import { DataTable, Column } from "../../../components/ui/DataTable";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { RiskBadge } from "../../../components/ui/RiskBadge";
import { PermissionList } from "../../../components/ui/PermissionList";
import { ActionTimeline } from "../../../components/ui/ActionTimeline";
import { ErrorState } from "../../../components/ui/ErrorState";
import { Skeleton, KpiGridSkeleton, CardSkeleton, TableSkeleton } from "../../../components/ui/Skeleton";
import { getOfficerDetail, OfficerDetailResponse, CaseListItem } from "../../../lib/api";

export default function OfficerDetailPage() {
  const routeParams = useParams();
  const router = useRouter();
  const officerId = (routeParams?.id as string) || "";

  const [officer, setOfficer] = useState<OfficerDetailResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!officerId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getOfficerDetail(officerId);
      setOfficer(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load officer details");
    } finally {
      setLoading(false);
    }
  }, [officerId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const caseColumns: Column<CaseListItem>[] = [
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
          <div className="font-medium text-text text-body">{item.shop_name}</div>
          <div className="text-meta text-text-muted font-mono text-[11px]">{item.shop_id}</div>
        </div>
      ),
    },
    {
      key: "location",
      header: "Taluka / District",
      render: (item) => (
        <div className="text-meta">
          <div className="text-text font-medium">{item.taluka}</div>
          <div className="text-text-muted">{item.district}</div>
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
      key: "opened_week",
      header: "Opened",
      render: (item) => (
        <span className="text-meta text-text-muted font-mono">{item.opened_week}</span>
      ),
    },
  ];

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-7 w-64" />
          </div>
          <CardSkeleton className="h-36" />
          <KpiGridSkeleton count={4} />
          <TableSkeleton rows={5} cols={5} />
        </div>
      </AppShell>
    );
  }

  if (error || !officer) {
    return (
      <AppShell>
        <div className="space-y-4">
          <Link
            href="/officers"
            className="text-meta font-medium text-accent hover:underline inline-flex items-center space-x-1"
          >
            <span>&larr; Back to Officers</span>
          </Link>
          <ErrorState message={error || "Officer not found"} onRetry={() => router.push("/officers")} />
        </div>
      </AppShell>
    );
  }

  const s = officer.stats;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Link
            href="/officers"
            className="text-meta font-medium text-accent hover:underline inline-flex items-center space-x-1"
          >
            <span>&larr; Back to Officers</span>
          </Link>
        </div>

        {/* Profile Card */}
        <div className="bg-surface border border-border rounded-md p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-meta font-semibold text-accent">
                  {officer.user_id}
                </span>
                <span className="text-meta text-text-muted">•</span>
                <span className="text-meta text-text-muted">{officer.email}</span>
              </div>
              <h1 className="text-title font-semibold text-text mt-1">
                {officer.name}
              </h1>
              <p className="text-meta text-text-muted mt-0.5">
                {officer.taluka ? `${officer.district} • ${officer.taluka}` : officer.district ? `${officer.district} District` : "State-wide Jurisdiction"}
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <span className="capitalize px-2.5 py-1 text-meta font-semibold rounded bg-background border border-border text-text">
                {officer.role.replace("_", " ")}
              </span>
              <span
                className={`text-meta font-semibold px-2.5 py-1 rounded ${
                  officer.is_active ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"
                }`}
              >
                {officer.is_active ? "Active" : "Inactive"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-border/60 text-meta">
            <div>
              <span className="text-text-muted block text-[11px]">Area Flag Rate</span>
              <span className="font-medium text-text">
                {officer.area_flag_rate !== null && officer.area_flag_rate !== undefined
                  ? `${(officer.area_flag_rate * 100).toFixed(1)}%`
                  : "—"}
              </span>
            </div>
            <div>
              <span className="text-text-muted block text-[11px]">Median Time to First Action</span>
              <span className="font-medium text-text">
                {s.median_time_to_first_action_hours !== null && s.median_time_to_first_action_hours !== undefined
                  ? `${s.median_time_to_first_action_hours.toFixed(1)} hrs`
                  : "—"}
              </span>
            </div>
            <div>
              <span className="text-text-muted block text-[11px]">Confirmed Field Rate</span>
              <span className="font-medium text-text">
                {s.confirmed_rate !== null && s.confirmed_rate !== undefined
                  ? `${(s.confirmed_rate * 100).toFixed(1)}%`
                  : "—"}
              </span>
            </div>
            <div>
              <span className="text-text-muted block text-[11px]">Account Created</span>
              <span className="font-medium text-text">{officer.created_at.slice(0, 10)}</span>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard
            label="Assigned Cases"
            value={s.assigned_cases}
            unit="total"
            context="Lifetime allocations"
          />
          <KpiCard
            label="Open Workload"
            value={s.open_cases}
            unit="active"
            context="Under current review"
          />
          <KpiCard
            label="Overdue Cases"
            value={s.overdue_cases}
            unit="cases"
            context="Exceeded 7-day action target"
          />
          <KpiCard
            label="Inspections Completed"
            value={s.inspected_cases + s.closed_cases}
            unit="verified"
            context="Field verification visits"
          />
        </div>

        {/* Security Permissions and Access Control */}
        <PermissionList
          role={officer.role}
          permissions={officer.permissions}
          district={officer.district}
          taluka={officer.taluka}
        />

        {/* Assigned Cases Table */}
        <div className="bg-surface border border-border rounded-md p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-section font-semibold text-text">
                Assigned Inspection Cases
              </h2>
              <p className="text-meta text-text-muted mt-0.5">
                Fair price shops assigned to this officer for physical and virtual audit.
              </p>
            </div>
            <span className="text-meta text-text-muted font-mono font-medium">
              {officer.assigned_cases.length} cases
            </span>
          </div>

          {officer.assigned_cases.length === 0 ? (
            <div className="p-8 text-center text-meta text-text-muted">
              No active or past cases assigned to this officer.
            </div>
          ) : (
            <DataTable
              columns={caseColumns}
              data={officer.assigned_cases}
              keyField="case_id"
              onRowClick={(item) => router.push(`/cases/${item.case_id}`)}
            />
          )}
        </div>

        {/* Recent Actions Feed */}
        <div className="bg-surface border border-border rounded-md p-5 shadow-sm space-y-4">
          <div className="border-b border-border pb-3">
            <h2 className="text-section font-semibold text-text">
              Officer Action History
            </h2>
            <p className="text-meta text-text-muted mt-0.5">
              Immutable audit log of all case actions taken by {officer.name}.
            </p>
          </div>

          <ActionTimeline actions={officer.recent_actions} />
        </div>
      </div>
    </AppShell>
  );
}
