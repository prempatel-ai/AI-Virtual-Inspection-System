import React from "react";

export interface ScoreSignal {
  key: string;
  label: string;
  points: number;
  value: number;
  unit: string;
}

interface ScoreBreakdownProps {
  score: number;
  breakdown: ScoreSignal[];
}

export function ScoreBreakdown({ score, breakdown }: ScoreBreakdownProps) {
  const sorted = [...breakdown].sort((a, b) => b.points - a.points);
  const maxPossible = 100;

  return (
    <div className="bg-bg border border-border rounded-md p-4">
      <div className="flex items-baseline justify-between mb-3 border-b border-border pb-2">
        <h3 className="text-section font-semibold text-text">Score breakdown</h3>
        <span className="text-body font-semibold text-text tabular-nums">
          {score.toFixed(1)} / 100
        </span>
      </div>
      <div className="space-y-3">
        {sorted.map((sig) => {
          const widthPct = Math.min(Math.max((sig.points / maxPossible) * 100, 0), 100);
          return (
            <div key={sig.key} className="space-y-1">
              <div className="flex items-center justify-between text-meta">
                <span className="text-text font-medium">{sig.label}</span>
                <div className="flex items-center space-x-2">
                  <span className="text-text-muted tabular-nums">
                    {sig.value.toFixed(1)} {sig.unit}
                  </span>
                  <span className="font-semibold text-text tabular-nums">
                    +{sig.points.toFixed(1)} pts
                  </span>
                </div>
              </div>
              <div className="h-2 w-full bg-surface border border-border rounded-sm overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-150"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
