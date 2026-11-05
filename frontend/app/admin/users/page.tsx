"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { AppShell } from "../../../components/ui/AppShell";
import { DataTable, Column } from "../../../components/ui/DataTable";
import { InlineConfirm } from "../../../components/ui/InlineConfirm";
import { ErrorState } from "../../../components/ui/ErrorState";
import { EmptyState } from "../../../components/ui/EmptyState";
import {
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
  resetAdminUserPassword,
  getMeta,
  AdminUserItem,
  CreateUserRequest,
} from "../../../lib/api";
import { formatDate } from "../../../lib/format";
import { useAuth } from "../../../lib/auth";

export default function AdminUsersPage() {
  const { hasPermission } = useAuth();

  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Confirmation state
  const [activeConfirm, setActiveConfirm] = useState<{
    userId: string;
    type: "toggle" | "reset";
  } | null>(null);

  // Success notifications (e.g. temporary password display)
  const [passwordNotice, setPasswordNotice] = useState<{
    email: string;
    tempPass: string;
  } | null>(null);

  // Create User Drawer / Form
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
  const [createName, setCreateName] = useState<string>("");
  const [createEmail, setCreateEmail] = useState<string>("");
  const [createRole, setCreateRole] = useState<string>("inspector");
  const [createDistrict, setCreateDistrict] = useState<string>("");
  const [createTaluka, setCreateTaluka] = useState<string>("");
  const [createSubmitting, setCreateSubmitting] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Metadata for dropdowns
  const [districts, setDistricts] = useState<string[]>([]);
  const [talukasByDistrict, setTalukasByDistrict] = useState<Record<string, string[]>>({});

  // Filters
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    getMeta()
      .then((meta) => {
        if (meta.districts) setDistricts(meta.districts);
        if (meta.talukas) setTalukasByDistrict(meta.talukas);
      })
      .catch(() => {});
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminUsers();
      setUsers(res.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load system users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim() || !createEmail.trim()) {
      setCreateError("Name and Email are required.");
      return;
    }
    setCreateSubmitting(true);
    setCreateError(null);
    try {
      const payload: CreateUserRequest = {
        name: createName.trim(),
        email: createEmail.trim(),
        role: createRole,
        district: createDistrict || undefined,
        taluka: createTaluka || undefined,
      };
      const res = await createAdminUser(payload);
      setPasswordNotice({
        email: res.user.email,
        tempPass: res.temporary_password,
      });
      setShowCreateForm(false);
      setCreateName("");
      setCreateEmail("");
      setCreateDistrict("");
      setCreateTaluka("");
      await fetchUsers();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleToggleActive = async (user: AdminUserItem) => {
    try {
      await updateAdminUser(user.user_id, { is_active: !user.is_active });
      await fetchUsers();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update user status");
    }
  };

  const handleResetPassword = async (user: AdminUserItem) => {
    try {
      const res = await resetAdminUserPassword(user.user_id);
      setPasswordNotice({
        email: user.email,
        tempPass: res.temporary_password,
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to reset password");
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      if (!matchesRole) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.user_id.toLowerCase().includes(q) ||
        (u.district && u.district.toLowerCase().includes(q)) ||
        (u.taluka && u.taluka.toLowerCase().includes(q))
      );
    });
  }, [users, roleFilter, searchQuery]);

  const columns: Column<AdminUserItem>[] = [
    {
      key: "user",
      header: "Officer / Account",
      render: (u) => (
        <div>
          <div className="font-medium text-text text-body">{u.name}</div>
          <div className="text-meta text-text-muted font-mono text-[11px]">{u.user_id}</div>
        </div>
      ),
    },
    {
      key: "email",
      header: "Email",
      render: (u) => (
        <span className="font-mono text-meta text-text">{u.email}</span>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (u) => (
        <span className="capitalize text-meta font-medium px-2 py-0.5 rounded bg-surface border border-border text-text">
          {u.role.replace("_", " ")}
        </span>
      ),
    },
    {
      key: "scope",
      header: "Assigned Scope",
      render: (u) => (
        <div className="text-meta text-text">
          {u.taluka ? `${u.district} • ${u.taluka}` : u.district ? `${u.district} District` : "State Jurisdiction"}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (u) => (
        <span
          className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
            u.is_active ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"
          }`}
        >
          {u.is_active ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "last_login",
      header: "Last Sign-in",
      render: (u) => (
        <span className="text-meta text-text-muted font-mono">
          {u.last_login_at ? formatDate(u.last_login_at) : "Never"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Administrative Actions",
      render: (u) => {
        const isConfirming = activeConfirm?.userId === u.user_id;

        if (isConfirming) {
          const isToggle = activeConfirm.type === "toggle";
          return (
            <InlineConfirm
              message={
                isToggle
                  ? `Set ${u.name}'s status to ${u.is_active ? "inactive" : "active"}?`
                  : `Reset password for ${u.name}?`
              }
              confirmLabel={isToggle ? "Confirm Status" : "Confirm Reset"}
              onConfirm={async () => {
                if (isToggle) await handleToggleActive(u);
                else await handleResetPassword(u);
                setActiveConfirm(null);
              }}
              onCancel={() => setActiveConfirm(null)}
            />
          );
        }

        return (
          <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setActiveConfirm({ userId: u.user_id, type: "toggle" })}
              className="text-[11px] px-2 py-0.5 rounded border border-border text-text hover:bg-surface font-medium"
            >
              {u.is_active ? "Deactivate" : "Activate"}
            </button>
            <button
              type="button"
              onClick={() => setActiveConfirm({ userId: u.user_id, type: "reset" })}
              className="text-[11px] px-2 py-0.5 rounded border border-border text-text hover:bg-surface font-medium"
            >
              Reset Password
            </button>
          </div>
        );
      },
    },
  ];

  if (!hasPermission("users:manage")) {
    return (
      <AppShell>
        <ErrorState message="You do not have administrative permission to manage users." />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-title font-semibold text-text tracking-tight">
              User Management & Access Control
            </h1>
            <p className="text-meta text-text-muted mt-1">
              Provision administrative and field officer accounts, configure jurisdictions, and manage credentials.
            </p>
          </div>

          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-3 py-1.5 bg-accent text-accent-fg rounded-sm text-meta font-medium hover:opacity-90 transition-opacity"
          >
            {showCreateForm ? "Cancel Provisioning" : "+ Provision New User"}
          </button>
        </div>

        {/* Temporary Password Notice */}
        {passwordNotice && (
          <div className="p-4 bg-amber-50 border border-amber-300 rounded-md text-meta text-amber-900 flex items-start justify-between">
            <div>
              <div className="font-semibold text-body">New User Credentials Generated</div>
              <p className="mt-1">
                Account: <strong className="font-mono">{passwordNotice.email}</strong>
              </p>
              <p className="mt-1">
                Temporary Password:{" "}
                <span className="font-mono font-bold bg-amber-100 px-2 py-0.5 rounded border border-amber-300 text-text">
                  {passwordNotice.tempPass}
                </span>
              </p>
              <p className="text-text-muted text-[11px] mt-1.5">
                Copy and securely deliver this temporary password to the officer. It will not be shown again.
              </p>
            </div>
            <button
              onClick={() => setPasswordNotice(null)}
              className="text-amber-900 font-bold ml-4 text-body hover:opacity-75"
            >
              &times;
            </button>
          </div>
        )}

        {/* Provision User Form */}
        {showCreateForm && (
          <div className="bg-surface border-2 border-accent/40 rounded-md p-5 shadow-sm space-y-4">
            <h2 className="text-section font-semibold text-text border-b border-border pb-2">
              Provision New Officer Account
            </h2>

            {createError && (
              <div className="p-2.5 bg-risk-high-bg text-risk-high text-meta rounded font-medium">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="create-user-name" className="block text-meta font-medium text-text mb-1">
                    Full Name *
                  </label>
                  <input
                    id="create-user-name"
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    className="w-full text-meta border border-border rounded px-3 py-1.5 bg-background text-text focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                <div>
                  <label htmlFor="create-user-email" className="block text-meta font-medium text-text mb-1">
                    Email Address *
                  </label>
                  <input
                    id="create-user-email"
                    type="email"
                    required
                    placeholder="officer.name@pds.gujarat.gov.in"
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    className="w-full text-meta border border-border rounded px-3 py-1.5 bg-background text-text focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                <div>
                  <label htmlFor="create-user-role" className="block text-meta font-medium text-text mb-1">
                    System Role *
                  </label>
                  <select
                    id="create-user-role"
                    value={createRole}
                    onChange={(e) => setCreateRole(e.target.value)}
                    className="w-full text-meta border border-border rounded px-2.5 py-1.5 bg-background text-text focus:outline-none focus:ring-1 focus:ring-accent"
                  >
                    <option value="inspector">Inspector</option>
                    <option value="mamlatdar">Mamlatdar (Taluka Supervisor)</option>
                    <option value="district_officer">District Officer</option>
                    <option value="vigilance">State Vigilance Officer</option>
                    <option value="admin">System Administrator</option>
                  </select>
                </div>
              </div>

              {/* Geographic Scope Assignment */}
              {createRole !== "admin" && createRole !== "vigilance" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label htmlFor="create-user-district" className="block text-meta font-medium text-text mb-1">
                      Assigned District *
                    </label>
                    <select
                      id="create-user-district"
                      value={createDistrict}
                      onChange={(e) => {
                        setCreateDistrict(e.target.value);
                        setCreateTaluka("");
                      }}
                      required
                      className="w-full text-meta border border-border rounded px-2.5 py-1.5 bg-background text-text focus:outline-none focus:ring-1 focus:ring-accent"
                    >
                      <option value="">Select District</option>
                      {districts.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(createRole === "inspector" || createRole === "mamlatdar") && (
                    <div>
                      <label htmlFor="create-user-taluka" className="block text-meta font-medium text-text mb-1">
                        Assigned Taluka *
                      </label>
                      <select
                        id="create-user-taluka"
                        value={createTaluka}
                        onChange={(e) => setCreateTaluka(e.target.value)}
                        required
                        disabled={!createDistrict}
                        className="w-full text-meta border border-border rounded px-2.5 py-1.5 bg-background text-text focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
                      >
                        <option value="">Select Taluka</option>
                        {(talukasByDistrict[createDistrict] || []).map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-3 py-1.5 border border-border text-text rounded text-meta font-medium hover:bg-surface"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="px-4 py-1.5 bg-accent text-accent-fg rounded text-meta font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {createSubmitting ? "Provisioning..." : "Provision Account"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filters */}
        <div className="bg-surface border border-border rounded-md p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center space-x-2">
            <label htmlFor="admin-users-role-filter" className="text-meta font-medium text-text-muted">
              Role:
            </label>
            <select
              id="admin-users-role-filter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="text-meta border border-border rounded px-2.5 py-1.5 bg-background text-text focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="all">All Roles</option>
              <option value="inspector">Inspectors</option>
              <option value="mamlatdar">Mamlatdars</option>
              <option value="district_officer">District Officers</option>
              <option value="vigilance">Vigilance</option>
              <option value="admin">Administrators</option>
            </select>
          </div>

          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="Search by name, email, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-meta border border-border rounded px-3 py-1.5 bg-background text-text placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>

        {/* Table & States */}
        {error ? (
          <ErrorState message={error} onRetry={fetchUsers} />
        ) : loading ? (
          <div className="bg-surface border border-border rounded-md p-12 text-center text-meta text-text-muted animate-pulse">
            Loading user accounts...
          </div>
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            title="No users found"
            message="No user accounts match the current filter selection."
            actionLabel="Reset filters"
            onAction={() => {
              setRoleFilter("all");
              setSearchQuery("");
            }}
          />
        ) : (
          <DataTable columns={columns} data={filteredUsers} keyField="user_id" />
        )}
      </div>
    </AppShell>
  );
}
