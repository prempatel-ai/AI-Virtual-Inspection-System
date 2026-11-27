"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "../../components/ui/AppShell";
import { KpiCard } from "../../components/ui/KpiCard";
import { DataTable, Column } from "../../components/ui/DataTable";
import { ErrorState } from "../../components/ui/ErrorState";
import { KpiGridSkeleton, TableSkeleton, CardSkeleton } from "../../components/ui/Skeleton";
import {
  getSummary,
  getAreas,
  SummaryResponse,
  AreaMetricItem,
} from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { MapPin, ShieldAlert, FileText, CheckCircle2, UserCheck, ArrowRight } from "lucide-react";

export default function OverviewPage() {
  const router = useRouter();
  const { scope } = useAuth();

  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [areaItems, setAreaItems] = useState<AreaMetricItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverviewData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sum = await getSummary();
      setSummary(sum);

      const level = scope?.district ? "taluka" : "district";
      const parent = scope?.district || undefined;
      const areasRes = await getAreas(level, parent);
      setAreaItems(areasRes.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load overview data");
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    fetchOverviewData();
  }, [fetchOverviewData]);

  const scopeLabel = scope?.taluka
    ? `${scope.district} • ${scope.taluka}`
    : scope?.district
    ? `${scope.district} District`
    : "State Jurisdiction (Gujarat)";

  const childLevelName = scope?.district ? "Taluka" : "District";

  const areaColumns: Column<AreaMetricItem>[] = [
    {
      key: "name",
      header: `${childLevelName} Name`,
      sortValue: (item) => item.name,
      render: (item) => (
        <span className="font-medium text-text text-body">{item.name}</span>
      ),
    },
    {
      key: "shops_count",
      header: "Shops Monitored",
      sortValue: (item) => item.shops_count,
      render: (item) => (
        <span className="font-mono text-text tabular-nums">{item.shops_count}</span>
      ),
    },
    {
      key: "flagged_count",
      header: "Flagged Shops",
      sortValue: (item) => item.flagged_count,
      render: (item) => (
        <span className="font-mono text-text font-semibold tabular-nums">
          {item.flagged_count}
        </span>
      ),
    },
    {
      key: "flag_rate",
      header: "Flag Rate",
      sortValue: (item) => item.flag_rate,
      render: (item) => {
        const pct = (item.flag_rate * 100).toFixed(1);
        return (
          <div className="flex items-center space-x-2">
            <span className="font-mono text-body text-text font-medium">{pct}%</span>
            <div className="w-16 bg-surface border border-border h-2 rounded-full overflow-hidden hidden sm:block">
              <div
                className="bg-accent h-full"
                style={{ width: `${Math.min(item.flag_rate * 100, 100)}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: "high_band_count",
      header: "High Risk",
      sortValue: (item) => item.high_band_count,
      render: (item) => (
        <span className="font-mono text-risk-high font-semibold tabular-nums">
          {item.high_band_count}
        </span>
      ),
    },
    {
      key: "open_cases",
      header: "Open Cases",
      sortValue: (item) => item.open_cases,
      render: (item) => (
        <span className="font-mono text-text tabular-nums">{item.open_cases}</span>
      ),
    },
    {
      key: "overdue_cases",
      header: "Overdue",
      sortValue: (item) => item.overdue_cases,
      render: (item) => (
        <span
          className={`font-mono tabular-nums font-semibold ${
            item.overdue_cases > 0
              ? "inline-flex items-center px-1.5 py-0.5 rounded-sm bg-risk-high-bg text-risk-high text-xs"
              : "text-text-muted"
          }`}
        >
          {item.overdue_cases}
        </span>
      ),
    },
    {
      key: "confirmed_rate",
      header: "Confirmed Rate",
      sortValue: (item) => item.confirmed_rate ?? -1,
      render: (item) => (
        <span className="font-mono text-text tabular-nums">
          {item.confirmed_rate !== null && item.confirmed_rate !== undefined
            ? `${(item.confirmed_rate * 100).toFixed(1)}%`
            : "—"}
        </span>
      ),
    },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-title font-semibold text-text tracking-tight">
              Executive Oversight
            </h1>
            <p className="text-meta text-text-muted mt-1">
              Real-time fair price shop audit risk indicators, case progression, and enforcement overview for{" "}
              <strong className="text-text font-semibold">{scopeLabel}</strong>.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Link
              href="/queue"
              className="px-3 py-1.5 bg-accent text-accent-fg rounded-sm text-meta font-medium hover:opacity-90 transition-opacity"
            >
              Inspection Queue &rarr;
            </Link>
            <Link
              href="/areas"
              className="px-3 py-1.5 border border-border bg-surface text-text rounded-sm text-meta font-medium hover:bg-background transition-colors"
            >
              Area Comparison
            </Link>
          </div>
        </div>

        {error ? (
          <ErrorState message={error} onRetry={fetchOverviewData} />
        ) : loading || !summary ? (
          <div className="space-y-6">
            <KpiGridSkeleton count={4} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <CardSkeleton className="h-44" />
              <div className="lg:col-span-2">
                <CardSkeleton className="h-44" />
              </div>
            </div>
            <TableSkeleton rows={7} cols={8} />
          </div>
        ) : (
          <>
            {/* Connected Demo Walkthrough: Full System Lineage */}
            <div className="bg-surface border-2 border-accent/30 rounded-md p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-3">
                <div className="flex items-center space-x-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-accent text-accent-fg px-2 py-0.5 rounded">
                    Demo Overview
                  </span>
                  <h2 className="text-section font-bold text-text">
                    Connected End-to-End Inspection Pipeline
                  </h2>
                </div>
                <div className="text-meta text-text-muted">
                  Tracing Flagged FPS: <strong className="font-mono text-text">FPS-00291</strong> (Risk Score: <span className="text-risk-high font-bold">95.6</span>)
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
                {/* 1. Detection Engine */}
                <div className="bg-bg border border-border p-3 rounded-md flex flex-col justify-between space-y-2 hover:border-accent transition-colors">
                  <div>
                    <div className="flex items-center justify-between text-meta text-text-muted">
                      <span className="font-bold text-[11px] uppercase tracking-wider text-accent">1. Detection</span>
                      <ShieldAlert className="w-3.5 h-3.5 text-risk-high" />
                    </div>
                    <div className="mt-1 font-bold text-body text-text truncate">Shop FPS-00291</div>
                    <div className="text-[11px] text-text-muted">Score: <strong className="text-risk-high">95.6</strong> (High Risk)</div>
                    <div className="text-[11px] text-text-muted font-mono">Palsana, Surat</div>
                  </div>
                  <Link
                    href="/flags?district=Surat&taluka=Palsana"
                    className="inline-flex items-center justify-between text-[11px] font-semibold text-accent hover:underline pt-2 border-t border-border/60"
                  >
                    <span>Inspect Signals</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                {/* 2. Geographic Map */}
                <div className="bg-bg border border-border p-3 rounded-md flex flex-col justify-between space-y-2 hover:border-accent transition-colors">
                  <div>
                    <div className="flex items-center justify-between text-meta text-text-muted">
                      <span className="font-bold text-[11px] uppercase tracking-wider text-accent">2. Spatial Map</span>
                      <MapPin className="w-3.5 h-3.5 text-accent" />
                    </div>
                    <div className="mt-1 font-bold text-body text-text">Gujarat Risk Map</div>
                    <div className="text-[11px] text-text-muted">Pin: <span className="text-risk-high font-semibold">Red Marker</span></div>
                    <div className="text-[11px] text-text-muted font-mono">21.08°N, 72.94°E</div>
                  </div>
                  <Link
                    href="/admin/map?shop=FPS-00291"
                    className="inline-flex items-center justify-between text-[11px] font-semibold text-accent hover:underline pt-2 border-t border-border/60"
                  >
                    <span>Locate Pin on Map</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                {/* 3. Triaged Case */}
                <div className="bg-bg border border-border p-3 rounded-md flex flex-col justify-between space-y-2 hover:border-accent transition-colors">
                  <div>
                    <div className="flex items-center justify-between text-meta text-text-muted">
                      <span className="font-bold text-[11px] uppercase tracking-wider text-accent">3. Triage Case</span>
                      <FileText className="w-3.5 h-3.5 text-accent" />
                    </div>
                    <div className="mt-1 font-bold text-body text-text truncate">case-FPS-00291</div>
                    <div className="text-[11px] text-text-muted">Status: <strong className="text-accent font-semibold">Assigned</strong></div>
                    <div className="text-[11px] text-text-muted">Queue Priority: <strong className="text-text">K=26</strong></div>
                  </div>
                  <Link
                    href="/cases/case-FPS-00291-20261102"
                    className="inline-flex items-center justify-between text-[11px] font-semibold text-accent hover:underline pt-2 border-t border-border/60"
                  >
                    <span>Open Case File</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                {/* 4. Field Enforcement */}
                <div className="bg-bg border border-border p-3 rounded-md flex flex-col justify-between space-y-2 hover:border-accent transition-colors">
                  <div>
                    <div className="flex items-center justify-between text-meta text-text-muted">
                      <span className="font-bold text-[11px] uppercase tracking-wider text-accent">4. Field Dispatch</span>
                      <UserCheck className="w-3.5 h-3.5 text-accent" />
                    </div>
                    <div className="mt-1 font-bold text-body text-text truncate">Aarav Joshi</div>
                    <div className="text-[11px] text-text-muted font-mono">usr-insp-059 · Inspector</div>
                    <div className="text-[11px] text-text-muted">Latest Action: <strong className="font-mono text-text">ACT #209</strong></div>
                  </div>
                  <Link
                    href="/actions"
                    className="inline-flex items-center justify-between text-[11px] font-semibold text-accent hover:underline pt-2 border-t border-border/60"
                  >
                    <span>View Actions Feed</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                {/* 5. Cryptographic Audit */}
                <div className="bg-bg border border-border p-3 rounded-md flex flex-col justify-between space-y-2 hover:border-accent transition-colors">
                  <div>
                    <div className="flex items-center justify-between text-meta text-text-muted">
                      <span className="font-bold text-[11px] uppercase tracking-wider text-accent">5. Audit Trail</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                    </div>
                    <div className="mt-1 font-bold text-body text-text">Audit Hash Chain</div>
                    <div className="text-[11px] text-text-muted">Status: <strong className="text-accent font-semibold">100% Immutable</strong></div>
                    <div className="text-[11px] text-text-muted font-mono">HMAC SHA-256</div>
                  </div>
                  <Link
                    href="/admin/audit"
                    className="inline-flex items-center justify-between text-[11px] font-semibold text-accent hover:underline pt-2 border-t border-border/60"
                  >
                    <span>Verify Audit Trail</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <KpiCard
                label="Shops Monitored"
                value={summary.shops_monitored.toLocaleString()}
                unit="shops"
                context={`Analysis week: ${summary.week}`}
              />
              <KpiCard
                label="Flagged for Audit"
                value={summary.flagged}
                unit="shops"
                context={`${summary.high} High, ${summary.medium} Medium`}
              />
              <KpiCard
                label="Open Workload"
                value={summary.open_cases !== undefined ? summary.open_cases : summary.flagged}
                unit="cases"
                context={`${summary.overdue_cases || 0} currently overdue (>7d)`}
              />
              <KpiCard
                label="Field Confirmed Rate"
                value={
                  summary.confirmed_rate !== null && summary.confirmed_rate !== undefined
                    ? `${(summary.confirmed_rate * 100).toFixed(1)}%`
                    : "—"
                }
                context={`${summary.visits_recorded || 0} inspections recorded`}
              />
            </div>

            {/* Jurisdiction Child Areas Breakdown */}
            <div className="bg-surface border border-border rounded-md p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h2 className="text-section font-semibold text-text">
                    {childLevelName} Breakdown & Flag Rates
                  </h2>
                  <p className="text-meta text-text-muted mt-0.5">
                    Comparative audit risk metrics across administrative units in your scope.
                  </p>
                </div>
                <Link
                  href="/areas"
                  className="text-meta text-accent font-medium hover:underline"
                >
                  View full area matrix &rarr;
                </Link>
              </div>

              <DataTable
                columns={areaColumns}
                data={areaItems}
                keyField="name"
                exportFilename="district-flag-rates"
                defaultPageSize={10}
                onRowClick={(item) => {
                  const targetLevel = item.level === "district" ? "taluka" : item.level;
                  router.push(
                    `/areas?level=${targetLevel}&parent=${encodeURIComponent(item.name)}`
                  );
                }}
              />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
