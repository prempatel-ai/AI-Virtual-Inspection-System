/**
 * Formatting utilities for PDS Virtual Inspection System.
 * Enforces en-IN number formatting, readable dates, and standardized units.
 */

export function formatNumber(value: number, decimals: number = 0): string {
  if (isNaN(value)) return "0";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number, decimals: number = 1): string {
  if (isNaN(value)) return "0.0%";
  return `${value.toFixed(decimals)}%`;
}

export function formatKg(value: number, decimals: number = 1): string {
  if (isNaN(value)) return "0.0 kg";
  return `${formatNumber(value, decimals)} kg`;
}

export function formatScore(value: number): string {
  if (isNaN(value)) return "0";
  return value.toFixed(1);
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return `${day} ${MONTH_NAMES[month]} ${year}`;
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    }
  } catch {
    // fallback
  }
  return dateStr;
}

export function formatWeek(weekStr: string): string {
  const formatted = formatDate(weekStr);
  return formatted ? `week of ${formatted}` : "";
}
