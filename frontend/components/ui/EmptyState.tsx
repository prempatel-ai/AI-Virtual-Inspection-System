import React from "react";

interface EmptyStateProps {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title = "No shops match these filters.",
  message,
  actionLabel = "Clear filters",
  onAction,
}: EmptyStateProps) {
  return (
    <div className="bg-bg border border-border rounded-md p-8 text-center flex flex-col items-center justify-center">
      <h3 className="text-section font-semibold text-text">{title}</h3>
      {message && <p className="text-body text-text-muted mt-2 max-w-md">{message}</p>}
      {onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 px-3 py-1.5 bg-accent text-accent-fg rounded-sm text-body font-medium hover:opacity-90"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
