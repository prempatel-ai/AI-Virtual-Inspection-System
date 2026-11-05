"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getMe, login as apiLogin, logout as apiLogout, UserSummary, ScopeInfo, LoginRequest } from "./api";

interface AuthContextType {
  user: UserSummary | null;
  permissions: string[];
  scope: ScopeInfo | null;
  loading: boolean;
  login: (data: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (perm: string) => boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSummary | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [scope, setScope] = useState<ScopeInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    try {
      const data = await getMe();
      setUser(data.user);
      setPermissions(data.permissions);
      setScope(data.scope);
    } catch {
      setUser(null);
      setPermissions([]);
      setScope(null);
      if (pathname !== "/login") {
        router.push("/login");
      }
    } finally {
      setLoading(false);
    }
  }, [pathname, router]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (data: LoginRequest) => {
    setLoading(true);
    try {
      const res = await apiLogin(data);
      setUser(res.user);
      setPermissions(res.permissions);
      setScope(res.scope);

      // Redirect to landing
      if (res.user.role === "inspector") {
        router.push("/queue");
      } else {
        router.push("/overview");
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiLogout();
    } finally {
      setUser(null);
      setPermissions([]);
      setScope(null);
      router.push("/login");
    }
  };

  const hasPermission = (perm: string) => permissions.includes(perm);

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        scope,
        loading,
        login,
        logout,
        hasPermission,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      user: null,
      permissions: [],
      scope: null,
      loading: false,
      login: async () => {},
      logout: async () => {},
      hasPermission: () => false,
      refresh: async () => {},
    };
  }
  return context;
}
