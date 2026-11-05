"use client";

import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

export interface TrendDataPoint {
  week: string;
  shopValue: number;
  peerMedian: number;
}

interface TrendChartProps {
  title: string;
  unit: string;
  data: TrendDataPoint[];
}

export function TrendChart({ title, unit, data }: TrendChartProps) {
  return (
    <div className="bg-bg border border-border rounded-md p-4">
      <div className="flex items-center justify-between mb-3 border-b border-border pb-2">
        <h3 className="text-section font-semibold text-text">{title}</h3>
        <span className="text-meta text-text-muted">Unit: {unit}</span>
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="week"
              tickLine={false}
              axisLine={{ stroke: "var(--color-border)" }}
              tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={{ stroke: "var(--color-border)" }}
              tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-bg)",
                borderColor: "var(--color-border)",
                borderRadius: "var(--radius-sm)",
                fontSize: "12px",
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
            />
            <Line
              type="monotone"
              dataKey="shopValue"
              name="Shop"
              stroke="var(--color-accent)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--color-accent)" }}
            />
            <Line
              type="monotone"
              dataKey="peerMedian"
              name="Peer median"
              stroke="var(--color-text-muted)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
