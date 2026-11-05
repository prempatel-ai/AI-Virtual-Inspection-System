"use client";

import React, { useState } from "react";
import { CaseActionRequest } from "../../lib/api";

const DEFAULT_CHECKLIST_ITEMS = [
  "Physical physical stock verification (count vs ePoS ledger)",
  "Inspection of electronic weighing scale calibration seal",
  "Random sample cross-verification of 5 beneficiary OTP/ration slips",
  "Inspection of mandatory public stock board display notice",
];

const ACTION_OPTIONS = [
  { value: "warning_issued", label: "Warning issued to FPS dealer" },
  { value: "stock_verification_ordered", label: "Formal physical stock audit ordered" },
  { value: "referred_to_higher_authority", label: "Referred to District / Vigilance authority" },
  { value: "no_action", label: "No violation found (no action required)" },
  { value: "other", label: "Other enforcement action (specify in note)" },
];

interface OutcomeFormProps {
  onSubmit: (action: CaseActionRequest) => Promise<void>;
  onCancel?: () => void;
  submitting?: boolean;
}

export function OutcomeForm({ onSubmit, onCancel, submitting = false }: OutcomeFormProps) {
  const [outcome, setOutcome] = useState<"confirmed" | "not_confirmed">("confirmed");
  const [actionTaken, setActionTaken] = useState("warning_issued");
  const [note, setNote] = useState("");
  const [checkResults, setCheckResults] = useState<Record<string, "ok" | "issue" | "not_checked">>(
    Object.fromEntries(DEFAULT_CHECKLIST_ITEMS.map((item) => [item, "ok"]))
  );
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (actionTaken === "other" && !note.trim()) {
      setError("Note is required when 'Other action' is selected.");
      return;
    }

    setError(null);
    const checklistPayload = Object.entries(checkResults).map(([item, res]) => ({
      item_action: item,
      result: res,
    }));

    await onSubmit({
      type: "record_outcome",
      outcome,
      action_taken: actionTaken,
      note: note.trim() || undefined,
      checklist_results: checklistPayload,
    });
  };

  return (
    <div className="bg-bg border border-border rounded-md p-5 text-body">
      <h3 className="font-semibold text-text text-body mb-1">Record On-Site Inspection Outcome</h3>
      <p className="text-meta text-text-muted mb-4">
        Record physical findings, completed checklist verification, and resulting enforcement action.
      </p>

      {error && (
        <div role="alert" className="p-3 mb-4 bg-risk-high-bg border border-risk-high text-risk-high text-meta rounded-sm font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Outcome */}
        <div>
          <label className="block text-meta font-medium text-text mb-2">Inspection Finding</label>
          <div className="flex items-center space-x-4">
            <label className="inline-flex items-center space-x-2 text-meta cursor-pointer">
              <input
                type="radio"
                name="outcome"
                value="confirmed"
                checked={outcome === "confirmed"}
                onChange={() => setOutcome("confirmed")}
                className="text-accent focus:ring-accent"
              />
              <span className="font-medium text-risk-high">Discrepancy Confirmed</span>
            </label>
            <label className="inline-flex items-center space-x-2 text-meta cursor-pointer">
              <input
                type="radio"
                name="outcome"
                value="not_confirmed"
                checked={outcome === "not_confirmed"}
                onChange={() => setOutcome("not_confirmed")}
                className="text-accent focus:ring-accent"
              />
              <span className="font-medium text-text">No Discrepancy (Normal Operation)</span>
            </label>
          </div>
        </div>

        {/* Action Taken */}
        <div>
          <label htmlFor="actionTaken" className="block text-meta font-medium text-text mb-1">
            Enforcement Action
          </label>
          <select
            id="actionTaken"
            value={actionTaken}
            onChange={(e) => setActionTaken(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-sm text-meta bg-bg text-text focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Verification Checklist */}
        <div>
          <label className="block text-meta font-medium text-text mb-2">Inspection Checklist</label>
          <div className="space-y-2 border border-border rounded-sm p-3 bg-surface">
            {DEFAULT_CHECKLIST_ITEMS.map((item) => (
              <div key={item} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1 text-meta border-b border-border last:border-b-0">
                <span className="text-text">{item}</span>
                <div className="flex items-center space-x-3 shrink-0">
                  <label className="inline-flex items-center space-x-1 text-meta cursor-pointer">
                    <input
                      type="radio"
                      name={`check-${item}`}
                      value="ok"
                      checked={checkResults[item] === "ok"}
                      onChange={() => setCheckResults((prev) => ({ ...prev, [item]: "ok" }))}
                      className="text-accent"
                    />
                    <span>Satisfactory</span>
                  </label>
                  <label className="inline-flex items-center space-x-1 text-meta cursor-pointer">
                    <input
                      type="radio"
                      name={`check-${item}`}
                      value="issue"
                      checked={checkResults[item] === "issue"}
                      onChange={() => setCheckResults((prev) => ({ ...prev, [item]: "issue" }))}
                      className="text-risk-high"
                    />
                    <span className="text-risk-high">Issue Found</span>
                  </label>
                  <label className="inline-flex items-center space-x-1 text-meta cursor-pointer">
                    <input
                      type="radio"
                      name={`check-${item}`}
                      value="not_checked"
                      checked={checkResults[item] === "not_checked"}
                      onChange={() => setCheckResults((prev) => ({ ...prev, [item]: "not_checked" }))}
                    />
                    <span className="text-text-muted">Not Checked</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Note */}
        <div>
          <label htmlFor="note" className="block text-meta font-medium text-text mb-1">
            Officer Inspection Notes {actionTaken === "other" && <span className="text-risk-high">*</span>}
          </label>
          <textarea
            id="note"
            rows={3}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Record specific inventory measurements, dealer explanations, or evidence..."
            className="w-full px-3 py-2 border border-border rounded-sm text-meta bg-bg text-text focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <div className="text-right text-[11px] text-text-muted mt-0.5">{note.length} / 500</div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="px-3 py-1.5 text-meta text-text-muted hover:text-text border border-border rounded-sm hover:bg-surface transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-1.5 text-meta bg-accent text-accent-fg font-medium rounded-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {submitting ? "Submitting..." : "Submit Inspection Record"}
          </button>
        </div>
      </form>
    </div>
  );
}
