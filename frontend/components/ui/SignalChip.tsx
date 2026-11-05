import React from "react";

interface SignalChipProps {
  label: string;
  points?: number;
  value?: string | number;
}

export function SignalChip({ label, points, value }: SignalChipProps) {
  return (
    <span className="inline-flex items-center space-x-1 bg-surface border border-border px-2 py-0.5 rounded-sm text-meta text-text">
      <span>{label}</span>
      {points !== undefined && (
        <span className="text-text-muted tabular-nums">({points.toFixed(1)} pts)</span>
      )}
      {value !== undefined && points === undefined && (
        <span className="text-text-muted tabular-nums">({value})</span>
      )}
    </span>
  );
}
