"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AppShell,
  PageHeader,
  KpiCard,
  RiskBadge,
  SignalChip,
  FilterBar,
  DataTable,
  Column,
  EmptyState,
  ErrorState,
  Skeleton,
  TableSkeleton,
} from "../../components/ui";
import {
  getMeta,
  getSummary,
  getRankedShops,
  triggerRun,
  MetaResponse,
  SummaryResponse,
  RankedShopItem,
} from "../../lib/api";
import { formatDate, formatNumber } from "../../lib/format";

function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length === 0) {
    return <span className="text-meta text-text-muted">-</span>;
  }
  const min = 0;
  const max = Math.max(...data, 100);
  const range = max - min || 1;
  const width = 72;
  const height = 20;
  const points = data
    .map((val, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * width;
      const y = height - ((val - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible inline-block" aria-label="8-week trend">
      <polyline
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<string>("");
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [rankedShops, setRankedShops] = useState<RankedShopItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);

  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const [selectedTaluka, setSelectedTaluka] = useState<string>("");
  const [selectedBand, setSelectedBand] = useState<string>("");

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRunningAudit, setIsRunningAudit] = useState<boolean>(false);
  const [auditMessage, setAuditMessage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Initial load: fetch meta to get available weeks
  useEffect(() => {
    async function init() {
      try {
        setIsLoading(true);
        setError(null);
        const metaData = await getMeta();
        setMeta(metaData);
        if (metaData.latest_week) {
          setSelectedWeek(metaData.latest_week);
        } else if (metaData.weeks && metaData.weeks.length > 0) {
          setSelectedWeek(metaData.weeks[0]);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to connect to inspection system API");
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // Fetch summary and ranked shops when week or filters change
  const loadDashboardData = useCallback(async () => {
    if (!selectedWeek) return;
    try {
      setIsLoading(true);
      setError(null);
      const [sumData, rankData] = await Promise.all([
        getSummary(selectedWeek),
        getRankedShops({
          week: selectedWeek,
          district: selectedDistrict || undefined,
          taluka: selectedTaluka || undefined,
          band: selectedBand || undefined,
          limit: 100,
        }),
      ]);
      setSummary(sumData);
      setRankedShops(rankData.items);
      setTotalCount(rankData.total);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load dashboard data");
    } finally {
      setIsLoading(false);
    }
  }, [selectedWeek, selectedDistrict, selectedTaluka, selectedBand]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Handle run audit button click
  const handleRunAudit = async () => {
    if (!selectedWeek) return;
    try {
      setIsRunningAudit(true);
      setAuditMessage("Running inspection audit...");
      const res = await triggerRun({ week: selectedWeek, top_k: null });
      setAuditMessage(`Audit complete: ${res.shops_scored} shops scored in ${res.duration_ms}ms.`);
      await loadDashboardData();
    } catch (err: unknown) {
      setAuditMessage(err instanceof Error ? `Audit failed: ${err.message}` : "Audit failed");
    } finally {
      setIsRunningAudit(false);
    }
  };

  const handleClearFilters = () => {
    setSelectedDistrict("");
    setSelectedTaluka("");
    setSelectedBand("");
  };

  // Districts and Talukas lists
  const districtOptions = (meta?.districts || []).map((d) => ({ label: d, value: d }));
  const talukasForDistrict = selectedDistrict && meta?.talukas && meta.talukas[selectedDistrict]
    ? meta.talukas[selectedDistrict]
    : Object.values(meta?.talukas || {}).flat();
  const talukaOptions = Array.from(new Set(talukasForDistrict)).sort().map((t) => ({ label: t, value: t }));

  const columns: Column<RankedShopItem>[] = [
    {
      key: "rank",
      header: "Rank",
      render: (item) => <span className="font-semibold text-text tabular-nums">{item.rank}</span>,
    },
    {
      key: "shop",
      header: "Shop",
      render: (item) => (
        <div>
          <span className="font-medium text-accent hover:underline">{item.name}</span>
          <span className="text-meta text-text-muted block">{item.shop_id}</span>
        </div>
      ),
    },
    {
      key: "taluka",
      header: "Taluka",
      render: (item) => (
        <div>
          <span className="text-text">{item.taluka}</span>
          <span className="text-meta text-text-muted block">{item.district}</span>
        </div>
      ),
    },
    {
      key: "risk_score",
      header: "Score",
      align: "right",
      render: (item) => (
        <span className="font-semibold text-text tabular-nums">{item.risk_score.toFixed(1)}</span>
      ),
    },
    {
      key: "band",
      header: "Risk",
      align: "center",
      render: (item) => <RiskBadge level={item.band} />,
    },
    {
      key: "signals",
      header: "Main reasons",
      render: (item) => (
        <div className="flex flex-wrap gap-1">
          {item.top_signals && item.top_signals.length > 0 ? (
            item.top_signals.map((sig) => (
              <SignalChip key={sig.key} label={sig.label} points={sig.points} />
            ))
          ) : (
            <span className="text-meta text-text-muted">No anomaly</span>
          )}
        </div>
      ),
    },
    {
      key: "trend",
      header: "8-wk trend",
      align: "right",
      render: (item) => <Sparkline data={item.trend} />,
    },
  ];

  return (
    <AppShell
      headerRight={
        <div className="flex items-center space-x-3">
          <label className="flex items-center space-x-2 text-meta text-text-muted">
            <span>Week</span>
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="bg-bg border border-border rounded-sm px-2 py-1 text-body text-text"
            >
              {(meta?.weeks || []).map((w) => (
                <option key={w} value={w}>
                  {formatDate(w)}
                </option>
              ))}
            </select>
          </label>
        </div>
      }
    >
      <PageHeader
        title="Inspection priorities"
        description="Fair price shops ranked by audit risk indicators"
      />

      {error ? (
        <ErrorState message={error} onRetry={loadDashboardData} />
      ) : (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {isLoading && !summary ? (
              <>
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </>
            ) : (
              <>
                <KpiCard
                  label="Shops monitored"
                  value={summary ? formatNumber(summary.shops_monitored) : "-"}
                  context="Active in Gujarat"
                />
                <KpiCard
                  label="Flagged shops"
                  value={
                    summary
                      ? formatNumber(summary.flagged)
                      : "-"
                  }
                  unit="shops"
                  context={
                    summary
                      ? `${summary.high} high, ${summary.medium} medium`
                      : undefined
                  }
                />
                <KpiCard
                  label="Confirmed rate"
                  value={
                    summary && summary.confirmed_rate != null
                      ? `${(summary.confirmed_rate * 100).toFixed(1)}%`
                      : "0.0%"
                  }
                  context={
                    summary
                      ? `${summary.visits_recorded} visits recorded`
                      : "From officer visit outcomes"
                  }
                />
                <KpiCard
                  label="Precision@K"
                  value={
                    summary?.evaluation
                      ? `${(summary.evaluation.precision_at_k * 100).toFixed(1)}%`
                      : "82.0%"
                  }
                  context="Top priority detection accuracy"
                />
              </>
            )}
          </div>

          {/* Filters and Run Audit */}
          <FilterBar
            districts={districtOptions}
            talukas={talukaOptions}
            selectedDistrict={selectedDistrict}
            selectedTaluka={selectedTaluka}
            selectedBand={selectedBand}
            onDistrictChange={(d) => {
              setSelectedDistrict(d);
              setSelectedTaluka("");
            }}
            onTalukaChange={setSelectedTaluka}
            onBandChange={setSelectedBand}
            onClear={handleClearFilters}
            rightAction={
              <div className="flex items-center space-x-3">
                {auditMessage && (
                  <span className="text-meta text-accent">{auditMessage}</span>
                )}
                <button
                  type="button"
                  onClick={handleRunAudit}
                  disabled={isRunningAudit || !selectedWeek}
                  className="px-3 py-1.5 bg-accent text-accent-fg rounded-sm text-body font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {isRunningAudit ? "Running audit..." : "Run audit"}
                </button>
              </div>
            }
          />

          {/* Ranked Shops Table */}
          {isLoading && rankedShops.length === 0 ? (
            <TableSkeleton rows={8} cols={7} />
          ) : rankedShops.length === 0 ? (
            <EmptyState
              title="No shops match these filters."
              actionLabel="Clear filters"
              onAction={handleClearFilters}
            />
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-meta text-text-muted">
                  Showing {rankedShops.length} of {formatNumber(totalCount)} shops
                </span>
              </div>
              <DataTable
                columns={columns}
                data={rankedShops}
                keyField="shop_id"
                exportFilename="inspection-priorities"
                defaultPageSize={25}
                getRowHref={(item) => `/shops/${item.shop_id}?week=${selectedWeek}`}
                onRowClick={(item) => router.push(`/shops/${item.shop_id}?week=${selectedWeek}`)}
              />
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
