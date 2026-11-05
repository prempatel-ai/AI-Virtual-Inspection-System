import type { components } from "../types/api";

export type MetaResponse = components["schemas"]["MetaResponse"];
export type SummaryResponse = components["schemas"]["SummaryResponse"];
export type RankedShopsResponse = components["schemas"]["RankedShopsResponse"];
export type RankedShopItem = components["schemas"]["RankedShopItem"];
export type ShopDetailResponse = components["schemas"]["ShopDetailResponse"];
export type RunRequest = components["schemas"]["RunRequest"];
export type RunResponse = components["schemas"]["RunResponse"];
export type FeedbackRequest = components["schemas"]["FeedbackRequest"];
export type FeedbackResponse = components["schemas"]["FeedbackResponse"];

// V2 Types
export type LoginRequest = components["schemas"]["LoginRequest"];
export type LoginResponse = components["schemas"]["LoginResponse"];
export type UserSummary = components["schemas"]["UserSummary"];
export type ScopeInfo = components["schemas"]["ScopeInfo"];
export type CaseListItem = components["schemas"]["CaseListItem"];
export type CaseListResponse = components["schemas"]["CaseListResponse"];
export type CaseDetailResponse = components["schemas"]["CaseDetailResponse"];
export type CaseActionRequest = components["schemas"]["CaseActionRequest"];
export type CaseActionItem = components["schemas"]["CaseActionItem"];
export type AreaMetricItem = components["schemas"]["AreaMetricItem"];
export type AreaMetricsResponse = components["schemas"]["AreaMetricsResponse"];
export type OfficerListItem = components["schemas"]["OfficerListItem"];
export type OfficerListResponse = components["schemas"]["OfficerListResponse"];
export type OfficerDetailResponse = components["schemas"]["OfficerDetailResponse"];
export type ActionFeedItem = components["schemas"]["ActionFeedItem"];
export type ActionFeedResponse = components["schemas"]["ActionFeedResponse"];
export type AdminUserItem = components["schemas"]["AdminUserItem"];
export type AdminUserListResponse = components["schemas"]["AdminUserListResponse"];
export type CreateUserRequest = components["schemas"]["CreateUserRequest"];
export type CreateUserResponse = components["schemas"]["CreateUserResponse"];
export type UpdateUserRequest = components["schemas"]["UpdateUserRequest"];
export type ResetPasswordResponse = components["schemas"]["ResetPasswordResponse"];
export type AuditLogItem = components["schemas"]["AuditLogItem"];
export type AuditLogResponse = components["schemas"]["AuditLogResponse"];

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : "http://127.0.0.1:8000");

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "fetch",
      ...options?.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let errorDetail = `Request to ${endpoint} failed with status ${res.status}`;
    let errorCode: string | undefined;

    try {
      const err = await res.json();
      if (err.detail) {
        if (typeof err.detail === "string") {
          errorDetail = err.detail;
        } else if (typeof err.detail === "object") {
          errorDetail = err.detail.message || JSON.stringify(err.detail);
          errorCode = err.detail.code;
        }
      } else if (err.error) {
        errorDetail = err.error.message || JSON.stringify(err.error);
        errorCode = err.error.code;
      }
    } catch {
      // ignored
    }
    throw new ApiError(errorDetail, res.status, errorCode);
  }

  return (await res.json()) as T;
}

// 1. Auth APIs
export async function login(data: LoginRequest): Promise<LoginResponse> {
  return fetchJson<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function logout(): Promise<{ status: string }> {
  return fetchJson<{ status: string }>("/auth/logout", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function getMe(): Promise<LoginResponse> {
  return fetchJson<LoginResponse>("/auth/me");
}

// 2. Overview and Flags APIs
export interface RankedShopsParams {
  week?: string;
  district?: string;
  taluka?: string;
  band?: string;
  page?: number;
  pageSize?: number;
  limit?: number;
  offset?: number;
}

export async function getMeta(): Promise<MetaResponse> {
  return fetchJson<MetaResponse>("/meta");
}

export async function getSummary(week?: string): Promise<SummaryResponse> {
  const query = week ? `?week=${encodeURIComponent(week)}` : "";
  return fetchJson<SummaryResponse>(`/summary${query}`);
}

export async function getRankedShops(params: RankedShopsParams = {}): Promise<RankedShopsResponse> {
  const searchParams = new URLSearchParams();
  if (params.week) searchParams.set("week", params.week);
  if (params.district) searchParams.set("district", params.district);
  if (params.taluka) searchParams.set("taluka", params.taluka);
  if (params.band) searchParams.set("band", params.band);
  if (params.limit !== undefined) searchParams.set("limit", String(params.limit));
  if (params.offset !== undefined) searchParams.set("offset", String(params.offset));

  const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
  return fetchJson<RankedShopsResponse>(`/shops/ranked${query}`);
}

export async function getShopDetail(shopId: string, week?: string): Promise<ShopDetailResponse> {
  const query = week ? `?week=${encodeURIComponent(week)}` : "";
  return fetchJson<ShopDetailResponse>(`/shops/${encodeURIComponent(shopId)}${query}`);
}

export async function triggerRun(data: RunRequest): Promise<RunResponse> {
  return fetchJson<RunResponse>("/run", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function submitFeedback(shopId: string, data: FeedbackRequest): Promise<FeedbackResponse> {
  return fetchJson<FeedbackResponse>(`/shops/${encodeURIComponent(shopId)}/feedback`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// 3. Cases APIs
export interface CasesParams {
  status?: string;
  assignee_id?: string;
  district?: string;
  taluka?: string;
  band?: string;
  overdue?: boolean;
  limit?: number;
  offset?: number;
}

export async function getCases(params: CasesParams = {}): Promise<CaseListResponse> {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set("status", params.status);
  if (params.assignee_id) searchParams.set("assignee_id", params.assignee_id);
  if (params.district) searchParams.set("district", params.district);
  if (params.taluka) searchParams.set("taluka", params.taluka);
  if (params.band) searchParams.set("band", params.band);
  if (params.overdue !== undefined) searchParams.set("overdue", String(params.overdue));
  if (params.limit !== undefined) searchParams.set("limit", String(params.limit));
  if (params.offset !== undefined) searchParams.set("offset", String(params.offset));

  const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
  return fetchJson<CaseListResponse>(`/cases${query}`);
}

export async function getCaseDetail(caseId: string): Promise<CaseDetailResponse> {
  return fetchJson<CaseDetailResponse>(`/cases/${encodeURIComponent(caseId)}`);
}

export async function postCaseAction(caseId: string, data: CaseActionRequest): Promise<CaseActionItem> {
  return fetchJson<CaseActionItem>(`/cases/${encodeURIComponent(caseId)}/actions`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// 4. Oversight APIs
export async function getAreas(level: "district" | "taluka" = "district", parent?: string): Promise<AreaMetricsResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set("level", level);
  if (parent) searchParams.set("parent", parent);
  return fetchJson<AreaMetricsResponse>(`/areas?${searchParams.toString()}`);
}

export interface OfficersParams {
  role?: string;
  district?: string;
  taluka?: string;
  active?: boolean;
}

export async function getOfficers(params: OfficersParams = {}): Promise<OfficerListResponse> {
  const searchParams = new URLSearchParams();
  if (params.role) searchParams.set("role", params.role);
  if (params.district) searchParams.set("district", params.district);
  if (params.taluka) searchParams.set("taluka", params.taluka);
  if (params.active !== undefined) searchParams.set("active", String(params.active));
  const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
  return fetchJson<OfficerListResponse>(`/officers${query}`);
}

export async function getOfficerDetail(officerId: string): Promise<OfficerDetailResponse> {
  return fetchJson<OfficerDetailResponse>(`/officers/${encodeURIComponent(officerId)}`);
}

export interface ActionsParams {
  officer_id?: string;
  type?: string;
  case_id?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export async function getActionFeed(params: ActionsParams = {}): Promise<ActionFeedResponse> {
  const searchParams = new URLSearchParams();
  if (params.officer_id) searchParams.set("officer_id", params.officer_id);
  if (params.type) searchParams.set("type", params.type);
  if (params.case_id) searchParams.set("case_id", params.case_id);
  if (params.from) searchParams.set("from", params.from);
  if (params.to) searchParams.set("to", params.to);
  if (params.limit !== undefined) searchParams.set("limit", String(params.limit));
  if (params.offset !== undefined) searchParams.set("offset", String(params.offset));
  const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
  return fetchJson<ActionFeedResponse>(`/actions${query}`);
}

// 5. Admin APIs
export async function getAdminUsers(): Promise<AdminUserListResponse> {
  return fetchJson<AdminUserListResponse>("/admin/users");
}

export async function createAdminUser(data: CreateUserRequest): Promise<CreateUserResponse> {
  return fetchJson<CreateUserResponse>("/admin/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateAdminUser(userId: string, data: UpdateUserRequest): Promise<AdminUserItem> {
  return fetchJson<AdminUserItem>(`/admin/users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function resetAdminUserPassword(userId: string): Promise<ResetPasswordResponse> {
  return fetchJson<ResetPasswordResponse>(`/admin/users/${encodeURIComponent(userId)}/reset-password`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export interface AuditParams {
  event?: string;
  user_id?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export async function getAdminAudit(params: AuditParams = {}): Promise<AuditLogResponse> {
  const searchParams = new URLSearchParams();
  if (params.event) searchParams.set("event", params.event);
  if (params.user_id) searchParams.set("user_id", params.user_id);
  if (params.from) searchParams.set("from", params.from);
  if (params.to) searchParams.set("to", params.to);
  if (params.limit !== undefined) searchParams.set("limit", String(params.limit));
  if (params.offset !== undefined) searchParams.set("offset", String(params.offset));
  const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
  return fetchJson<AuditLogResponse>(`/admin/audit${query}`);
}
