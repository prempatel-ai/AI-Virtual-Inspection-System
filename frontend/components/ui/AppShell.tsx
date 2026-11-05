import React from "react";

interface AppShellProps {
  children: React.ReactNode;
  headerRight?: React.ReactNode;
}

export function AppShell({ children, headerRight }: AppShellProps) {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="w-full bg-bg border-b border-border">
        <div className="max-w-container mx-auto px-6 h-12 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="font-semibold text-body text-text tracking-tight">
              PDS Virtual Inspection System
            </span>
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
