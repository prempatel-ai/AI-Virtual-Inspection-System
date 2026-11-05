import React from "react";

export type RiskLevel = "high" | "medium" | "low" | string;

interface RiskBadgeProps {
  level: RiskLevel;
}

export function RiskBadge({ level }: RiskBadgeProps) {
  const norm = level.toLowerCase();
  let colorClasses = "bg-risk-low-bg text-risk-low";
  let label = "Low";

  if (norm === "high") {
    colorClasses = "bg-risk-high-bg text-risk-high";
    label = "High";
  } else if (norm === "medium") {
    colorClasses = "bg-risk-medium-bg text-risk-medium";
    label = "Medium";
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-sm text-meta font-medium ${colorClasses}`}
    >
      {label}
    </span>
  );
}
