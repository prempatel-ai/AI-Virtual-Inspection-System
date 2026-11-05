import React from "react";

interface InlineConfirmProps {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function InlineConfirm({
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  loading = false,
}: InlineConfirmProps) {
  return (
    <div
      role="alert"
      className="p-3 bg-surface border border-border rounded-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-meta"
    >
      <span className="font-medium text-text">{message}</span>
      <div className="flex items-center space-x-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-2.5 py-1 text-meta text-text-muted hover:text-text border border-border rounded-sm hover:bg-bg transition-colors"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className="px-3 py-1 text-meta bg-accent text-accent-fg font-medium rounded-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? "Processing..." : confirmLabel}
        </button>
      </div>
    </div>
  );
}
