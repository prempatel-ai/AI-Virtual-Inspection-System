"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AppShell } from "../../../components/ui/AppShell";
import { ErrorState } from "../../../components/ui/ErrorState";
import { useAuth } from "../../../lib/auth";
import {
  getAdminMapShops,
  getMeta,
  MapShopItem,
  AdminMapResponse,
} from "../../../lib/api";
import { Search, MapPin, AlertTriangle, ShieldCheck, ExternalLink } from "lucide-react";

// Dynamically import Leaflet map component with SSR disabled
const AdminMap = dynamic(() => import("../../../components/ui/AdminMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[650px] bg-surface border border-border rounded-md flex items-center justify-center text-text-muted">
      <div className="text-center space-y-2">
        <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full mx-auto" />
        <p className="text-meta">Loading Gujarat Risk Map...</p>
      </div>
    </div>
  ),
});

export default function AdminMapPage() {
  const { hasPermission } = useAuth();

  const [data, setData] = useState<AdminMapResponse | null>(null);
  const [districts, setDistricts] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & selection
  const [selectedDistrict, setSelectedDistrict] = useState<string>("all");
  const [selectedBand, setSelectedBand] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedShop, setSelectedShop] = useState<MapShopItem | null>(null);

  // Load metadata and shops
  const loadShops = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [metaRes, mapRes] = await Promise.all([
        getMeta().catch(() => null),
        getAdminMapShops({
          district: selectedDistrict !== "all" ? selectedDistrict : undefined,
          band: selectedBand !== "all" ? selectedBand : undefined,
        }),
      ]);

      if (metaRes?.districts) {
        setDistricts(metaRes.districts);
      }
      setData(mapRes);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load Gujarat shop map data.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [selectedDistrict, selectedBand]);

  useEffect(() => {
    if (hasPermission("users:manage")) {
      loadShops();
    }
  }, [hasPermission, loadShops]);

  // Client-side search filtering (by shop ID, name, or taluka)
  const filteredShops = useMemo(() => {
    if (!data?.items) return [];
    const query = searchQuery.trim().toLowerCase();
    if (!query) return data.items;

    return data.items.filter(
      (s) =>
        s.shop_id.toLowerCase().includes(query) ||
        s.name.toLowerCase().includes(query) ||
        s.taluka.toLowerCase().includes(query) ||
        s.district.toLowerCase().includes(query)
    );
  }, [data?.items, searchQuery]);

  // High risk hotspots (sorted descending by score)
  const highRiskHotspots = useMemo(() => {
    if (!data?.items) return [];
    return data.items
      .filter((s) => s.band === "high")
      .sort((a, b) => b.risk_score - a.risk_score)
      .slice(0, 8);
  }, [data?.items]);

  // RBAC permission enforcement
  if (!hasPermission("users:manage")) {
    return (
      <AppShell>
        <div className="max-w-container mx-auto px-6 py-8">
          <ErrorState message="Administrative privileges (users:manage) are required to access the Gujarat Geographic Risk Map." />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-container mx-auto px-6 py-6 space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="flex items-center space-x-2 text-meta text-text-muted mb-1">
              <Link href="/overview" className="hover:text-text transition-colors">
                Home
              </Link>
              <span>/</span>
              <span className="text-text font-medium">Gujarat Risk Map</span>
            </div>
            <h1 className="text-page font-semibold text-text tracking-tight">
              Gujarat State Risk Map
            </h1>
            <p className="text-body text-text-muted mt-1">
              Geographic spatial distribution of Fair Price Shops across Gujarat categorized by automated engine risk scores.
            </p>
          </div>

          <div className="text-right">
            <span className="text-meta text-text-muted">Active Engine Cycle:</span>{" "}
            {loading ? (
              <span className="font-mono text-meta text-text-muted">Updating...</span>
            ) : (
              <span className="font-mono text-meta font-bold text-accent bg-accent-subtle px-2 py-0.5 rounded">
                {data?.latest_week || "Current Cycle"}
              </span>
            )}
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-surface border border-border p-4 rounded-md">
            <div className="flex items-center justify-between text-meta text-text-muted">
              <span>Total FPS Mapped</span>
              <MapPin className="w-4 h-4 text-accent" />
            </div>
            <div className="mt-2 text-kpi font-bold text-text tabular-nums">
              {data ? data.total_shops : "—"}
            </div>
            <div className="text-[11px] text-text-muted mt-1">
              Gujarat 8 Districts &middot; 69 Talukas
            </div>
          </div>

          <div className="bg-risk-high-bg border border-risk-high/30 p-4 rounded-md">
            <div className="flex items-center justify-between text-meta text-risk-high font-medium">
              <span>High Risk (Red Pins)</span>
              <AlertTriangle className="w-4 h-4 text-risk-high" />
            </div>
            <div className="mt-2 text-kpi font-bold text-risk-high tabular-nums">
              {data ? data.high_count : "—"}
            </div>
            <div className="text-[11px] text-risk-high/80 mt-1">
              Score &ge; 60 &middot; Immediate inspection
            </div>
          </div>

          <div className="bg-risk-medium-bg border border-risk-medium/30 p-4 rounded-md">
            <div className="flex items-center justify-between text-meta text-risk-medium font-medium">
              <span>Medium Risk Pins</span>
              <span className="w-2.5 h-2.5 rounded-full bg-risk-medium inline-block" />
            </div>
            <div className="mt-2 text-kpi font-bold text-risk-medium tabular-nums">
              {data ? data.medium_count : "—"}
            </div>
            <div className="text-[11px] text-risk-medium/80 mt-1">
              Score 30&ndash;59 &middot; Routine audit
            </div>
          </div>

          <div className="bg-risk-low-bg border border-risk-low/30 p-4 rounded-md">
            <div className="flex items-center justify-between text-meta text-risk-low font-medium">
              <span>Low Risk Pins</span>
              <ShieldCheck className="w-4 h-4 text-risk-low" />
            </div>
            <div className="mt-2 text-kpi font-bold text-risk-low tabular-nums">
              {data ? data.low_count : "—"}
            </div>
            <div className="text-[11px] text-risk-low/80 mt-1">
              Score &lt; 30 &middot; Compliant
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-surface border border-border p-4 rounded-md flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search shop by ID, name, or taluka..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-body bg-bg border border-border rounded-sm focus:border-accent focus:outline-none"
            />
          </div>

          <div className="flex items-center space-x-2">
            <label htmlFor="district-filter" className="text-meta text-text-muted whitespace-nowrap">
              District:
            </label>
            <select
              id="district-filter"
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="py-1.5 px-3 text-body bg-bg border border-border rounded-sm focus:border-accent focus:outline-none"
            >
              <option value="all">All Gujarat Districts</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <label htmlFor="band-filter" className="text-meta text-text-muted whitespace-nowrap">
              Risk:
            </label>
            <select
              id="band-filter"
              value={selectedBand}
              onChange={(e) => setSelectedBand(e.target.value)}
              className="py-1.5 px-3 text-body bg-bg border border-border rounded-sm focus:border-accent focus:outline-none"
            >
              <option value="all">All Risk Bands</option>
              <option value="high">High Risk Only (Red)</option>
              <option value="medium">Medium Risk</option>
              <option value="low">Low Risk</option>
            </select>
          </div>

          {(selectedDistrict !== "all" || selectedBand !== "all" || searchQuery) && (
            <button
              onClick={() => {
                setSelectedDistrict("all");
                setSelectedBand("all");
                setSearchQuery("");
                setSelectedShop(null);
              }}
              className="text-meta text-accent hover:underline px-2 py-1"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Error Notification */}
        {error && (
          <ErrorState
            message={error}
            onRetry={loadShops}
          />
        )}

        {/* Main Workspace: Interactive Map and Side Telemetry Pane */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Map Column (3 of 4) */}
          <div className="lg:col-span-3 space-y-2">
            <div className="flex items-center justify-between text-meta text-text-muted px-1">
              <span>
                Showing <strong>{filteredShops.length}</strong> of{" "}
                <strong>{data?.total_shops ?? 0}</strong> shops across Gujarat
              </span>
              <span>Click any marker to inspect shop telemetry and cases</span>
            </div>

            <AdminMap
              shops={filteredShops}
              selectedShopId={selectedShop?.shop_id}
              onSelectShop={(s) => setSelectedShop(s)}
              className="w-full h-[640px] shadow-sm"
            />
          </div>

          {/* Side Telemetry & Hotspot Column (1 of 4) */}
          <div className="lg:col-span-1 space-y-4">
            {/* Selected Shop Inspector Card */}
            {selectedShop ? (
              <div className="bg-surface border-2 border-accent/40 rounded-md p-4 space-y-3 shadow-sm">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-accent">
                    Selected FPS
                  </span>
                  <button
                    onClick={() => setSelectedShop(null)}
                    className="text-text-muted hover:text-text text-meta font-medium"
                  >
                    Clear
                  </button>
                </div>

                <div>
                  <h3 className="text-section font-bold text-text leading-tight">
                    {selectedShop.name}
                  </h3>
                  <div className="font-mono text-meta text-text-muted mt-0.5">
                    FPS ID: {selectedShop.shop_id}
                  </div>
                </div>

                <div className="flex items-center justify-between text-meta">
                  <span className="text-text-muted">Risk Classification:</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded text-[11px] uppercase ${
                      selectedShop.band === "high"
                        ? "bg-risk-high-bg text-risk-high border border-risk-high/30"
                        : selectedShop.band === "medium"
                        ? "bg-risk-medium-bg text-risk-medium border border-risk-medium/30"
                        : "bg-risk-low-bg text-risk-low border border-risk-low/30"
                    }`}
                  >
                    {selectedShop.band} ({selectedShop.risk_score.toFixed(1)})
                  </span>
                </div>

                <div className="text-meta text-text-muted space-y-1 border-t border-border pt-2">
                  <div>
                    District: <strong className="text-text">{selectedShop.district}</strong>
                  </div>
                  <div>
                    Taluka: <strong className="text-text">{selectedShop.taluka}</strong>
                  </div>
                  <div>
                    Ration Cards: <strong className="text-text">{selectedShop.cards_count}</strong>
                  </div>
                  <div>
                    Vulnerability:{" "}
                    <strong className="text-text">
                      {(selectedShop.vulnerability_index * 100).toFixed(0)}%
                    </strong>
                  </div>
                </div>

                {selectedShop.top_signals && selectedShop.top_signals.length > 0 && (
                  <div className="border-t border-border pt-2">
                    <span className="text-[11px] font-semibold uppercase text-text-muted block mb-1">
                      Top Signals
                    </span>
                    <ul className="space-y-1 text-meta">
                      {selectedShop.top_signals.map((sig, idx) => (
                        <li key={idx} className="flex justify-between items-center text-[11px]">
                          <span className="text-text-muted">{sig.label}</span>
                          <span className="font-bold text-risk-high font-mono">
                            +{sig.points}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="border-t border-border pt-3">
                  {selectedShop.case_id ? (
                    <Link
                      href={`/cases/${encodeURIComponent(selectedShop.case_id)}`}
                      className="w-full inline-flex items-center justify-center space-x-1.5 py-2 px-3 bg-accent text-accent-fg rounded-sm text-meta font-medium hover:opacity-90 transition-opacity"
                    >
                      <span>View Active Case</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  ) : (
                    <Link
                      href={`/flags?district=${encodeURIComponent(selectedShop.district)}&taluka=${encodeURIComponent(selectedShop.taluka)}`}
                      className="w-full inline-flex items-center justify-center space-x-1.5 py-2 px-3 bg-bg border border-border text-text rounded-sm text-meta font-medium hover:bg-surface transition-colors"
                    >
                      <span>Inspect Area Flags</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-surface border border-border rounded-md p-4 text-center text-text-muted">
                <MapPin className="w-6 h-6 mx-auto mb-2 text-text-muted/60" />
                <p className="text-body font-medium text-text">Select a Fair Price Shop</p>
                <p className="text-meta text-text-muted mt-1">
                  Click on any marker in the map or choose a hotspot below to inspect.
                </p>
              </div>
            )}

            {/* High-Risk Hotspots Quick Selector */}
            <div className="bg-surface border border-border rounded-md p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-risk-high flex items-center space-x-1">
                  <AlertTriangle className="w-3 h-3 text-risk-high" />
                  <span>High Risk Hotspots</span>
                </span>
                <span className="text-[11px] text-text-muted">Top Scores</span>
              </div>

              <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                {highRiskHotspots.length === 0 ? (
                  <p className="text-meta text-text-muted py-2 text-center">
                    No high-risk shops in current filter.
                  </p>
                ) : (
                  highRiskHotspots.map((shop) => (
                    <button
                      key={shop.shop_id}
                      onClick={() => setSelectedShop(shop)}
                      className={`w-full text-left p-2 rounded-sm border transition-colors flex items-center justify-between text-meta ${
                        selectedShop?.shop_id === shop.shop_id
                          ? "bg-accent-subtle border-accent text-accent"
                          : "bg-bg border-border hover:bg-surface text-text"
                      }`}
                    >
                      <div className="overflow-hidden pr-2">
                        <div className="font-semibold truncate">{shop.name}</div>
                        <div className="text-[11px] text-text-muted truncate">
                          {shop.taluka}, {shop.district}
                        </div>
                      </div>
                      <span className="shrink-0 font-mono font-bold text-risk-high bg-risk-high-bg px-1.5 py-0.5 rounded text-[11px] border border-risk-high/30">
                        {shop.risk_score.toFixed(1)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
