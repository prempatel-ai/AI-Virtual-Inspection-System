"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";

export default function RoleLandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace("/login");
      } else if (user.role === "inspector") {
        router.replace("/queue");
      } else {
        router.replace("/overview");
      }
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full mb-3" />
        <p className="text-meta text-text-muted">Loading PDS Inspection System...</p>
      </div>
    </div>
  );
}
