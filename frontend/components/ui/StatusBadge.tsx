import React from "react";

export type CaseStatus = "new" | "assigned" | "in_progress" | "inspected" | "escalated" | "closed";

interface StatusBadgeProps {
  status: CaseStatus | string;
  isOverdue?: boolean;
}

export function StatusBadge({ status, isOverdue }: StatusBadgeProps) {
  let label = status;
  let bgClass = "bg-surface text-text-muted border-border";

  switch (status) {
    case "new":
      label = "New";
      bgClass = "bg-surface text-text-muted border-border";
      break;
    case "assigned":
      label = "Assigned";
      bgClass = "bg-surface text-text border-border font-medium";
      break;
    case "in_progress":
      label = "In Progress";
      bgClass = "bg-accent-subtle text-accent border-accent/30 font-medium";
      break;
    case "inspected":
      label = "Inspected";
      bgClass = "bg-accent-subtle text-accent border-accent/30 font-medium";
      break;
    case "escalated":
      label = "Escalated";
      bgClass = "bg-risk-high-bg text-risk-high border-risk-high/30 font-semibold";
      break;
    case "closed":
      label = "Closed";
      bgClass = "bg-surface text-text-muted border-border";
      break;
  }

  return (
    <div className="inline-flex items-center space-x-1.5">
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-sm text-meta border ${bgClass}`}
      >
        {label}
      </span>
      {isOverdue && (
        <span
          className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[11px] font-semibold bg-risk-high-bg text-risk-high border border-risk-high/40"
          title="Case is overdue (no officer action for > 7 days)"
        >
          Overdue
        </span>
      )}
    </div>
  );
}
