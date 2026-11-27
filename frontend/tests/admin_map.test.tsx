import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import AdminMapPage from "../app/admin/map/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/admin/map",
  useSearchParams: () => ({
    get: vi.fn(() => null),
  }),
}));

let mockHasPermission = vi.fn((_perm?: string) => true);

vi.mock("../lib/auth", () => ({
  useAuth: () => ({
    user: {
      id: "U-ADMIN-1",
      email: "admin@demo.invalid",
      name: "Admin Officer",
      role: "admin",
      permissions: ["users:manage"],
      scope: null,
    },
    permissions: ["users:manage"],
    scope: null,
    loading: false,
    hasPermission: (perm: string) => mockHasPermission(perm),
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("leaflet", () => {
  return {
    default: {
      map: vi.fn(() => ({
        setView: vi.fn(),
        remove: vi.fn(),
        flyTo: vi.fn(),
      })),
      tileLayer: vi.fn(() => ({
        addTo: vi.fn(),
      })),
      layerGroup: vi.fn(() => ({
        addTo: vi.fn(),
        clearLayers: vi.fn(),
      })),
      circleMarker: vi.fn(() => ({
        bindPopup: vi.fn(),
        bindTooltip: vi.fn(),
        on: vi.fn(),
        addTo: vi.fn(),
        getLatLng: vi.fn(() => ({ lat: 22.3, lng: 70.8 })),
        openPopup: vi.fn(),
      })),
    },
  };
});

describe("AdminMapPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockHasPermission = vi.fn(() => true);
  });

  it("renders page header and KPI metrics", async () => {
    const mockMapResponse = {
      total_shops: 500,
      high_count: 17,
      medium_count: 35,
      low_count: 448,
      latest_week: "2026-11-02",
      items: [
        {
          shop_id: "FPS-00012",
          name: "Saurashtra Store 12",
          district: "Rajkot",
          taluka: "Rajkot",
          lat: 22.3,
          lng: 70.8,
          risk_score: 78.5,
          band: "high" as const,
          cards_count: 450,
          vulnerability_index: 0.65,
          case_id: "CASE-001",
          case_status: "open",
          top_signals: [{ label: "Ghost Beneficiaries", points: 30 }],
        },
      ],
    };

    global.fetch = vi.fn((url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("/meta")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            districts: ["Rajkot", "Surat"],
            talukas: { Rajkot: ["Rajkot"] },
            weeks: ["2026-11-02"],
          }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => mockMapResponse,
      } as Response);
    });

    render(<AdminMapPage />);

    expect(screen.getByText("Gujarat State Risk Map")).toBeDefined();
    await waitFor(() => {
      expect(screen.getAllByText("500").length).toBeGreaterThan(0);
      expect(screen.getByText("17")).toBeDefined();
      expect(screen.getByText("Saurashtra Store 12")).toBeDefined();
    });
  });

  it("shows access restricted if user lacks users:manage", () => {
    mockHasPermission = vi.fn(() => false);
    render(<AdminMapPage />);
    expect(
      screen.getByText(/Administrative privileges \(users:manage\) are required/)
    ).toBeDefined();
  });
});
