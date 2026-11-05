import React from "react";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message = "Could not load data. Check that the API server is running, then retry.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="bg-risk-high-bg border border-border rounded-md p-6 text-center">
      <p className="text-body text-risk-high font-medium">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 px-3 py-1.5 bg-accent text-accent-fg rounded-sm text-body font-medium hover:opacity-90"
        >
          Retry
        </button>
      )}
    </div>
  );
}
