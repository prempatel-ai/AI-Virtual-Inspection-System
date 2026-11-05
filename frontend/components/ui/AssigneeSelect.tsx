"use client";

import React, { useEffect, useState } from "react";
import { getOfficers, OfficerListItem } from "../../lib/api";

interface AssigneeSelectProps {
  value: string;
  onChange: (userId: string) => void;
  district?: string;
  taluka?: string;
}

export function AssigneeSelect({ value, onChange, district, taluka }: AssigneeSelectProps) {
  const [officers, setOfficers] = useState<OfficerListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getOfficers({ district, taluka, active: true })
      .then((res) => {
        if (mounted) {
          setOfficers(res.items);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [district, taluka]);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={loading}
      className="px-3 py-1.5 border border-border rounded-sm text-meta bg-bg text-text focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
    >
      <option value="">Select officer...</option>
      {officers.map((off) => (
        <option key={off.user_id} value={off.user_id}>
          {off.name} ({off.role.replace("_", " ")})
        </option>
      ))}
    </select>
  );
}
