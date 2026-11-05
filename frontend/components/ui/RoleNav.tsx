"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth";

export function RoleNav() {
  const { user, permissions, scope, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (!user) return null;

  const links: { label: string; href: string }[] = [];

  // Role landing & overview
  if (user.role !== "inspector") {
    links.push({ label: "Overview", href: "/overview" });
  }

  if (permissions.includes("cases:view")) {
    links.push({ label: "My Queue", href: "/queue" });
  }

  if (permissions.includes("flags:view")) {
    links.push({ label: "Flags", href: "/flags" });
  }

  if (permissions.includes("areas:view")) {
    links.push({ label: "Areas", href: "/areas" });
  }

  if (permissions.includes("officers:view") && user.role !== "inspector") {
    links.push({ label: "Officers", href: "/officers" });
  }

  if (permissions.includes("actions:view")) {
    links.push({ label: "Actions", href: "/actions" });
  }

  if (permissions.includes("users:manage")) {
    links.push({ label: "Users", href: "/admin/users" });
  }

  if (permissions.includes("audit:view")) {
    links.push({ label: "Audit Log", href: "/admin/audit" });
  }

  // Format scope text
  let scopeLabel = "State Jurisdiction";
  if (scope?.taluka) {
    scopeLabel = `${scope.district} • ${scope.taluka}`;
  } else if (scope?.district) {
    scopeLabel = `${scope.district} District`;
  }

  return (
    <div className="flex items-center justify-between w-full">
      <nav className="flex items-center space-x-1" aria-label="Main Navigation">
        {links.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <button
              key={link.href}
              onClick={() => router.push(link.href)}
              className={`px-3 py-1.5 text-meta font-medium rounded-sm transition-colors ${
                isActive
                  ? "bg-accent-subtle text-accent font-semibold"
                  : "text-text-muted hover:text-text hover:bg-surface"
              }`}
            >
              {link.label}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center space-x-3 text-meta">
        <div className="text-right hidden sm:block">
          <div className="font-semibold text-text leading-tight">{user.name}</div>
          <div className="text-text-muted text-[11px] leading-tight flex items-center justify-end space-x-1">
            <span className="capitalize">{user.role.replace("_", " ")}</span>
            <span>•</span>
            <span>{scopeLabel}</span>
          </div>
        </div>
        <button
          onClick={logout}
          className="px-2.5 py-1 text-meta text-text-muted hover:text-text border border-border rounded-sm hover:bg-surface transition-colors"
          title="Sign out of system"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
