"use client";

import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AppShell,
  PageHeader,
  RiskBadge,
  ScoreBreakdown,
  TrendChart,
  ReconcileTable,
  EvidenceList,
  ChecklistPanel,
  StatusBadge,
  FeedbackForm,
  OutcomeType,
  ErrorState,
  Skeleton,
  CardSkeleton,
} from "../../../components/ui";
import { getShopDetail, submitFeedback, ShopDetailResponse } from "../../../lib/api";
import { formatDate } from "../../../lib/format";

function BoardCheckCard({ data }: { data: { board_kg: number; sold_kg: number; mismatch_pct: number } }) {
  const isMismatch = data.mismatch_pct > 5.0;
  return (
    <div className="bg-bg border border-border rounded-md p-4">
      <h3 className="text-section font-semibold text-text mb-3 border-b border-border pb-2">
        Notice board vs records
      </h3>
      <table className="w-full text-body border-collapse">
        <tbody>
          <tr className="border-b border-border">
            <td className="py-2 text-text-muted">Public board display</td>
            <td className="py-2 text-right tabular-nums text-text">{data.board_kg.toFixed(1)} kg</td>
          </tr>
          <tr className="border-b border-border">
            <td className="py-2 text-text-muted">Digital sales ledger</td>
            <td className="py-2 text-right tabular-nums text-text">{data.sold_kg.toFixed(1)} kg</td>
          </tr>
          <tr className={isMismatch ? "bg-risk-high-bg font-semibold" : "bg-surface font-medium"}>
            <td className="py-2 px-2 text-text">Mismatch</td>
            <td className="py-2 px-2 text-right tabular-nums">
              <span className={isMismatch ? "text-risk-high" : "text-text"}>
                {data.mismatch_pct.toFixed(1)}%
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function ShopDetailPage() {
  const routeParams = useParams();
  const searchParams = useSearchParams();
  const shopId = (routeParams?.id as string) || "";
  const week = searchParams?.get("week") || undefined;

  const [detail, setDetail] = useState<ShopDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = React.useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setIsLoading(true);
      setError(null);
      const data = await getShopDetail(shopId, week);
      setDetail(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load shop details");
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [shopId, week]);

  useEffect(() => {
    fetchDetail(true);
  }, [fetchDetail]);

  const handleFeedbackSubmit = async (outcome: OutcomeType, note: string) => {
    if (!detail) return;
    await submitFeedback(detail.shop.shop_id, {
      week: detail.week,
      outcome,
      note,
    });
    // Refresh detail silently to show recorded feedback without unmounting form
    await fetchDetail(false);
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-44" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CardSkeleton className="h-64" />
            <CardSkeleton className="h-64" />
            <CardSkeleton className="h-56" />
            <CardSkeleton className="h-56" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !detail) {
    return (
      <AppShell>
        <PageHeader title="Shop detail" backHref="/" />
        <ErrorState message={error || "Shop not found"} onRetry={fetchDetail} />
      </AppShell>
    );
  }

  // Prepare trend data for top signal
  const topSignal = detail.breakdown.find((b) => b.key !== "vulnerability_uplift" && (b.points > 0 || (b.value && b.value > 0))) || detail.breakdown[0];
  const signalKey = topSignal ? topSignal.key : "stock_gap_pct";
  const historySeries =
    detail.history.series[signalKey] ||
    detail.history.series["stock_gap_pct"] ||
    detail.history.series["auth_fail_rate"] ||
    Object.values(detail.history.series)[0];
  const trendData = (detail.history.weeks || []).map((w, idx) => ({
    week: formatDate(w),
    shopValue: historySeries && historySeries.shop ? historySeries.shop[idx] ?? 0 : 0,
    peerMedian: historySeries && historySeries.peer_median ? historySeries.peer_median[idx] ?? 0 : 0,
  }));

  const reconData = {
    opening_kg: detail.stock_reconciliation.opening_kg,
    received_kg: detail.stock_reconciliation.received_kg,
    sold_kg: detail.stock_reconciliation.sold_kg,
    closing_kg: detail.stock_reconciliation.closing_kg,
    gap_kg: detail.stock_reconciliation.gap_kg,
    gap_pct: detail.stock_reconciliation.gap_pct,
    direction: detail.stock_reconciliation.gap_kg >= 0 ? "shortfall" : "surplus",
  };

  const latestFeedback = detail.feedback && detail.feedback.length > 0 ? detail.feedback[0] : null;
  const initialOutcome: OutcomeType =
    latestFeedback && latestFeedback.outcome === "confirmed" ? "confirmed" : "not_confirmed";

  return (
    <AppShell
      headerRight={
        <div className="flex items-center space-x-2 text-meta text-text-muted">
          <span>Week of {formatDate(detail.week)}</span>
        </div>
      }
    >
      {/* Breadcrumb Navigation */}
      <div className="flex items-center space-x-2 text-meta text-text-muted mb-4">
        <Link href="/flags" className="hover:text-accent hover:underline">
          Flags
        </Link>
        <span>/</span>
        <span className="text-text font-medium">{detail.shop.taluka}</span>
        <span>/</span>
        <span className="font-mono text-text font-semibold">{detail.shop.shop_id}</span>
      </div>

      <PageHeader
        title={`${detail.shop.name} (${detail.shop.shop_id})`}
        description={`${detail.shop.taluka}, ${detail.shop.district} | ${detail.shop.cards_count} cards | Vulnerability index: ${detail.shop.vulnerability_index.toFixed(2)}`}
        backHref="/flags"
        actions={
          <div className="flex items-center space-x-3 bg-bg border border-border rounded-md px-3 py-1.5">
            <span className="text-meta text-text-muted">Rank #{detail.rank}</span>
            <span className="text-body font-semibold text-text tabular-nums">
              Score {detail.risk_score.toFixed(1)}
            </span>
            <RiskBadge level={detail.band} />
          </div>
        }
      />

      {/* Active Case Link Banner */}
      {detail.case && (
        <div className="bg-surface border border-accent/30 rounded-md p-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-2xs">
          <div className="flex items-center space-x-3">
            <div className="w-2.5 h-2.5 rounded-full bg-accent shrink-0 animate-pulse" />
            <div>
              <div className="text-body font-semibold text-text flex items-center gap-2">
                <span>Active Inspection Case: {detail.case.case_id}</span>
                <StatusBadge status={detail.case.status} />
              </div>
              <p className="text-meta text-text-muted mt-0.5">
                {detail.case.assignee_name
                  ? `Assigned to ${detail.case.assignee_name} for virtual / field inspection.`
                  : "Awaiting assignment by Taluka Mamlatdar."}
              </p>
            </div>
          </div>
          <Link
            href={`/cases/${detail.case.case_id}`}
            className="inline-flex items-center justify-center px-4 py-2 bg-accent text-accent-fg font-medium text-meta rounded-sm hover:opacity-90 transition-opacity shrink-0 shadow-2xs"
          >
            Open Active Case &rarr;
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: Analytics & Measurements */}
        <div className="space-y-6">
          <ScoreBreakdown
            score={detail.risk_score}
            breakdown={detail.breakdown}
          />

          <TrendChart
            title={`${topSignal ? topSignal.label : "Signal"} trend vs peers`}
            unit={topSignal ? topSignal.unit : "%"}
            data={trendData}
          />

          <ReconcileTable data={reconData} />

          <BoardCheckCard data={detail.board_check} />
        </div>

        {/* Right column: Explanations, Verification & Feedback */}
        <div className="space-y-6">
          <EvidenceList
            reason={detail.explanation.reason}
            evidence={detail.explanation.evidence}
            source={detail.explanation.source}
          />

          <ChecklistPanel items={detail.explanation.checklist} />

          <FeedbackForm
            shopId={detail.shop.shop_id}
            initialOutcome={initialOutcome}
            initialNotes={latestFeedback?.note || ""}
            onSubmit={handleFeedbackSubmit}
          />
        </div>
      </div>
    </AppShell>
  );
}
