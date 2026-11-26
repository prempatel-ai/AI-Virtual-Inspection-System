"use client";

import React, { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth";
import { Button } from "./button";
import { Badge } from "./badge";
import { Avatar, AvatarFallback } from "./avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import {
  Bell,
  HelpCircle,
  FileText,
  MapPin,
  Settings,
  LogOut,
  ShieldAlert,
  Activity,
  Layers,
  Sparkles,
} from "lucide-react";

interface RoleNavProps {
  headerRight?: React.ReactNode;
}

interface NavLinkItem {
  label: string;
  href: string;
  admin?: boolean;
}

export function RoleNav({ headerRight }: RoleNavProps = {}) {
  const { user, permissions, scope, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!user) return null;

  // Build permitted navigation items
  const primaryLinks: NavLinkItem[] = [];
  const adminLinks: NavLinkItem[] = [];

  if (user.role !== "inspector") {
    primaryLinks.push({ label: "Overview", href: "/overview" });
  }

  if (permissions.includes("cases:view")) {
    primaryLinks.push({ label: "My Queue", href: "/queue" });
  }

  if (permissions.includes("flags:view")) {
    primaryLinks.push({ label: "Flags", href: "/flags" });
  }

  if (permissions.includes("areas:view")) {
    primaryLinks.push({ label: "Areas", href: "/areas" });
  }

  if (permissions.includes("officers:view") && user.role !== "inspector") {
    primaryLinks.push({ label: "Officers", href: "/officers" });
  }

  if (permissions.includes("actions:view")) {
    primaryLinks.push({ label: "Actions", href: "/actions" });
  }

  if (permissions.includes("users:manage")) {
    adminLinks.push({ label: "Users", href: "/admin/users", admin: true });
    adminLinks.push({ label: "Gujarat Map", href: "/admin/map", admin: true });
  }

  if (permissions.includes("audit:view")) {
    adminLinks.push({ label: "Audit Log", href: "/admin/audit", admin: true });
  }

  // Format jurisdiction scope
  let scopeLabel = "State Scope";
  if (scope?.taluka) {
    scopeLabel = scope.taluka;
  } else if (scope?.district) {
    scopeLabel = `${scope.district} Dist.`;
  }

  // Format user role display
  const roleDisplay = user.role
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  const userInitial = user.name ? user.name.charAt(0).toUpperCase() : "U";

  const navigateTo = (href: string) => {
    setMobileMenuOpen(false);
    router.push(href);
  };

  return (
    <div className="w-full flex items-center justify-between gap-4">
      {/* 1. Center-Left: Modern Typographic Navigation Tabs (Desktop) */}
      <nav
        className="hidden lg:flex items-center space-x-6"
        aria-label="Main Navigation"
      >
        {primaryLinks.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);

          return (
            <button
              key={link.href}
              type="button"
              onClick={() => navigateTo(link.href)}
              className={`whitespace-nowrap py-4 text-meta transition-all relative focus:outline-none ${
                isActive
                  ? "text-accent font-semibold"
                  : "text-text-muted hover:text-text font-medium"
              }`}
            >
              <span>{link.label}</span>
              {isActive && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full transition-all"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}

        {/* Hairline Divider & Admin Links */}
        {adminLinks.length > 0 && (
          <div className="flex items-center space-x-6 pl-3 border-l border-border">
            {adminLinks.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
              const isMap = link.href === "/admin/map";

              return (
                <button
                  key={link.href}
                  type="button"
                  onClick={() => navigateTo(link.href)}
                  className={`whitespace-nowrap py-4 text-meta transition-all relative focus:outline-none flex items-center space-x-1.5 ${
                    isActive
                      ? "text-accent font-semibold"
                      : "text-text-muted hover:text-text font-medium"
                  }`}
                >
                  {isMap && <MapPin className="w-3.5 h-3.5 text-accent" />}
                  <span>{link.label}</span>
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full transition-all"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </nav>

      {/* 2. Right Actions: Info, Notifications, Profile & Animated Mobile Menu */}
      <div className="flex items-center space-x-3 shrink-0">
        {headerRight && (
          <div className="hidden sm:flex items-center">
            {headerRight}
          </div>
        )}

        {/* Info & System Architecture Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-text-muted hover:text-text hover:bg-surface rounded-sm transition-colors"
              title="System Information & Architecture"
            >
              <HelpCircle className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 bg-bg border border-border shadow-lg p-1.5">
            <DropdownMenuLabel className="text-meta font-bold text-text px-2 py-1 flex items-center justify-between">
              <span>PDS Virtual Inspection</span>
              <span className="text-[10px] font-mono text-accent bg-accent-subtle px-1.5 py-0.5 rounded">
                v2.0 GOAT
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              onClick={() => navigateTo("/overview")}
              className="cursor-pointer text-meta hover:bg-surface px-2 py-1.5 rounded-sm"
            >
              <Activity className="mr-2 h-4 w-4 text-accent" />
              <span>Engine Status & KPIs</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigateTo("/areas")}
              className="cursor-pointer text-meta hover:bg-surface px-2 py-1.5 rounded-sm"
            >
              <Layers className="mr-2 h-4 w-4 text-accent" />
              <span>Gujarat 8 Dist. / 69 Talukas</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigateTo("/admin/audit")}
              className="cursor-pointer text-meta hover:bg-surface px-2 py-1.5 rounded-sm"
            >
              <FileText className="mr-2 h-4 w-4 text-accent" />
              <span>Cryptographic Audit Trail</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border" />
            <div className="px-2 py-1 text-[11px] text-text-muted">
              Deterministic Anomaly Engine active for Fair Price Shop monitoring.
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications Center with Animated Risk Badge */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 relative text-text-muted hover:text-text hover:bg-surface rounded-sm transition-colors"
              title="Notifications & Alerts"
            >
              <Bell className="w-4 h-4" />
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-4 w-4 rounded-full p-0 text-[10px] flex items-center justify-center font-bold bg-risk-high text-white shadow-sm"
              >
                3
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 bg-bg border border-border shadow-lg p-2 space-y-1">
            <DropdownMenuLabel className="flex items-center justify-between px-1 py-1">
              <span className="font-semibold text-body text-text">Active Risk Alerts</span>
              <span className="text-[11px] font-bold text-risk-high bg-risk-high-bg px-2 py-0.5 rounded border border-risk-high/30">
                3 Critical
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border" />

            <DropdownMenuItem
              onClick={() => navigateTo("/admin/map")}
              className="flex flex-col items-start p-2.5 rounded-sm hover:bg-surface cursor-pointer"
            >
              <div className="flex w-full items-center justify-between text-meta">
                <span className="font-bold text-risk-high flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>3 High-Risk Outages Detected</span>
                </span>
                <span className="text-[10px] text-text-muted">Live</span>
              </div>
              <span className="text-meta text-text-muted mt-1 leading-snug">
                Immediate on-site verification flagged on Gujarat Geographic Risk Map.
              </span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => navigateTo("/flags")}
              className="flex flex-col items-start p-2.5 rounded-sm hover:bg-surface cursor-pointer"
            >
              <div className="flex w-full items-center justify-between text-meta">
                <span className="font-semibold text-text flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                  <span>Engine Scoring Cycle Active</span>
                </span>
                <span className="text-[10px] text-text-muted font-mono">2026-11-02</span>
              </div>
              <span className="text-meta text-text-muted mt-1 leading-snug">
                Anomaly breakdown evaluated across 500 Fair Price Shops statewide.
              </span>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-border" />
            <button
              onClick={() => navigateTo("/actions")}
              className="w-full text-center py-1.5 text-meta text-accent font-medium hover:underline"
            >
              View Full Action Feed &rarr;
            </button>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Identity Menu (Avatar + Dropdown) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center space-x-2.5 p-1 rounded-md hover:bg-surface border border-transparent hover:border-border transition-colors focus:outline-none"
            >
              <Avatar className="h-8 w-8 rounded-full border border-border">
                <AvatarFallback className="bg-accent text-accent-fg font-semibold text-meta">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col text-left">
                <span className="font-semibold text-text text-meta leading-tight">
                  {user.name}
                </span>
                <span className="text-[11px] text-text-muted leading-tight">
                  <span className="font-medium text-accent">{roleDisplay}</span>
                  <span className="mx-1">&middot;</span>
                  <span>{scopeLabel}</span>
                </span>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 bg-bg border border-border shadow-lg p-2">
            <div className="px-2 py-1.5 border-b border-border mb-1">
              <div className="font-semibold text-body text-text">{user.name}</div>
              <div className="text-[11px] text-text-muted font-mono truncate">{user.email}</div>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wide bg-accent-subtle text-accent px-1.5 py-0.5 rounded">
                  {roleDisplay}
                </span>
                <span className="text-[11px] text-text-muted">&middot;</span>
                <span className="text-[11px] text-text-muted">{scopeLabel}</span>
              </div>
            </div>

            {permissions.includes("cases:view") && (
              <DropdownMenuItem
                onClick={() => navigateTo("/queue")}
                className="cursor-pointer text-meta hover:bg-surface px-2 py-1.5 rounded-sm"
              >
                <span>My Active Queue</span>
              </DropdownMenuItem>
            )}

            {permissions.includes("users:manage") && (
              <DropdownMenuItem
                onClick={() => navigateTo("/admin/map")}
                className="cursor-pointer text-meta hover:bg-surface px-2 py-1.5 rounded-sm font-medium text-accent"
              >
                <MapPin className="w-3.5 h-3.5 mr-2 text-accent" />
                <span>Gujarat State Map</span>
              </DropdownMenuItem>
            )}

            {permissions.includes("users:manage") && (
              <DropdownMenuItem
                onClick={() => navigateTo("/admin/users")}
                className="cursor-pointer text-meta hover:bg-surface px-2 py-1.5 rounded-sm"
              >
                <Settings className="w-3.5 h-3.5 mr-2 text-text-muted" />
                <span>User Management</span>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator className="bg-border" />

            <DropdownMenuItem
              onClick={logout}
              className="cursor-pointer text-meta text-risk-high hover:bg-risk-high-bg px-2 py-1.5 rounded-sm font-semibold flex items-center justify-between"
            >
              <span>Sign out</span>
              <LogOut className="w-3.5 h-3.5 text-risk-high" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Animated Mobile Menu Toggle Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden group p-2 text-text-muted hover:text-text hover:bg-surface border border-border rounded-sm transition-colors focus:outline-none"
          aria-label="Toggle navigation menu"
          aria-expanded={mobileMenuOpen}
        >
          <svg
            className="pointer-events-none"
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M4 12L20 12"
              className={`origin-center -translate-y-[7px] transition-all duration-300 ease-[cubic-bezier(.5,.85,.25,1.1)] ${
                mobileMenuOpen ? "translate-x-0 translate-y-0 rotate-[315deg]" : ""
              }`}
            />
            <path
              d="M4 12H20"
              className={`origin-center transition-all duration-300 ease-[cubic-bezier(.5,.85,.25,1.8)] ${
                mobileMenuOpen ? "rotate-45" : ""
              }`}
            />
            <path
              d="M4 12H20"
              className={`origin-center translate-y-[7px] transition-all duration-300 ease-[cubic-bezier(.5,.85,.25,1.1)] ${
                mobileMenuOpen ? "translate-y-0 rotate-[135deg]" : ""
              }`}
            />
          </svg>
        </button>
      </div>

      {/* 3. Mobile Navigation Drawer (Toggled) */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-x-0 top-[56px] bg-bg border-b border-border px-6 py-4 space-y-4 shadow-xl z-50 animate-in slide-in-from-top-1">
          {/* Officer Identity on Mobile */}
          <div className="pb-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="h-9 w-9 rounded-full border border-border">
                <AvatarFallback className="bg-accent text-accent-fg font-semibold text-meta">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-semibold text-text text-body">{user.name}</span>
                <span className="text-meta text-text-muted">
                  {roleDisplay} &middot; {scopeLabel}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center space-x-1 text-meta text-risk-high hover:underline"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign out</span>
            </button>
          </div>

          {/* Mobile Links List */}
          <div className="flex flex-col space-y-1">
            {primaryLinks.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);

              return (
                <button
                  key={link.href}
                  type="button"
                  onClick={() => navigateTo(link.href)}
                  className={`text-left px-3 py-2 rounded-sm text-meta font-medium transition-colors ${
                    isActive
                      ? "bg-accent-subtle text-accent font-semibold"
                      : "text-text-muted hover:text-text hover:bg-surface"
                  }`}
                >
                  {link.label}
                </button>
              );
            })}

            {adminLinks.length > 0 && (
              <>
                <div className="pt-2 pb-1 text-[11px] font-mono uppercase text-text-muted px-3">
                  Admin Scope
                </div>
                {adminLinks.map((link) => {
                  const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
                  const isMap = link.href === "/admin/map";

                  return (
                    <button
                      key={link.href}
                      type="button"
                      onClick={() => navigateTo(link.href)}
                      className={`text-left px-3 py-2 rounded-sm text-meta font-medium transition-colors flex items-center justify-between ${
                        isActive
                          ? "bg-accent-subtle text-accent font-semibold"
                          : "text-text-muted hover:text-text hover:bg-surface"
                      }`}
                    >
                      <span className="flex items-center space-x-2">
                        {isMap && <MapPin className="w-3.5 h-3.5 text-accent" />}
                        <span>{link.label}</span>
                      </span>
                      {isMap && (
                        <span className="text-[10px] font-bold text-accent bg-accent-subtle px-1.5 py-0.5 rounded">
                          Live
                        </span>
                      )}
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
