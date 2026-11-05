"use client";

import React, { useState } from "react";

export interface ChecklistItem {
  action: string;
  why: string;
  fact_id: string;
}

interface ChecklistPanelProps {
  items: ChecklistItem[];
}

export function ChecklistPanel({ items }: ChecklistPanelProps) {
  const [checkedState, setCheckedState] = useState<Record<number, boolean>>({});

  const toggle = (idx: number) => {
    setCheckedState((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="bg-bg border border-border rounded-md p-4">
      <div className="flex items-center justify-between mb-3 border-b border-border pb-2">
        <h3 className="text-section font-semibold text-text">What to check</h3>
        <span className="text-meta text-text-muted">
          {Object.values(checkedState).filter(Boolean).length} / {items.length} verified
        </span>
      </div>
      <div className="space-y-3">
        {items.map((item, idx) => {
          const isDone = Boolean(checkedState[idx]);
          return (
            <label
              key={`${item.fact_id}-${idx}`}
              className={`flex items-start space-x-3 p-3 rounded-sm border cursor-pointer transition-colors ${
                isDone
                  ? "bg-accent-subtle border-accent"
                  : "bg-bg border-border hover:bg-surface"
              }`}
            >
              <input
                type="checkbox"
                checked={isDone}
                onChange={() => toggle(idx)}
                className="mt-1 h-4 w-4 rounded-sm border-border text-accent focus:ring-accent"
              />
              <div className="flex-1">
                <span className={`text-body font-medium ${isDone ? "line-through text-text-muted" : "text-text"}`}>
                  {item.action}
                </span>
                <p className="text-meta text-text-muted mt-0.5">{item.why}</p>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
