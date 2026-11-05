import React from "react";

interface KpiCardProps {
  label: string;
  value: string | number;
  unit?: string;
  context?: string;
}

export function KpiCard({ label, value, unit, context }: KpiCardProps) {
  return (
    <div className="bg-bg border border-border rounded-md p-4 flex flex-col justify-between">
      <span className="text-meta text-text-muted">{label}</span>
      <div className="mt-2 flex items-baseline space-x-1">
        <span className="text-kpi font-semibold text-text tabular-nums">{value}</span>
        {unit && <span className="text-meta text-text-muted font-normal">{unit}</span>}
      </div>
      {context && <span className="text-meta text-text-muted mt-1">{context}</span>}
    </div>
  );
}
