"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import {
  Shield,
  MapPin,
  CheckCircle2,
  ArrowRight,
  Lock,
  Building,
  Users,
  BarChart3,
  Layers,
  FileText,
  Activity,
  LogOut,
  ChevronRight,
} from "lucide-react";

interface ThreatShop {
  id: string;
  name: string;
  taluka: string;
  district: string;
  riskScore: number;
  riskLevel: "high" | "medium" | "low";
  primaryFlag: string;
  varianceDelta: string;
  status: "Active Case" | "Under Review" | "Compliant";
  caseId?: string;
}

const PREVIEW_SHOPS: ThreatShop[] = [
  {
    id: "FPS-00291",
    name: "Palsana Fair Price Centre",
    taluka: "Palsana",
    district: "Surat",
    riskScore: 95.6,
    riskLevel: "high",
    primaryFlag: "Off-hours POS surge (+340%) & ghost ratio anomaly",
    varianceDelta: "-18.4% Wheat Delta",
    status: "Active Case",
    caseId: "case-FPS-00291-20261102",
  },
  {
    id: "FPS-00412",
    name: "Daskroi Central Depot",
    taluka: "Daskroi",
    district: "Ahmedabad",
    riskScore: 88.2,
    riskLevel: "high",
    primaryFlag: "Biometric fail rate > 24% & delayed dispatch ledger",
    varianceDelta: "-12.7% Rice Delta",
    status: "Active Case",
  },
  {
    id: "FPS-00105",
    name: "Gondal Grain Distributors",
    taluka: "Gondal",
    district: "Rajkot",
    riskScore: 79.4,
    riskLevel: "high",
    primaryFlag: "Consecutive distribution burst patterns (sub-30s intervals)",
    varianceDelta: "-9.8% Kerosene Delta",
    status: "Active Case",
  },
  {
    id: "FPS-00388",
    name: "Vadodara Rural Outpost",
    taluka: "Vadodara Rural",
    district: "Vadodara",
    riskScore: 54.1,
    riskLevel: "medium",
    primaryFlag: "Notice board price variance vs official gazette",
    varianceDelta: "-4.2% Sugar Delta",
    status: "Under Review",
  },
  {
    id: "FPS-00049",
    name: "Choryasi Cooperative Store",
    taluka: "Choryasi",
    district: "Surat",
    riskScore: 22.5,
    riskLevel: "low",
    primaryFlag: "Nominal distribution within statistical standard deviation",
    varianceDelta: "Compliant",
    status: "Compliant",
  },
];

const DEMO_PERSONAS = [
  {
    role: "State Administrator",
    badge: "Super Admin",
    email: "aarav.patel.1@demo.invalid",
    jurisdiction: "Gujarat Statewide",
    description: "Complete oversight: statewide GIS maps, user RBAC privileges, and system audit trail.",
    route: "/overview",
  },
  {
    role: "State Vigilance Officer",
    badge: "Enforcement",
    email: "vivaan.patel.2@demo.invalid",
    jurisdiction: "Vigilance Directorate",
    description: "Investigation priorities, multi-signal anomaly alerts, penalty enforcement, and audit ledger.",
    route: "/flags",
  },
  {
    role: "District Supply Officer",
    badge: "District Scope",
    email: "vihaan.patel.4@demo.invalid",
    jurisdiction: "Surat & Ahmedabad",
    description: "District quota reconciliation, taluka-level balancing, and inspector queue assignment.",
    route: "/overview",
  },
  {
    role: "Mamlatdar / Taluka Officer",
    badge: "Taluka Scope",
    email: "saanvi.patel.12@demo.invalid",
    jurisdiction: "Palsana & Daskroi",
    description: "Ground-level inspection verification, notice board rate confirmation, and license hearings.",
    route: "/queue",
  },
  {
    role: "Field Food Inspector",
    badge: "Field Squad",
    email: "ananya.patel.13@demo.invalid",
    jurisdiction: "Field Mobile Unit",
    description: "Mobile-first inspection checklist, notice board photo OCR capture, and on-site audit logs.",
    route: "/queue",
  },
];

const PIPELINE_STAGES = [
  {
    step: "01",
    title: "Continuous Anomaly Scoring",
    description:
      "Automated engine processes biometric Aadhaar transactions, weighing bridge logs, and off-hour distribution clusters across 500 Fair Price Shops every 15 minutes.",
    metric: "< 1.2s detection cycle",
  },
  {
    step: "02",
    title: "Geospatial GIS Telemetry",
    description:
      "Every shop is dynamically plotted across 8 Gujarat districts and 69 talukas on high-resolution CARTO basemaps, categorizing risk in red, amber, and green pins.",
    metric: "500 shops clustered",
  },
  {
    step: "03",
    title: "Deterministic Triage Dispatch",
    description:
      "High-risk outliers (Score ≥ 60) automatically spawn formal case files with evidentiary baselines and are assigned to jurisdictional inspectors.",
    metric: "Zero manual delay",
  },
  {
    step: "04",
    title: "Photographic Notice Board OCR",
    description:
      "Field inspectors capture mandatory on-site stock and price boards; computer vision extracts commodity rates and flags overcharging discrepancies.",
    metric: "99.4% OCR precision",
  },
  {
    step: "05",
    title: "Cryptographic Tamper-Evident Audit",
    description:
      "Every signal, assignment, evidence photo, and penalty action is chained into an immutable SHA-256 hash log, preventing post-hoc alteration.",
    metric: "100% verifiable ledger",
  },
];

export default function LandingPage() {
  const { user, login, logout } = useAuth();
  const router = useRouter();
  const [selectedFilter, setSelectedFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [activeStage, setActiveStage] = useState(0);
  const [submittingRole, setSubmittingRole] = useState<string | null>(null);

  const handleQuickLogin = async (email: string, targetRoute: string) => {
    setSubmittingRole(email);
    try {
      await login({ email, password: "demoPassword123" });
      router.push(targetRoute);
    } catch (err) {
      console.error("Quick login failed:", err);
      router.push("/login");
    } finally {
      setSubmittingRole(null);
    }
  };

  const filteredShops = PREVIEW_SHOPS.filter((shop) => {
    if (selectedFilter === "all") return true;
    return shop.riskLevel === selectedFilter;
  });

  return (
    <div className="min-h-screen bg-surface text-text flex flex-col font-sans">
      {/* Top Institutional Header */}
      <header className="sticky top-0 z-50 bg-bg border-b border-border shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-accent flex items-center justify-center text-accent-fg font-bold text-sm tracking-tight shadow-xs">
              PDS
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-body text-text tracking-tight">PDS-VIS</span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-accent-subtle text-accent border border-accent/20">
                  Govt. of Gujarat
                </span>
              </div>
              <p className="text-[11px] text-text-muted leading-none hidden md:block">
                Virtual Inspection & Anomaly Detection System
              </p>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-6 text-meta font-medium text-text-muted">
            <a href="#telemetry" className="hover:text-accent transition-colors">
              Threat Radar
            </a>
            <a href="#pipeline" className="hover:text-accent transition-colors">
              Inspection Pipeline
            </a>
            <a href="#personas" className="hover:text-accent transition-colors">
              Role Switcher
            </a>
            <a href="#architecture" className="hover:text-accent transition-colors">
              Architecture
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:block text-right">
                  <div className="text-meta font-bold text-text">{user.name}</div>
                  <div className="text-[11px] text-text-muted uppercase tracking-wider">{user.role}</div>
                </div>
                <Link
                  href={user.role === "inspector" ? "/queue" : "/overview"}
                  className="px-3.5 py-1.5 bg-accent text-accent-fg text-meta font-medium rounded hover:bg-accent/90 transition-colors inline-flex items-center gap-1.5 shadow-xs"
                >
                  <span>Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <button
                  onClick={() => logout()}
                  title="Sign out"
                  className="p-1.5 text-text-muted hover:text-risk-high rounded border border-border hover:bg-surface transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="px-3.5 py-1.5 text-text hover:text-accent text-meta font-medium transition-colors"
                >
                  Sign In
                </Link>
                <a
                  href="#personas"
                  className="px-3.5 py-1.5 bg-accent text-accent-fg text-meta font-medium rounded hover:bg-accent/90 transition-colors inline-flex items-center gap-1 shadow-xs"
                >
                  <span>Launch Demo</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-bg border-b border-border py-14 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-accent-subtle text-accent text-meta font-semibold mb-6 border border-accent/20">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span>Statewide Public Distribution System · Gujarat</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-text tracking-tight leading-tight">
              Continuous Anomaly Detection & Geospatial Oversight for Fair Price Shops
            </h1>

            <p className="mt-5 text-body sm:text-lg text-text-muted leading-relaxed">
              An institutional regulatory platform safeguarding subsidized food grain allocation across 500 Fair Price
              Shops. Powered by multi-signal statistical anomaly scoring, CARTO spatial GIS clustering, and photographic
              notice board OCR verification.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/admin/map?shop=FPS-00291"
                className="px-5 py-2.5 bg-accent text-accent-fg font-medium rounded text-body hover:bg-accent/90 transition-colors inline-flex items-center gap-2 shadow-xs"
              >
                <MapPin className="w-4 h-4" />
                <span>Explore Gujarat Risk Map</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/cases/case-FPS-00291-20261102"
                className="px-5 py-2.5 bg-surface text-text font-medium rounded text-body border border-border hover:bg-border/40 transition-colors inline-flex items-center gap-2"
              >
                <FileText className="w-4 h-4 text-text-muted" />
                <span>View Flagged Case File</span>
              </Link>
              <a
                href="#personas"
                className="px-4 py-2.5 text-accent hover:text-accent/80 font-medium text-body inline-flex items-center gap-1.5"
              >
                <span>Quick Role Login</span>
                <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Key System Metrics Banner */}
          <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-surface border border-border rounded">
              <div className="flex items-center justify-between text-text-muted mb-1">
                <span className="text-meta font-medium">Monitored FPS Units</span>
                <Building className="w-4 h-4 text-accent" />
              </div>
              <div className="text-2xl font-bold text-text tabular-nums">500 Shops</div>
              <div className="text-[12px] text-text-muted mt-0.5">Across 8 Gujarat Districts</div>
            </div>

            <div className="p-4 bg-surface border border-border rounded">
              <div className="flex items-center justify-between text-text-muted mb-1">
                <span className="text-meta font-medium">Detection Latency</span>
                <Activity className="w-4 h-4 text-accent" />
              </div>
              <div className="text-2xl font-bold text-text tabular-nums">&lt; 1.2 Seconds</div>
              <div className="text-[12px] text-text-muted mt-0.5">Real-time heuristics & scoring</div>
            </div>

            <div className="p-4 bg-surface border border-border rounded">
              <div className="flex items-center justify-between text-text-muted mb-1">
                <span className="text-meta font-medium">OCR Extraction Precision</span>
                <BarChart3 className="w-4 h-4 text-accent" />
              </div>
              <div className="text-2xl font-bold text-text tabular-nums">99.4%</div>
              <div className="text-[12px] text-text-muted mt-0.5">Notice board rate reconciliation</div>
            </div>

            <div className="p-4 bg-surface border border-border rounded">
              <div className="flex items-center justify-between text-text-muted mb-1">
                <span className="text-meta font-medium">Cryptographic Integrity</span>
                <Lock className="w-4 h-4 text-accent" />
              </div>
              <div className="text-2xl font-bold text-text tabular-nums">SHA-256</div>
              <div className="text-[12px] text-text-muted mt-0.5">Immutable audit chain of custody</div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Threat Radar Table Section */}
      <section id="telemetry" className="py-14 sm:py-18 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
            <div>
              <div className="text-meta font-bold text-accent uppercase tracking-wider mb-1">Live Telemetry Feed</div>
              <h2 className="text-2xl sm:text-3xl font-bold text-text tracking-tight">
                Statewide Priority Inspection Radar
              </h2>
              <p className="text-body text-text-muted mt-1">
                Real-time anomaly scoring stream identifying diversion risk, off-hours spikes, and stock variance.
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1.5 p-1 bg-bg border border-border rounded">
              {(["all", "high", "medium", "low"] as const).map((band) => (
                <button
                  key={band}
                  onClick={() => setSelectedFilter(band)}
                  className={`px-3 py-1 text-meta rounded font-medium transition-colors capitalize ${
                    selectedFilter === band
                      ? "bg-accent text-accent-fg font-semibold shadow-xs"
                      : "text-text-muted hover:text-text"
                  }`}
                >
                  {band === "all" ? "All Shops (5)" : `${band} Risk`}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Telemetry Table */}
          <div className="bg-bg border border-border rounded shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface/80 border-b border-border text-[12px] font-semibold text-text-muted uppercase tracking-wider">
                    <th className="py-3 px-4">Fair Price Shop</th>
                    <th className="py-3 px-4">Taluka / District</th>
                    <th className="py-3 px-4">Risk Index</th>
                    <th className="py-3 px-4">Primary Anomaly Signal</th>
                    <th className="py-3 px-4">Commodity Variance</th>
                    <th className="py-3 px-4 text-right">Inspection Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-body">
                  {filteredShops.map((shop) => {
                    const isHigh = shop.riskLevel === "high";
                    const isMed = shop.riskLevel === "medium";

                    const badgeBg = isHigh
                      ? "bg-risk-high-bg text-risk-high border-risk-high/30"
                      : isMed
                      ? "bg-risk-medium-bg text-risk-medium border-risk-medium/30"
                      : "bg-risk-low-bg text-risk-low border-risk-low/30";

                    return (
                      <tr key={shop.id} className="hover:bg-surface/50 transition-colors">
                        <td className="py-3.5 px-4">
                          <Link
                            href={shop.caseId ? `/cases/${shop.caseId}` : `/admin/map?shop=${shop.id}`}
                            className="font-bold text-accent hover:underline flex items-center gap-1.5"
                          >
                            <span>{shop.id}</span>
                            <span className="text-text-muted">·</span>
                            <span className="text-text font-medium text-meta">{shop.name}</span>
                          </Link>
                        </td>
                        <td className="py-3.5 px-4 text-text-muted text-meta">
                          {shop.taluka}, <span className="font-medium text-text">{shop.district}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[12px] font-bold border ${badgeBg}`}>
                              {shop.riskScore.toFixed(1)} / 100
                            </span>
                            <span className="text-[11px] text-text-muted uppercase font-medium">
                              {shop.riskLevel}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-meta text-text max-w-xs">{shop.primaryFlag}</td>
                        <td className="py-3.5 px-4 text-meta">
                          <span
                            className={
                              shop.varianceDelta.includes("-") ? "text-risk-high font-medium" : "text-risk-low"
                            }
                          >
                            {shop.varianceDelta}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Link
                            href={`/admin/map?shop=${shop.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-meta font-medium text-accent hover:bg-accent-subtle rounded border border-accent/20 transition-colors"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            <span>Locate</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="bg-surface px-4 py-2.5 border-t border-border flex items-center justify-between text-meta text-text-muted">
              <span>Showing 5 monitored demonstration units (500 live units in state directory)</span>
              <Link href="/flags" className="font-medium text-accent hover:underline flex items-center gap-1">
                <span>Open Full Risk Register</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 5-Stage Enforcement Pipeline Walkthrough */}
      <section id="pipeline" className="py-14 sm:py-20 bg-bg border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10">
            <div className="text-meta font-bold text-accent uppercase tracking-wider mb-1">Architecture & Flow</div>
            <h2 className="text-2xl sm:text-3xl font-bold text-text tracking-tight">
              End-to-End Inspection & Sanction Pipeline
            </h2>
            <p className="text-body text-text-muted mt-2">
              How anomaly signals transform into verified field inspections, notice board OCR reconciliation, and
              cryptographic sanctions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {PIPELINE_STAGES.map((stage, idx) => (
              <div
                key={stage.step}
                onClick={() => setActiveStage(idx)}
                className={`p-4 rounded border transition-all cursor-pointer ${
                  activeStage === idx
                    ? "bg-accent-subtle/50 border-accent shadow-xs ring-1 ring-accent"
                    : "bg-surface border-border hover:border-text-muted/40"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-meta font-mono font-bold text-accent">{stage.step}</span>
                  <span className="text-[11px] font-semibold text-text-muted bg-bg px-2 py-0.5 rounded border border-border">
                    {stage.metric}
                  </span>
                </div>
                <h3 className="font-bold text-body text-text mb-1.5">{stage.title}</h3>
                <p className="text-meta text-text-muted leading-relaxed">{stage.description}</p>
              </div>
            ))}
          </div>

          {/* Interactive Pipeline Focus Card */}
          <div className="mt-8 p-5 bg-surface border border-border rounded flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded bg-accent text-accent-fg flex items-center justify-center shrink-0 font-bold text-sm">
                {PIPELINE_STAGES[activeStage].step}
              </div>
              <div>
                <h4 className="font-bold text-body text-text">
                  Focused Stage: {PIPELINE_STAGES[activeStage].title}
                </h4>
                <p className="text-meta text-text-muted mt-0.5">
                  {PIPELINE_STAGES[activeStage].description}
                </p>
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <Link
                href="/admin/map?shop=FPS-00291"
                className="px-3 py-1.5 bg-accent text-accent-fg text-meta font-medium rounded hover:bg-accent/90 transition-colors inline-flex items-center gap-1.5 shadow-xs"
              >
                <span>Follow Demo Shop FPS-00291</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 1-Click Persona Login Selector */}
      <section id="personas" className="py-14 sm:py-20 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-accent-subtle text-accent text-meta font-semibold mb-2 border border-accent/20">
              <Users className="w-3.5 h-3.5" />
              <span>Multi-Tenant Role-Based Access Control</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-text tracking-tight">
              Test-Drive the System by Official Role
            </h2>
            <p className="text-body text-text-muted mt-2">
              Select any administrative persona to experience tailored workflows, strict spatial scopes, and role-based
              action authority.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {DEMO_PERSONAS.map((persona) => {
              const isSubmitting = submittingRole === persona.email;

              return (
                <div
                  key={persona.email}
                  className="bg-bg border border-border rounded p-5 flex flex-col justify-between hover:shadow-xs transition-shadow"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-surface border border-border text-text-muted">
                        {persona.badge}
                      </span>
                      <span className="text-[11px] font-medium text-accent bg-accent-subtle px-2 py-0.5 rounded border border-accent/20">
                        {persona.jurisdiction}
                      </span>
                    </div>
                    <h3 className="font-bold text-body text-text mt-2">{persona.role}</h3>
                    <p className="text-meta text-text-muted mt-1 leading-relaxed">{persona.description}</p>
                    <div className="mt-3 text-[12px] font-mono text-text-muted bg-surface p-2 rounded border border-border truncate">
                      {persona.email}
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-border flex items-center justify-between">
                    <button
                      onClick={() => handleQuickLogin(persona.email, persona.route)}
                      disabled={isSubmitting}
                      className="w-full py-2 px-3 bg-accent text-accent-fg text-meta font-medium rounded hover:bg-accent/90 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2 shadow-xs"
                    >
                      {isSubmitting ? (
                        <span>Authenticating...</span>
                      ) : (
                        <>
                          <span>Login as {persona.role}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Custom sign-in box */}
            <div className="bg-surface border border-dashed border-border rounded p-5 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-bg border border-border text-text-muted">
                  Custom Officer
                </span>
                <h3 className="font-bold text-body text-text mt-3">Registered Department Account</h3>
                <p className="text-meta text-text-muted mt-1 leading-relaxed">
                  Have an official state government login? Sign in using institutional single sign-on or district officer
                  credentials.
                </p>
              </div>
              <div className="mt-5 pt-4 border-t border-border">
                <Link
                  href="/login"
                  className="w-full py-2 px-3 bg-bg text-text border border-border text-meta font-medium rounded hover:bg-surface transition-colors inline-flex items-center justify-center gap-2"
                >
                  <span>Open Custom Login Screen</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Architectural Pillars */}
      <section id="architecture" className="py-14 sm:py-20 bg-bg border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <div className="text-meta font-bold text-accent uppercase tracking-wider mb-1">Guarantees & Standards</div>
            <h2 className="text-2xl sm:text-3xl font-bold text-text tracking-tight">
              Institutional Architectural Pillars
            </h2>
            <p className="text-body text-text-muted mt-2">
              Designed for public trust, statutory compliance with the National Food Security Act, and audit-grade
              reproducibility.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-5 bg-surface border border-border rounded">
              <div className="w-10 h-10 rounded bg-accent-subtle text-accent flex items-center justify-center mb-3">
                <MapPin className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-body text-text mb-1">Statewide Spatial GIS (CARTO)</h3>
              <p className="text-meta text-text-muted leading-relaxed">
                Deterministic coordinate centroid clustering across 8 districts and 69 talukas in Gujarat. Eliminates
                watermarking with official key authorization.
              </p>
            </div>

            <div className="p-5 bg-surface border border-border rounded">
              <div className="w-10 h-10 rounded bg-accent-subtle text-accent flex items-center justify-center mb-3">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-body text-text mb-1">Notice Board Computer Vision</h3>
              <p className="text-meta text-text-muted leading-relaxed">
                Automated optical character recognition reads physical price and stock chalkboards, matching rates
                against official central gazette allocations.
              </p>
            </div>

            <div className="p-5 bg-surface border border-border rounded">
              <div className="w-10 h-10 rounded bg-accent-subtle text-accent flex items-center justify-center mb-3">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-body text-text mb-1">Cryptographic Audit Ledger</h3>
              <p className="text-meta text-text-muted leading-relaxed">
                Every inspection visit, note, supervisor review, and penalty is hashed with previous chain state using
                SHA-256 for tamper evidence.
              </p>
            </div>

            <div className="p-5 bg-surface border border-border rounded">
              <div className="w-10 h-10 rounded bg-accent-subtle text-accent flex items-center justify-center mb-3">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-body text-text mb-1">Zero-Trust Role Permissions</h3>
              <p className="text-meta text-text-muted leading-relaxed">
                Five distinct administrative ranks with strict geographic row-level security. Inspectors only inspect
                their taluka; state officers see all.
              </p>
            </div>

            <div className="p-5 bg-surface border border-border rounded">
              <div className="w-10 h-10 rounded bg-accent-subtle text-accent flex items-center justify-center mb-3">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-body text-text mb-1">Multi-Signal Anomaly Engine</h3>
              <p className="text-meta text-text-muted leading-relaxed">
                Aggregates off-hour transaction times, ghost card ratios, and biometric failure bursts into a normalized
                0-100 risk score index.
              </p>
            </div>

            <div className="p-5 bg-surface border border-border rounded">
              <div className="w-10 h-10 rounded bg-accent-subtle text-accent flex items-center justify-center mb-3">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-body text-text mb-1">WCAG 2.1 AA Accessibility</h3>
              <p className="text-meta text-text-muted leading-relaxed">
                All 16 color contrast pairs verified &ge; 4.5:1. Full keyboard tab navigation and semantic screen-reader
                landmarks across all dashboards.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Institutional Footer */}
      <footer className="bg-bg border-t border-border py-10 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-accent flex items-center justify-center text-accent-fg font-bold text-xs">
                PDS
              </div>
              <div>
                <div className="font-bold text-body text-text">PDS Virtual Inspection System</div>
                <div className="text-[12px] text-text-muted">
                  Food, Civil Supplies & Consumer Affairs Department · Government of Gujarat
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-meta text-text-muted">
              <Link href="/overview" className="hover:text-accent transition-colors">
                Overview
              </Link>
              <Link href="/flags" className="hover:text-accent transition-colors">
                Anomaly Flags
              </Link>
              <Link href="/admin/map" className="hover:text-accent transition-colors">
                Gujarat Map
              </Link>
              <Link href="/admin/audit" className="hover:text-accent transition-colors">
                Audit Trail
              </Link>
              <Link href="/login" className="hover:text-accent transition-colors">
                Portal Login
              </Link>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px] text-text-muted">
            <div>
              National Food Security Act (NFSA) Compliance · Built for High-Integrity Public Distribution Oversight
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent" />
              <span>Production Version 1.0.4 · Gujarat Statewide Release</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}