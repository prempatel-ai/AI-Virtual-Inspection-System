import React from "react";

export interface FilterOption {
  label: string;
  value: string;
}

interface FilterBarProps {
  districts: FilterOption[];
  talukas: FilterOption[];
  selectedDistrict: string;
  selectedTaluka: string;
  selectedBand: string;
  onDistrictChange: (district: string) => void;
  onTalukaChange: (taluka: string) => void;
  onBandChange: (band: string) => void;
  onClear: () => void;
  rightAction?: React.ReactNode;
}

export function FilterBar({
  districts,
  talukas,
  selectedDistrict,
  selectedTaluka,
  selectedBand,
  onDistrictChange,
  onTalukaChange,
  onBandChange,
  onClear,
  rightAction,
}: FilterBarProps) {
  const hasFilters = Boolean(selectedDistrict || selectedTaluka || selectedBand);

  return (
    <div className="bg-bg border border-border rounded-md p-3 mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center space-x-2 text-meta text-text-muted">
          <span>District</span>
          <select
            value={selectedDistrict}
            onChange={(e) => onDistrictChange(e.target.value)}
            className="bg-bg border border-border rounded-sm px-2 py-1 text-body text-text"
          >
            <option value="">All districts</option>
            {districts.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center space-x-2 text-meta text-text-muted">
          <span>Taluka</span>
          <select
            value={selectedTaluka}
            onChange={(e) => onTalukaChange(e.target.value)}
            className="bg-bg border border-border rounded-sm px-2 py-1 text-body text-text"
          >
            <option value="">All talukas</option>
            {talukas.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center space-x-2 text-meta text-text-muted">
          <span>Band</span>
          <select
            value={selectedBand}
            onChange={(e) => onBandChange(e.target.value)}
            className="bg-bg border border-border rounded-sm px-2 py-1 text-body text-text"
          >
            <option value="">All bands</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>

        {hasFilters && (
          <button
            type="button"
            onClick={onClear}
            className="text-meta text-accent hover:underline font-medium ml-1"
          >
            Clear filters
          </button>
        )}
      </div>

      {rightAction && <div>{rightAction}</div>}
    </div>
  );
}
