import React from "react";
import Link from "next/link";
import { RoleNav } from "./RoleNav";
import { SyntheticBanner } from "./SyntheticBanner";

interface AppShellProps {
  children: React.ReactNode;
  headerRight?: React.ReactNode;
}

export function AppShell({ children, headerRight }: AppShellProps) {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <SyntheticBanner />
      <header className="w-full bg-bg border-b border-border sticky top-0 z-30">
        <div className="max-w-container mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-6">
          {/* Brand Identity */}
          <div className="flex items-center space-x-2.5 shrink-0">
            <Link
              href="/"
              className="flex items-center space-x-2.5 text-left group focus:outline-none"
              title="PDS Virtual Inspection System"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-accent shrink-0" aria-hidden="true" />
              <span className="font-semibold text-text text-body tracking-tight whitespace-nowrap group-hover:text-accent transition-colors">
                PDS Virtual Inspection System
              </span>
            </Link>
          </div>

          {/* Navigation Tabs & Officer Profile */}
          <div className="flex-1 flex items-center justify-end min-w-0">
            <RoleNav headerRight={headerRight} />
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-container w-full mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>
    </div>
  );
}
