import React from "react";

export function SyntheticBanner() {
  return (
    <div
      role="region"
      aria-label="Demo data notice"
      className="w-full bg-accent-subtle border-b border-border py-1 px-4 text-center text-meta text-accent font-medium"
    >
      Synthetic demo data. No real shops or card holders.
    </div>
  );
}
