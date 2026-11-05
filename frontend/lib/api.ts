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

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" ? "http://127.0.0.1:8000" : "http://127.0.0.1:8000");

async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let errorDetail = `Request to ${endpoint} failed with status ${res.status}`;
    try {
      const err = await res.json();
      if (err.detail) {
        errorDetail = typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail);
      }
    } catch {
      // ignored
    }
    throw new Error(errorDetail);
  }

  return (await res.json()) as T;
}

export interface RankedShopsParams {
  week?: string;
  district?: string;
  taluka?: string;
  band?: string;
  page?: number;
  pageSize?: number;
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
  if (params.page !== undefined) searchParams.set("page", String(params.page));
  if (params.pageSize !== undefined) searchParams.set("page_size", String(params.pageSize));

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
