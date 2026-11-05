import React from "react";

interface PermissionListProps {
  permissions: string[];
  role: string;
  district?: string | null;
  taluka?: string | null;
}

export function PermissionList({ permissions, role, district, taluka }: PermissionListProps) {
  let jurisdictionText = "State-wide (All districts & talukas)";
  if (taluka) {
    jurisdictionText = `${district} District • ${taluka} Taluka`;
  } else if (district) {
    jurisdictionText = `${district} District (All talukas)`;
  }

  return (
    <div className="bg-bg border border-border rounded-md p-5 text-meta">
      <h3 className="font-semibold text-text text-body mb-3">Access Rights & Security Scope</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 pb-4 border-b border-border">
        <div>
          <span className="text-text-muted block text-[11px] font-medium">Assigned Role</span>
          <span className="font-semibold text-text capitalize">{role.replace("_", " ")}</span>
        </div>
        <div>
          <span className="text-text-muted block text-[11px] font-medium">Enforced Geographic Scope</span>
          <span className="font-medium text-text">{jurisdictionText}</span>
        </div>
      </div>

      <div>
        <span className="text-text-muted block text-[11px] font-medium mb-2">Granted API Capabilities ({permissions.length})</span>
        <div className="flex flex-wrap gap-1.5">
          {permissions.map((perm) => (
            <span
              key={perm}
              className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-surface border border-border text-text"
            >
              {perm}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
