import React from "react";

export interface EvidenceItem {
  fact_id: string;
  statement: string;
}

interface EvidenceListProps {
  reason: string;
  evidence: EvidenceItem[];
  source?: "groq" | "template" | string;
}

export function EvidenceList({ reason, evidence, source }: EvidenceListProps) {
  const isAi = source === "groq";

  return (
    <div className="bg-bg border border-border rounded-md p-4">
      <div className="flex items-center justify-between mb-3 border-b border-border pb-2">
        <h3 className="text-section font-semibold text-text">Why this shop was flagged</h3>
        <span className="text-meta px-2 py-0.5 rounded-sm bg-surface border border-border text-text-muted">
          {isAi ? "AI-written" : "Standard text"}
        </span>
      </div>
      <p className="text-body text-text mb-4 leading-relaxed">{reason}</p>
      <div className="space-y-2">
        <h4 className="text-meta font-semibold text-text-muted">Traceable evidence</h4>
        <ul className="space-y-2">
          {evidence.map((ev, idx) => (
            <li
              key={`${ev.fact_id}-${idx}`}
              className="text-body text-text bg-surface border border-border rounded-sm p-2 flex items-start justify-between gap-2"
            >
              <span>{ev.statement}</span>
              <span className="text-meta text-text-muted tabular-nums shrink-0 mt-0.5">
                [{ev.fact_id}]
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-meta text-text-muted mt-3">
        Written from the figures shown. Verify before acting.
      </p>
    </div>
  );
}
