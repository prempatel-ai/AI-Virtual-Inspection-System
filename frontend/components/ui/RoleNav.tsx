"use client";

import React, { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth";
import { LogOut, Menu, X } from "lucide-react";

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

  const navigateTo = (href: string) => {
    setMobileMenuOpen(false);
    router.push(href);
  };

  return (
    <div className="w-full flex items-center justify-between">
      {/* 1. Center-Left: Clean Typographic Nav Tabs (Desktop) */}
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
              className={`whitespace-nowrap py-4 text-meta transition-colors relative focus:outline-none ${
                isActive
                  ? "text-accent font-semibold"
                  : "text-text-muted hover:text-text font-medium"
              }`}
            >
              <span>{link.label}</span>
              {isActive && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}

        {/* Subtle hairline divider before Admin links */}
        {adminLinks.length > 0 && (
          <div className="flex items-center space-x-6 pl-2 border-l border-border">
            {adminLinks.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);

              return (
                <button
                  key={link.href}
                  type="button"
                  onClick={() => navigateTo(link.href)}
                  className={`whitespace-nowrap py-4 text-meta transition-colors relative focus:outline-none ${
                    isActive
                      ? "text-accent font-semibold"
                      : "text-text-muted hover:text-text font-medium"
                  }`}
                >
                  <span>{link.label}</span>
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </nav>

      {/* 2. Right: Header Extras & Officer Profile */}
      <div className="flex items-center space-x-4 shrink-0">
        {headerRight && (
          <div className="hidden sm:flex items-center">
            {headerRight}
          </div>
        )}

        {/* Officer Identity */}
        <div className="hidden md:flex items-center space-x-3 text-left">
          <div className="flex flex-col">
            <span className="font-medium text-text text-meta leading-tight">
              {user.name}
            </span>
            <span className="text-[11px] text-text-muted leading-tight">
              <span className="font-medium">{roleDisplay}</span>
              <span className="mx-1">·</span>
              <span>{scopeLabel}</span>
            </span>
          </div>

          <div className="h-4 w-px bg-border" aria-hidden="true" />

          {/* Sign Out Action */}
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center space-x-1 text-meta text-text-muted hover:text-risk-high transition-colors focus:outline-none"
            title="Sign out of inspection portal"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>

        {/* Mobile Menu Toggle Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-1.5 text-text-muted hover:text-text hover:bg-surface border border-border rounded-sm transition-colors focus:outline-none"
          aria-label="Toggle navigation menu"
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* 3. Mobile Navigation Drawer (Toggled) */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-x-0 top-[calc(theme(spacing.14)+28px)] bg-bg border-b border-border px-6 py-4 space-y-4 shadow-lg z-50 animate-in slide-in-from-top-1">
          {/* Officer Identity on Mobile */}
          <div className="pb-3 border-b border-border flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-semibold text-text text-body">{user.name}</span>
              <span className="text-meta text-text-muted">
                {roleDisplay} · {scopeLabel}
              </span>
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
                  Admin
                </div>
                {adminLinks.map((link) => {
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
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
