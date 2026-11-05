"use client";

import React, { useState } from "react";
import { CaseActionRequest } from "../../lib/api";
import { AssigneeSelect } from "./AssigneeSelect";
import { InlineConfirm } from "./InlineConfirm";

interface CaseActionBarProps {
  allowedActions: string[];
  district?: string;
  taluka?: string;
  onAction: (action: CaseActionRequest) => Promise<void>;
  onTriggerOutcome: () => void;
  loading?: boolean;
}

export function CaseActionBar({
  allowedActions,
  district,
  taluka,
  onAction,
  onTriggerOutcome,
  loading = false,
}: CaseActionBarProps) {
  const [activeForm, setActiveForm] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [reasonText, setReasonText] = useState("");
  const [reassignUserId, setReassignUserId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const resetForms = () => {
    setActiveForm(null);
    setNoteText("");
    setReasonText("");
    setReassignUserId("");
    setError(null);
  };

  const handleStartInspection = async () => {
    await onAction({ type: "start_inspection" });
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) {
      setError("Note content cannot be empty.");
      return;
    }
    await onAction({ type: "add_note", note: noteText.trim() });
    resetForms();
  };

  const handleEscalate = async () => {
    if (!reasonText.trim()) {
      setError("Reason for escalation is required.");
      return;
    }
    await onAction({ type: "escalate", reason: reasonText.trim() });
    resetForms();
  };

  const handleReassign = async () => {
    if (!reassignUserId) {
      setError("Select an officer to reassign the case.");
      return;
    }
    await onAction({
      type: "reassign",
      to_user_id: reassignUserId,
      reason: reasonText.trim() || undefined,
    });
    resetForms();
  };

  const handleClose = async () => {
    if (!reasonText.trim()) {
      setError("Reason for closing case is required.");
      return;
    }
    await onAction({ type: "close", reason: reasonText.trim() });
    resetForms();
  };

  const handleReopen = async () => {
    if (!reasonText.trim()) {
      setError("Reason for reopening case is required.");
      return;
    }
    await onAction({ type: "reopen", reason: reasonText.trim() });
    resetForms();
  };

  return (
    <div className="bg-bg border border-border rounded-md p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-meta font-medium text-text-muted mr-2">Available Actions:</span>

        {allowedActions.includes("start_inspection") && (
          <button
            type="button"
            onClick={handleStartInspection}
            disabled={loading}
            className="px-3 py-1.5 text-meta font-medium bg-accent text-accent-fg rounded-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            Start Inspection
          </button>
        )}

        {allowedActions.includes("record_outcome") && (
          <button
            type="button"
            onClick={onTriggerOutcome}
            disabled={loading}
            className="px-3 py-1.5 text-meta font-medium bg-accent text-accent-fg rounded-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            Record Inspection Outcome
          </button>
        )}

        {allowedActions.includes("add_note") && (
          <button
            type="button"
            onClick={() => setActiveForm(activeForm === "add_note" ? null : "add_note")}
            className={`px-3 py-1.5 text-meta font-medium border border-border rounded-sm transition-colors ${
              activeForm === "add_note" ? "bg-surface border-text" : "hover:bg-surface text-text"
            }`}
          >
            Add Case Note
          </button>
        )}

        {allowedActions.includes("escalate") && (
          <button
            type="button"
            onClick={() => setActiveForm(activeForm === "escalate" ? null : "escalate")}
            className={`px-3 py-1.5 text-meta font-medium border border-border rounded-sm transition-colors ${
              activeForm === "escalate" ? "bg-risk-high-bg border-risk-high text-risk-high" : "hover:bg-surface text-text"
            }`}
          >
            Escalate Case
          </button>
        )}

        {allowedActions.includes("reassign") && (
          <button
            type="button"
            onClick={() => setActiveForm(activeForm === "reassign" ? null : "reassign")}
            className={`px-3 py-1.5 text-meta font-medium border border-border rounded-sm transition-colors ${
              activeForm === "reassign" ? "bg-surface border-text" : "hover:bg-surface text-text"
            }`}
          >
            Reassign
          </button>
        )}

        {allowedActions.includes("close") && (
          <button
            type="button"
            onClick={() => setActiveForm(activeForm === "close" ? null : "close")}
            className={`px-3 py-1.5 text-meta font-medium border border-border rounded-sm transition-colors ${
              activeForm === "close" ? "bg-surface border-text" : "hover:bg-surface text-text"
            }`}
          >
            Close Case
          </button>
        )}

        {allowedActions.includes("reopen") && (
          <button
            type="button"
            onClick={() => setActiveForm(activeForm === "reopen" ? null : "reopen")}
            className={`px-3 py-1.5 text-meta font-medium border border-border rounded-sm transition-colors ${
              activeForm === "reopen" ? "bg-surface border-text" : "hover:bg-surface text-text"
            }`}
          >
            Reopen Case
          </button>
        )}

        {allowedActions.length === 0 && (
          <span className="text-meta text-text-muted italic">No permitted actions on this case.</span>
        )}
      </div>

      {error && (
        <div role="alert" className="mt-3 p-2.5 bg-risk-high-bg border border-risk-high text-risk-high text-meta rounded-sm font-medium">
          {error}
        </div>
      )}

      {/* Inline Forms */}
      {activeForm === "add_note" && (
        <div className="mt-4 pt-3 border-t border-border">
          <label className="block text-meta font-medium text-text mb-1">Add Note (Internal Record)</label>
          <div className="flex gap-2">
            <input
              type="text"
              maxLength={500}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Enter note or status update..."
              className="flex-1 px-3 py-1.5 border border-border rounded-sm text-meta bg-bg text-text focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <button
              type="button"
              onClick={handleAddNote}
              disabled={loading}
              className="px-3 py-1.5 bg-accent text-accent-fg text-meta font-medium rounded-sm hover:opacity-90 disabled:opacity-50"
            >
              Save Note
            </button>
            <button
              type="button"
              onClick={resetForms}
              className="px-3 py-1.5 border border-border text-meta text-text-muted rounded-sm hover:bg-surface"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {activeForm === "escalate" && (
        <div className="mt-4 pt-3 border-t border-border space-y-3">
          <div>
            <label className="block text-meta font-medium text-text mb-1">Reason for Escalation *</label>
            <input
              type="text"
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="State reason for escalating to next administrative level..."
              className="w-full px-3 py-1.5 border border-border rounded-sm text-meta bg-bg text-text focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <InlineConfirm
            message="Confirm escalation to superior authority? Case will be transferred up the chain."
            confirmLabel="Confirm Escalation"
            onConfirm={handleEscalate}
            onCancel={resetForms}
            loading={loading}
          />
        </div>
      )}

      {activeForm === "reassign" && (
        <div className="mt-4 pt-3 border-t border-border space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-meta font-medium text-text mb-1">Assign To Officer *</label>
              <AssigneeSelect
                value={reassignUserId}
                onChange={setReassignUserId}
                district={district}
                taluka={taluka}
              />
            </div>
            <div className="flex-1">
              <label className="block text-meta font-medium text-text mb-1">Reassignment Reason (Optional)</label>
              <input
                type="text"
                value={reasonText}
                onChange={(e) => setReasonText(e.target.value)}
                placeholder="Reason for reassignment..."
                className="w-full px-3 py-1.5 border border-border rounded-sm text-meta bg-bg text-text focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>
          <InlineConfirm
            message="Confirm reassigning case to selected officer?"
            confirmLabel="Confirm Reassignment"
            onConfirm={handleReassign}
            onCancel={resetForms}
            loading={loading}
          />
        </div>
      )}

      {activeForm === "close" && (
        <div className="mt-4 pt-3 border-t border-border space-y-3">
          <div>
            <label className="block text-meta font-medium text-text mb-1">Closure Summary / Justification *</label>
            <input
              type="text"
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="Reason for closing case (e.g. penalty recovered, inspection verified)..."
              className="w-full px-3 py-1.5 border border-border rounded-sm text-meta bg-bg text-text focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <InlineConfirm
            message="Close this inspection case? All findings and actions will remain permanently archived."
            confirmLabel="Close Case"
            onConfirm={handleClose}
            onCancel={resetForms}
            loading={loading}
          />
        </div>
      )}

      {activeForm === "reopen" && (
        <div className="mt-4 pt-3 border-t border-border space-y-3">
          <div>
            <label className="block text-meta font-medium text-text mb-1">Reason for Reopening *</label>
            <input
              type="text"
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="Reason for reopening closed case..."
              className="w-full px-3 py-1.5 border border-border rounded-sm text-meta bg-bg text-text focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <InlineConfirm
            message="Reopen this case and return it to active assigned queue?"
            confirmLabel="Reopen Case"
            onConfirm={handleReopen}
            onCancel={resetForms}
            loading={loading}
          />
        </div>
      )}
    </div>
  );
}
