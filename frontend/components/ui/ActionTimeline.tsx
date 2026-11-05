import React from "react";
import { CaseActionItem } from "../../lib/api";
import { formatDate } from "../../lib/format";

interface ActionTimelineProps {
  actions: CaseActionItem[];
}

export function ActionTimeline({ actions }: ActionTimelineProps) {
  if (!actions || actions.length === 0) {
    return (
      <div className="p-4 text-center text-meta text-text-muted bg-surface border border-border rounded-sm">
        No case actions recorded yet.
      </div>
    );
  }

  const getActionTitle = (action: CaseActionItem) => {
    switch (action.type) {
      case "create":
        return "Case opened";
      case "assign":
        return `Assigned to ${action.payload?.to_user_id || "officer"}`;
      case "start_inspection":
        return "Inspection started";
      case "record_outcome":
        return `Inspection outcome: ${action.payload?.outcome === "confirmed" ? "Discrepancy confirmed" : "Normal operation"}`;
      case "add_note":
        return "Note added";
      case "escalate":
        return `Escalated to ${action.payload?.escalated_to || "higher authority"}`;
      case "reassign":
        return `Reassigned to ${action.payload?.to_user_id || "officer"}`;
      case "close":
        return "Case closed";
      case "reopen":
        return "Case reopened";
      default:
        return action.type;
    }
  };

  return (
    <div className="flow-root">
      <ul role="list" className="-mb-6">
        {actions.map((act, actIdx) => {
          const payload = (act.payload || {}) as Record<string, unknown>;
          const checklist = Array.isArray(payload.checklist_results)
            ? (payload.checklist_results as Array<{ item_action?: string; result?: string }>)
            : [];
          return (
            <li key={act.id}>
              <div className="relative pb-6">
                {actIdx !== actions.length - 1 ? (
                  <span
                    className="absolute top-4 left-3 -ml-px h-full w-0.5 bg-border"
                    aria-hidden="true"
                  />
                ) : null}
                <div className="relative flex items-start space-x-3">
                  <div className="relative">
                    <div className="h-6 w-6 rounded-full bg-accent-subtle border border-accent/40 flex items-center justify-center ring-4 ring-bg">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 bg-surface border border-border rounded-sm p-3">
                    <div className="flex items-center justify-between text-meta">
                      <span className="font-semibold text-text">{getActionTitle(act)}</span>
                      <span className="text-[11px] text-text-muted">{formatDate(act.created_at)}</span>
                    </div>

                    <div className="text-[11px] text-text-muted mt-0.5 flex items-center space-x-2">
                      <span>By: {act.actor_name || act.actor_role}</span>
                      <span>•</span>
                      <span className="capitalize">{act.actor_role}</span>
                      {act.risk_score_at_action !== null && act.risk_score_at_action !== undefined && (
                        <>
                          <span>•</span>
                          <span>Risk score: {act.risk_score_at_action.toFixed(1)}</span>
                        </>
                      )}
                    </div>

                    {/* Payload Details */}
                    {payload && Object.keys(payload).length > 0 && (
                      <div className="mt-2 text-meta text-text bg-bg border border-border/60 rounded p-2 text-xs space-y-1">
                        {payload.reason && (
                          <div>
                            <span className="font-medium text-text-muted">Reason: </span>
                            <span>{String(payload.reason)}</span>
                          </div>
                        )}
                        {payload.note && (
                          <div>
                            <span className="font-medium text-text-muted">Note: </span>
                            <span>{String(payload.note)}</span>
                          </div>
                        )}
                        {payload.action_taken && (
                          <div>
                            <span className="font-medium text-text-muted">Action taken: </span>
                            <span className="capitalize">{String(payload.action_taken).replace(/_/g, " ")}</span>
                          </div>
                        )}
                        {checklist.length > 0 && (
                          <div className="pt-1 mt-1 border-t border-border/40">
                            <span className="font-medium text-text-muted block mb-0.5">Checklist:</span>
                            <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                              {checklist.map((cr, i) => (
                                <li key={i}>
                                  {cr.item_action}: <strong className="capitalize">{cr.result}</strong>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
