import React from "react";

export interface StockReconciliationData {
  opening_kg: number;
  received_kg: number;
  sold_kg: number;
  closing_kg: number;
  gap_kg: number;
  gap_pct: number;
  direction: string;
}

interface ReconcileTableProps {
  data: StockReconciliationData;
}

export function ReconcileTable({ data }: ReconcileTableProps) {
  const isAnomaly = Math.abs(data.gap_pct) > 2.0;

  return (
    <div className="bg-bg border border-border rounded-md p-4">
      <h3 className="text-section font-semibold text-text mb-3 border-b border-border pb-2">
        Stock reconciliation
      </h3>
      <table className="w-full text-body border-collapse">
        <tbody>
          <tr className="border-b border-border">
            <td className="py-2 text-text-muted">Opening balance</td>
            <td className="py-2 text-right tabular-nums text-text">{data.opening_kg.toFixed(1)} kg</td>
          </tr>
          <tr className="border-b border-border">
            <td className="py-2 text-text-muted">Stock received</td>
            <td className="py-2 text-right tabular-nums text-text">+{data.received_kg.toFixed(1)} kg</td>
          </tr>
          <tr className="border-b border-border">
            <td className="py-2 text-text-muted">Stock distributed (sold)</td>
            <td className="py-2 text-right tabular-nums text-text">-{data.sold_kg.toFixed(1)} kg</td>
          </tr>
          <tr className="border-b border-border">
            <td className="py-2 text-text-muted">Closing balance recorded</td>
            <td className="py-2 text-right tabular-nums text-text">{data.closing_kg.toFixed(1)} kg</td>
          </tr>
          <tr className={isAnomaly ? "bg-risk-high-bg font-semibold" : "bg-surface font-medium"}>
            <td className="py-2 px-2 text-text">
              Stock gap ({data.direction})
            </td>
            <td className="py-2 px-2 text-right tabular-nums">
              <span className={isAnomaly ? "text-risk-high" : "text-text"}>
                {data.gap_kg > 0 ? `+${data.gap_kg.toFixed(1)}` : data.gap_kg.toFixed(1)} kg ({data.gap_pct.toFixed(1)}%)
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
