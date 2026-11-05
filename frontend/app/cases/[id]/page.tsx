"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  AppShell,
  RiskBadge,
  ScoreBreakdown,
  TrendChart,
  ReconcileTable,
  EvidenceList,
  StatusBadge,
  CaseActionBar,
  OutcomeForm,
  ActionTimeline,
  ErrorState,
} from "../../../components/ui";
import {
  getCaseDetail,
  getShopDetail,
  postCaseAction,
  CaseDetailResponse,
  ShopDetailResponse,
  CaseActionRequest,
} from "../../../lib/api";
import { formatDate } from "../../../lib/format";

function BoardCheckCard({
  data,
}: {
  data: { board_kg: number; sold_kg: number; mismatch_pct: number };
}) {
  const isMismatch = data.mismatch_pct > 5.0;
  return (
    <div className="bg-surface border border-border rounded-md p-4">
      <h3 className="text-section font-semibold text-text mb-3 border-b border-border pb-2">
        Notice board vs records
      </h3>
      <table className="w-full text-body border-collapse">
        <tbody>
          <tr className="border-b border-border">
            <td className="py-2 text-text-muted">Public board display</td>
            <td className="py-2 text-right tabular-nums text-text">
              {data.board_kg.toFixed(1)} kg
            </td>
          </tr>
          <tr className="border-b border-border">
            <td className="py-2 text-text-muted">Digital sales ledger</td>
            <td className="py-2 text-right tabular-nums text-text">
              {data.sold_kg.toFixed(1)} kg
            </td>
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

export default function CaseDetailPage() {
  const routeParams = useParams();
  const router = useRouter();
  const caseId = (routeParams?.id as string) || "";

  const [caseData, setCaseData] = useState<CaseDetailResponse | null>(null);
  const [shopData, setShopData] = useState<ShopDetailResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showOutcomeForm, setShowOutcomeForm] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchDetails = useCallback(async (showLoading = true) => {
    if (!caseId) return;
    try {
      if (showLoading) setLoading(true);
      setError(null);

      const cData = await getCaseDetail(caseId);
      setCaseData(cData);

      try {
        const sData = await getShopDetail(cData.case.shop_id);
        setShopData(sData);
      } catch {
        // Shop detail might be out of scope or unavailable
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load case information");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchDetails(true);
  }, [fetchDetails]);

  const handleAction = async (action: CaseActionRequest) => {
    if (!caseData) return;
    setActionLoading(true);
    setActionSuccess(null);
    try {
      await postCaseAction(caseData.case.case_id, action);
      setActionSuccess(`Action '${action.type}' recorded successfully.`);
      setShowOutcomeForm(false);
      await fetchDetails(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to execute case action");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <div className="h-8 w-64 bg-border/40 rounded animate-pulse" />
          <div className="h-40 bg-surface border border-border rounded-md animate-pulse" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-96 bg-surface border border-border rounded-md animate-pulse" />
            <div className="h-96 bg-surface border border-border rounded-md animate-pulse" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !caseData) {
    return (
      <AppShell>
        <div className="space-y-4">
          <Link
            href="/queue"
            className="text-meta font-medium text-accent hover:underline inline-flex items-center space-x-1"
          >
            <span>&larr; Back to Queue</span>
          </Link>
          <ErrorState
            message={error || "You do not have permission to view this case."}
            onRetry={() => router.push("/queue")}
          />
        </div>
      </AppShell>
    );
  }

  const c = caseData.case;

  // Prepare trend data for top signal if shopData exists
  let trendData: { week: string; shopValue: number; peerMedian: number }[] = [];
  let topSignalLabel = "Signal";
  let topSignalUnit = "%";

  if (shopData) {
    const topSignal =
      shopData.breakdown.find(
        (b) => b.key !== "vulnerability_uplift" && (b.points > 0 || (b.value && b.value > 0))
      ) || shopData.breakdown[0];

    if (topSignal) {
      topSignalLabel = topSignal.label;
      topSignalUnit = topSignal.unit;
    }

    const signalKey = topSignal ? topSignal.key : "stock_gap_pct";
    const historySeries =
      shopData.history.series[signalKey] ||
      shopData.history.series["stock_gap_pct"] ||
      shopData.history.series["auth_fail_rate"] ||
      Object.values(shopData.history.series)[0];

    trendData = (shopData.history.weeks || []).map((w, idx) => ({
      week: formatDate(w),
      shopValue: historySeries && historySeries.shop ? historySeries.shop[idx] ?? 0 : 0,
      peerMedian: historySeries && historySeries.peer_median ? historySeries.peer_median[idx] ?? 0 : 0,
    }));
  }

  const reconData = shopData
    ? {
        opening_kg: shopData.stock_reconciliation.opening_kg,
        received_kg: shopData.stock_reconciliation.received_kg,
        sold_kg: shopData.stock_reconciliation.sold_kg,
        closing_kg: shopData.stock_reconciliation.closing_kg,
        gap_kg: shopData.stock_reconciliation.gap_kg,
        gap_pct: shopData.stock_reconciliation.gap_pct,
        direction: shopData.stock_reconciliation.gap_kg >= 0 ? "shortfall" : "surplus",
      }
    : null;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Navigation Breadcrumb */}
        <div>
          <Link
            href="/queue"
            className="text-meta font-medium text-accent hover:underline inline-flex items-center space-x-1"
          >
            <span>&larr; Back to Queue</span>
          </Link>
        </div>

        {/* Case Header Card */}
        <div className="bg-surface border border-border rounded-md p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-meta font-semibold text-accent">
                  {c.case_id}
                </span>
                <span className="text-meta text-text-muted">•</span>
                <span className="font-mono text-meta text-text-muted">
                  {c.shop_id}
                </span>
              </div>
              <h1 className="text-title font-semibold text-text mt-1">
                {c.shop_name}
              </h1>
              <p className="text-meta text-text-muted mt-0.5">
                {c.taluka}, {c.district} District
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={c.status} isOverdue={c.is_overdue} />
              <div className="flex items-center space-x-1.5 bg-background border border-border px-3 py-1 rounded-sm">
                <span className="text-meta text-text-muted font-medium">Risk:</span>
                <span className="font-mono font-bold text-body text-text">
                  {c.risk_score_latest.toFixed(1)}
                </span>
                <RiskBadge level={c.band_latest} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-border/60 text-meta">
            <div>
              <span className="text-text-muted block text-[11px]">Current Assignee</span>
              <span className="font-medium text-text">
                {c.assignee_name || "Unassigned"}
              </span>
            </div>
            <div>
              <span className="text-text-muted block text-[11px]">Opened Week</span>
              <span className="font-medium font-mono text-text">
                {c.opened_week} {c.is_overdue ? "(Overdue)" : ""}
              </span>
            </div>
            <div>
              <span className="text-text-muted block text-[11px]">Created At</span>
              <span className="font-medium text-text">{c.created_at.slice(0, 10)}</span>
            </div>
            <div>
              <span className="text-text-muted block text-[11px]">Last Flagged Week</span>
              <span className="font-medium text-text">{c.last_flagged_week}</span>
            </div>
          </div>
        </div>

        {/* Action Alert Banner */}
        {actionSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-meta flex items-center justify-between">
            <span>{actionSuccess}</span>
            <button
              onClick={() => setActionSuccess(null)}
              className="text-emerald-900 font-bold ml-2"
            >
              &times;
            </button>
          </div>
        )}

        {/* Action Bar */}
        <div className="bg-surface border border-border rounded-md p-4 shadow-sm">
          <div className="text-meta font-semibold text-text uppercase tracking-wider mb-3">
            Available Officer Actions
          </div>
          <CaseActionBar
            allowedActions={caseData.allowed_actions}
            district={c.district}
            taluka={c.taluka}
            onAction={handleAction}
            onTriggerOutcome={() => setShowOutcomeForm(!showOutcomeForm)}
            loading={actionLoading}
          />
        </div>

        {/* Outcome Recording Form */}
        {showOutcomeForm && (
          <div className="bg-surface border-2 border-accent/40 rounded-md p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="text-section font-semibold text-text">
                Record Inspection Findings & Verification
              </h3>
              <button
                onClick={() => setShowOutcomeForm(false)}
                className="text-text-muted hover:text-text text-body"
              >
                &times;
              </button>
            </div>
            <OutcomeForm
              onSubmit={handleAction}
              onCancel={() => setShowOutcomeForm(false)}
              submitting={actionLoading}
            />
          </div>
        )}

        {/* Main Grid: Evidence and Audit (Left) + Timeline & Checklist (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: 2 Spans */}
          <div className="lg:col-span-2 space-y-6">
            {shopData ? (
              <>
                {/* Score Breakdown */}
                <ScoreBreakdown score={shopData.risk_score} breakdown={shopData.breakdown} />

                {/* Evidence Summary */}
                {shopData.explanation && (
                  <EvidenceList
                    reason={shopData.explanation.reason}
                    evidence={shopData.explanation.evidence}
                    source={shopData.explanation.source}
                  />
                )}

                {/* Reconciliation & Board */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {reconData && <ReconcileTable data={reconData} />}
                  <BoardCheckCard data={shopData.board_check} />
                </div>

                {/* Trend Chart */}
                {trendData.length > 0 && (
                  <TrendChart
                    title={`${topSignalLabel} trend vs peers`}
                    unit={topSignalUnit}
                    data={trendData}
                  />
                )}
              </>
            ) : (
              <div className="bg-surface border border-border rounded-md p-8 text-center text-meta text-text-muted">
                Detailed shop transaction records are not loaded or out of scope.
              </div>
            )}
          </div>

          {/* Right Column: 1 Span */}
          <div className="space-y-6">
            {/* Timeline */}
            <div className="bg-surface border border-border rounded-md p-4">
              <h3 className="text-section font-semibold text-text mb-3 border-b border-border pb-2">
                Case Activity Log
              </h3>
              <ActionTimeline actions={caseData.actions} />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
