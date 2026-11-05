"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../components/ui";

export default function UnauthorizedPage() {
  const router = useRouter();

  return (
    <AppShell>
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-6">
        <h1 className="text-title font-bold text-text mb-2">Access Restricted</h1>
        <p className="text-body text-text-muted max-w-md mb-6">
          You do not have permission to view this resource. Contact your system supervisor or administrator for access.
        </p>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 bg-accent text-accent-fg rounded-sm font-medium hover:opacity-90 transition-opacity"
        >
          Return to Dashboard
        </button>
      </div>
    </AppShell>
  );
}
