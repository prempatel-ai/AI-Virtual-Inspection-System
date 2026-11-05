"use client";

import React, { useState } from "react";
import {
  AppShell,
  PageHeader,
  KpiCard,
  RiskBadge,
  SignalChip,
  FilterBar,
  DataTable,
  ScoreBreakdown,
  TrendChart,
  ReconcileTable,
  EvidenceList,
  ChecklistPanel,
  FeedbackForm,
  EmptyState,
  ErrorState,
  Skeleton,
} from "../../components/ui";

export default function BlocksGalleryPage() {
  const [district, setDistrict] = useState("");
  const [taluka, setTaluka] = useState("");
  const [band, setBand] = useState("");

  const sampleColumns = [
    { key: "rank", header: "Rank", render: (item: { rank: number }) => item.rank },
    { key: "shop", header: "Shop", render: (item: { shop: string }) => item.shop },
    { key: "score", header: "Score", align: "right" as const, render: (item: { score: number }) => item.score.toFixed(1) },
    {
      key: "band",
      header: "Risk",
      render: (item: { band: string }) => <RiskBadge level={item.band} />,
    },
  ];

  const sampleData = [
    { rank: 1, shop: "Shop FPS-00012", score: 84.5, band: "high" },
    { rank: 2, shop: "Shop FPS-00045", score: 62.0, band: "medium" },
    { rank: 3, shop: "Shop FPS-00108", score: 18.2, band: "low" },
  ];

  const sampleBreakdown = [
    { key: "stock_gap_pct", label: "Stock gap", points: 25.0, value: 10.5, unit: "%" },
    { key: "board_mismatch_pct", label: "Notice board mismatch", points: 15.0, value: 8.0, unit: "%" },
    { key: "unauth_share", label: "Unauthenticated sales", points: 12.0, value: 18.0, unit: "%" },
  ];

  const sampleTrend = [
    { week: "21 Sep", shopValue: 4.2, peerMedian: 2.1 },
    { week: "28 Sep", shopValue: 5.1, peerMedian: 2.2 },
    { week: "05 Oct", shopValue: 8.4, peerMedian: 2.0 },
    { week: "12 Oct", shopValue: 10.5, peerMedian: 2.3 },
  ];

  const sampleRecon = {
    opening_kg: 1000.0,
    received_kg: 500.0,
    sold_kg: 400.0,
    closing_kg: 950.0,
    gap_kg: 150.0,
    gap_pct: 10.5,
    direction: "shortfall",
  };

  const sampleEvidence = [
    { fact_id: "val_stock_gap_pct", statement: "Stock records show a shortfall of 150.0 kg (10.5% gap)." },
    { fact_id: "val_board_mismatch_pct", statement: "Notice board distribution differs from sales volume by 8.0%." },
  ];

  const sampleChecklist = [
    { action: "Conduct physical stock audit in shop godown", why: "Physical stock count differs significantly", fact_id: "val_stock_gap_pct" },
    { action: "Inspect public display board and verify against ePoS ledger", why: "Quantity displayed does not match sales", fact_id: "val_board_mismatch_pct" },
  ];

  return (
    <AppShell
      headerRight={
        <div className="flex items-center space-x-2 text-meta text-text-muted">
          <span>Component Gallery</span>
        </div>
      }
    >
      <PageHeader
        title="UI Component Gallery"
        description="Catalog of all reusable enterprise UI blocks configured to DESIGN.md tokens."
      />

      <div className="space-y-8">
        {/* KPI Cards */}
        <section>
          <h2 className="text-section font-semibold text-text mb-3">KPI Cards</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Shops monitored" value="17,000" context="Active in Gujarat" />
            <KpiCard label="High risk flagged" value="142" unit="shops" context="Score &ge; 70" />
            <KpiCard label="Inspection priority (K)" value="26" context="Top priority quota" />
            <KpiCard label="Confirmed visit rate" value="78.5%" context="Based on officer visits" />
          </div>
        </section>

        {/* Badges & Chips */}
        <section>
          <h2 className="text-section font-semibold text-text mb-3">Badges &amp; Chips</h2>
          <div className="flex flex-wrap items-center gap-3 bg-bg border border-border rounded-md p-4">
            <RiskBadge level="high" />
            <RiskBadge level="medium" />
            <RiskBadge level="low" />
            <SignalChip label="Stock gap" points={25.0} />
            <SignalChip label="Notice board" points={15.0} />
            <SignalChip label="Aadhaar auth fail" points={8.5} />
          </div>
        </section>

        {/* Filter Bar */}
        <section>
          <h2 className="text-section font-semibold text-text mb-3">Filter Bar</h2>
          <FilterBar
            districts={[{ label: "Ahmedabad", value: "Ahmedabad" }, { label: "Surat", value: "Surat" }]}
            talukas={[{ label: "Taluka 1", value: "Taluka 1" }]}
            selectedDistrict={district}
            selectedTaluka={taluka}
            selectedBand={band}
            onDistrictChange={setDistrict}
            onTalukaChange={setTaluka}
            onBandChange={setBand}
            onClear={() => { setDistrict(""); setTaluka(""); setBand(""); }}
            rightAction={<span className="text-meta text-text-muted">Action Slot</span>}
          />
        </section>

        {/* Data Table */}
        <section>
          <h2 className="text-section font-semibold text-text mb-3">Data Table</h2>
          <DataTable
            columns={sampleColumns}
            data={sampleData}
            keyField="rank"
          />
        </section>

        {/* Domain Blocks Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ScoreBreakdown score={52.0} breakdown={sampleBreakdown} />
          <TrendChart title="Stock gap trend vs taluka peers" unit="%" data={sampleTrend} />
          <ReconcileTable data={sampleRecon} />
          <EvidenceList reason="Prioritized due to elevated stock gap." evidence={sampleEvidence} source="groq" />
          <ChecklistPanel items={sampleChecklist} />
          <FeedbackForm shopId="FPS-00012" onSubmit={() => {}} />
        </section>

        {/* States */}
        <section>
          <h2 className="text-section font-semibold text-text mb-3">Standard States</h2>
          <div className="space-y-4">
            <EmptyState onAction={() => {}} />
            <ErrorState onRetry={() => {}} />
            <div className="bg-bg border border-border rounded-md p-4 space-y-2">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
