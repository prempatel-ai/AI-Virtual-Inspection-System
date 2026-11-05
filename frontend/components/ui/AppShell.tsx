import React from "react";
import { RoleNav } from "./RoleNav";

interface AppShellProps {
  children: React.ReactNode;
  headerRight?: React.ReactNode;
}

export function AppShell({ children, headerRight }: AppShellProps) {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="w-full bg-bg border-b border-border">
        <div className="max-w-container mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <span className="font-semibold text-body text-text tracking-tight whitespace-nowrap">
              PDS Virtual Inspection System
            </span>
          </div>
          <div className="flex-1 max-w-3xl mx-6 hidden md:block">
            <RoleNav />
          </div>
          {headerRight && <div className="flex items-center space-x-4">{headerRight}</div>}
        </div>
      </header>
      <main className="flex-1 max-w-container w-full mx-auto px-6 py-6">
        {children}
      </main>
    </div>
  );
}
