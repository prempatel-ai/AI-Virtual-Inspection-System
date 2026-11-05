"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "../../components/ui/AppShell";
import { KpiCard } from "../../components/ui/KpiCard";
import { DataTable, Column } from "../../components/ui/DataTable";
import { ErrorState } from "../../components/ui/ErrorState";
import { EmptyState } from "../../components/ui/EmptyState";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { getAreas, getMeta, AreaMetricItem } from "../../lib/api";
import { useAuth } from "../../lib/auth";

export default function AreasPage() {
  const searchParams = useSearchParams();
  const { scope } = useAuth();

  const initialLevel = (searchParams?.get("level") as "district" | "taluka") || (scope?.district ? "taluka" : "district");
  const initialParent = searchParams?.get("parent") || scope?.district || "";

  const [level, setLevel] = useState<"district" | "taluka">(initialLevel);
  const [parentDistrict, setParentDistrict] = useState<string>(initialParent);
  const [districtOptions, setDistrictOptions] = useState<string[]>([]);
  const [areas, setAreas] = useState<AreaMetricItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    getMeta()
      .then((meta) => {
        if (meta.districts) setDistrictOptions(meta.districts);
      })
      .catch(() => {});
  }, []);

  const fetchAreas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const parent = level === "taluka" && parentDistrict ? parentDistrict : undefined;
      const res = await getAreas(level, parent);
      setAreas(res.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load area metrics");
    } finally {
      setLoading(false);
    }
  }, [level, parentDistrict]);

  useEffect(() => {
    fetchAreas();
  }, [fetchAreas]);

  const filteredAreas = useMemo(() => {
    if (!searchQuery.trim()) return areas;
    const q = searchQuery.toLowerCase();
    return areas.filter((a) => a.name.toLowerCase().includes(q));
  }, [areas, searchQuery]);

  // Aggregate stats for the current view
  const stats = useMemo(() => {
    const totalAreas = areas.length;
    const totalShops = areas.reduce((acc, a) => acc + a.shops_count, 0);
    const totalFlagged = areas.reduce((acc, a) => acc + a.flagged_count, 0);
    const totalOpen = areas.reduce((acc, a) => acc + a.open_cases, 0);
    const totalOverdue = areas.reduce((acc, a) => acc + a.overdue_cases, 0);
    const avgFlagRate = totalShops > 0 ? (totalFlagged / totalShops) * 100 : 0;

    return { totalAreas, totalShops, totalFlagged, totalOpen, totalOverdue, avgFlagRate };
  }, [areas]);

  const columns: Column<AreaMetricItem>[] = [
    {
      key: "name",
      header: level === "district" ? "District Name" : "Taluka Name",
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
      header: "High Risk Flags",
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
        <div>
          <h1 className="text-title font-semibold text-text tracking-tight">
            Administrative Area Risk Metrics
          </h1>
          <p className="text-meta text-text-muted mt-1">
            Compare inspection flag rates, case resolution, and field-confirmed anomalies across districts and talukas.
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard
            label="Total Monitored"
            value={stats.totalShops.toLocaleString()}
            unit="shops"
            context={`Across ${stats.totalAreas} ${level}s`}
          />
          <KpiCard
            label="Flagged for Audit"
            value={stats.totalFlagged}
            unit="shops"
            context={`Average flag rate: ${stats.avgFlagRate.toFixed(1)}%`}
          />
          <KpiCard
            label="Open Cases"
            value={stats.totalOpen}
            unit="cases"
            context="Under review or inspection"
          />
          <KpiCard
            label="Overdue Inspection"
            value={stats.totalOverdue}
            unit="cases"
            context="Exceeded 7-day SLA"
          />
        </div>

        {/* Controls Bar */}
        <div className="bg-surface border border-border rounded-md p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            {!scope?.district && (
              <div className="flex items-center space-x-1.5">
                <label htmlFor="area-level-select" className="text-meta font-medium text-text-muted">
                  Aggregation Level:
                </label>
                <select
                  id="area-level-select"
                  value={level}
                  onChange={(e) => {
                    setLevel(e.target.value as "district" | "taluka");
                    if (e.target.value === "district") {
                      setParentDistrict("");
                    }
                  }}
                  className="text-meta border border-border rounded px-2.5 py-1.5 bg-background text-text focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="district">Districts</option>
                  <option value="taluka">Talukas</option>
                </select>
              </div>
            )}

            {level === "taluka" && !scope?.district && (
              <div className="flex items-center space-x-1.5">
                <label htmlFor="parent-district-select" className="text-meta font-medium text-text-muted">
                  District:
                </label>
                <select
                  id="parent-district-select"
                  value={parentDistrict}
                  onChange={(e) => setParentDistrict(e.target.value)}
                  className="text-meta border border-border rounded px-2.5 py-1.5 bg-background text-text focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="">All Districts</option>
                  {districtOptions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder={`Search ${level} name...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-meta border border-border rounded px-3 py-1.5 bg-background text-text placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>

        {/* Table & States */}
        {error ? (
          <ErrorState message={error} onRetry={fetchAreas} />
        ) : loading ? (
          <TableSkeleton rows={8} cols={8} />
        ) : filteredAreas.length === 0 ? (
          <EmptyState
            title="No area metrics found"
            message="No areas match the current filter selection."
            actionLabel="Reset to Districts"
            onAction={() => {
              setLevel("district");
              setParentDistrict("");
              setSearchQuery("");
            }}
          />
        ) : (
          <DataTable
            columns={columns}
            data={filteredAreas}
            keyField="name"
            exportFilename="area-performance-matrix"
            defaultPageSize={10}
          />
        )}
      </div>
    </AppShell>
  );
}
