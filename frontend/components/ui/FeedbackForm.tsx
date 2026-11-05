"use client";

import React, { useState } from "react";

export type OutcomeType = "confirmed" | "not_confirmed";

interface FeedbackFormProps {
  shopId: string;
  initialOutcome?: OutcomeType;
  initialNotes?: string;
  onSubmit: (outcome: OutcomeType, notes: string) => Promise<void> | void;
}

export function FeedbackForm({
  shopId,
  initialOutcome = "confirmed",
  initialNotes = "",
  onSubmit,
}: FeedbackFormProps) {
  const [outcome, setOutcome] = useState<OutcomeType>(initialOutcome);
  const [notes, setNotes] = useState(initialNotes);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMsg("");
    try {
      await onSubmit(outcome, notes);
      setSuccessMsg("Outcome saved successfully.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-bg border border-border rounded-md p-4">
      <h3 className="text-section font-semibold text-text mb-3 border-b border-border pb-2">
        Record visit outcome
      </h3>
      <div className="space-y-4">
        <div>
          <label htmlFor={`outcome-${shopId}`} className="block text-meta text-text-muted mb-1">
            Inspection outcome
          </label>
          <select
            id={`outcome-${shopId}`}
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as OutcomeType)}
            className="w-full bg-bg border border-border rounded-sm p-2 text-body text-text"
          >
            <option value="confirmed">Confirmed irregularity</option>
            <option value="not_confirmed">Not confirmed (false alarm)</option>
          </select>
        </div>

        <div>
          <label htmlFor={`notes-${shopId}`} className="block text-meta text-text-muted mb-1">
            Inspector observations
          </label>
          <textarea
            id={`notes-${shopId}`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Add relevant godown, register, or cardholder observations..."
            className="w-full bg-bg border border-border rounded-sm p-2 text-body text-text"
          />
        </div>

        {successMsg && (
          <p className="text-meta text-accent font-medium">{successMsg}</p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-accent text-accent-fg rounded-sm text-body font-medium hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "Save outcome"}
          </button>
        </div>
      </div>
    </form>
  );
}
