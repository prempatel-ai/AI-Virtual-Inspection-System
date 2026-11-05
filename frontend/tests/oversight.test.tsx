import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import OverviewPage from "../app/overview/page";
import AreasPage from "../app/areas/page";
import OfficersPage from "../app/officers/page";
import OfficerDetailPage from "../app/officers/[id]/page";
import ActionsPage from "../app/actions/page";
import AdminUsersPage from "../app/admin/users/page";
import AdminAuditPage from "../app/admin/audit/page";
import * as api from "../lib/api";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "U-INSP-1" }),
  useSearchParams: () => ({
    get: (key: string) => (key === "level" ? "district" : null),
  }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/overview",
}));

vi.mock("../lib/auth", () => ({
  useAuth: () => ({
    user: {
      id: "U-ADMIN-1",
      email: "admin@demo.invalid",
      name: "Admin Officer",
      role: "admin",
      permissions: ["users:manage", "audit:view", "oversight:view"],
      scope: null,
    },
    permissions: ["users:manage", "audit:view", "oversight:view"],
    scope: null,
    loading: false,
    hasPermission: () => true,
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("Oversight and Admin Screens", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders overview page with child area metrics", async () => {
    vi.spyOn(api, "getSummary").mockResolvedValue({
      week: "2026-11-02",
      shops_monitored: 500,
      flagged: 25,
      high: 5,
      medium: 20,
      evaluation: {
        on_synthetic_data: true,
        precision_at_k: 0.8,
        recall_at_2k: 0.9,
        outage_false_alarm_rate: 0,
        k: 25,
      },
      visits_recorded: 10,
      confirmed_rate: 0.8,
      open_cases: 20,
      overdue_cases: 2,
    });

    vi.spyOn(api, "getAreas").mockResolvedValue({
      items: [
        {
          name: "Ahmedabad",
          level: "district",
          shops_count: 200,
          flagged_count: 12,
          flag_rate: 0.06,
          high_band_count: 3,
          open_cases: 10,
          overdue_cases: 1,
          confirmed_rate: 0.75,
        },
      ],
    });

    render(<OverviewPage />);

    expect(screen.getByText("Executive Oversight")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Ahmedabad")).toBeInTheDocument();
      expect(screen.getByText("6.0%")).toBeInTheDocument();
    });
  });

  it("renders areas comparison page", async () => {
    vi.spyOn(api, "getMeta").mockResolvedValue({
      synthetic: true,
      weeks: ["2026-11-02"],
      latest_week: "2026-11-02",
      districts: ["Ahmedabad", "Surat"],
      talukas: { Ahmedabad: ["City"] },
      shops_count: 500,
      has_run: true,
    });

    vi.spyOn(api, "getAreas").mockResolvedValue({
      items: [
        {
          name: "Surat",
          level: "district",
          shops_count: 150,
          flagged_count: 8,
          flag_rate: 0.053,
          high_band_count: 2,
          open_cases: 6,
          overdue_cases: 0,
          confirmed_rate: 0.6,
        },
      ],
    });

    render(<AreasPage />);

    expect(screen.getByText("Administrative Area Risk Metrics")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Surat")).toBeInTheDocument();
    });
  });

  it("renders officers roster page", async () => {
    vi.spyOn(api, "getOfficers").mockResolvedValue({
      items: [
        {
          user_id: "U-INSP-1",
          name: "Inspector Dave",
          role: "inspector",
          district: "Ahmedabad",
          taluka: "City",
          is_active: true,
          stats: {
            assigned_cases: 15,
            open_cases: 5,
            overdue_cases: 1,
            inspected_cases: 8,
            closed_cases: 2,
            confirmed_rate: 0.7,
            median_time_to_first_action_hours: 24.5,
          },
        },
      ],
    });

    render(<OfficersPage />);

    expect(screen.getByText("Inspection Officers")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Inspector Dave")).toBeInTheDocument();
      expect(screen.getByText("U-INSP-1")).toBeInTheDocument();
    });
  });

  it("renders officer detail page with permissions and cases", async () => {
    vi.spyOn(api, "getOfficerDetail").mockResolvedValue({
      user_id: "U-INSP-1",
      name: "Inspector Dave",
      email: "inspector.dave@demo.invalid",
      role: "inspector",
      district: "Ahmedabad",
      taluka: "City",
      is_active: true,
      created_at: "2026-10-01T00:00:00Z",
      permissions: ["cases:read", "cases:act"],
      scope: { district: "Ahmedabad", taluka: "City" },
      area_flag_rate: 0.08,
      stats: {
        assigned_cases: 15,
        open_cases: 5,
        overdue_cases: 1,
        inspected_cases: 8,
        closed_cases: 2,
        confirmed_rate: 0.7,
        median_time_to_first_action_hours: 24.5,
      },
      assigned_cases: [
        {
          case_id: "CASE-FPS-00015",
          shop_id: "FPS-00015",
          shop_name: "Shop FPS-00015",
          district: "Ahmedabad",
          taluka: "City",
          status: "assigned",
          risk_score_latest: 82.0,
          band_latest: "high",
          opened_week: "2026-11-02",
          last_flagged_week: "2026-11-02",
          assignee_id: "U-INSP-1",
          assignee_name: "Inspector Dave",
          is_overdue: false,
          last_action_at: "2026-11-02T10:00:00Z",
          created_at: "2026-11-02T10:00:00Z",
        },
      ],
      recent_actions: [],
    });

    render(<OfficerDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Inspector Dave")).toBeInTheDocument();
      expect(screen.getByText("inspector.dave@demo.invalid")).toBeInTheDocument();
      expect(screen.getByText("Assigned Inspection Cases")).toBeInTheDocument();
      expect(screen.getByText("CASE-FPS-00015")).toBeInTheDocument();
    });
  });

  it("renders actions feed page", async () => {
    vi.spyOn(api, "getActionFeed").mockResolvedValue({
      total: 1,
      items: [
        {
          id: 101,
          case_id: "CASE-FPS-00012",
          shop_id: "FPS-00012",
          shop_name: "Shop FPS-00012",
          actor_id: "U-INSP-1",
          actor_name: "Inspector Dave",
          actor_role: "inspector",
          type: "start_inspection",
          payload: {},
          risk_score_at_action: 85.0,
          created_at: "2026-11-02T12:00:00Z",
        },
      ],
    });

    render(<ActionsPage />);

    expect(screen.getByText("Case Activity Feed")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("CASE-FPS-00012")).toBeInTheDocument();
      expect(screen.getAllByText("Started Inspection").length).toBeGreaterThan(0);
    });
  });

  it("renders admin users and audit log pages", async () => {
    vi.spyOn(api, "getAdminUsers").mockResolvedValue({
      items: [
        {
          user_id: "U-ADMIN-1",
          name: "Admin Officer",
          email: "admin@demo.invalid",
          role: "admin",
          district: null,
          taluka: null,
          is_active: true,
          last_login_at: "2026-11-05T08:00:00Z",
          created_at: "2026-09-01T00:00:00Z",
        },
      ],
    });

    render(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText("User Management & Access Control")).toBeInTheDocument();
      expect(screen.getByText("Admin Officer")).toBeInTheDocument();
    });

    vi.spyOn(api, "getAdminAudit").mockResolvedValue({
      total: 1,
      items: [
        {
          id: 1,
          event: "login_success",
          actor_id: "U-ADMIN-1",
          target_user_id: null,
          ip: "127.0.0.1",
          detail: { email: "admin@demo.invalid" },
          created_at: "2026-11-05T08:00:00Z",
        },
      ],
    });

    render(<AdminAuditPage />);

    await waitFor(() => {
      expect(screen.getByText("Security Access & Audit Log")).toBeInTheDocument();
      expect(screen.getByText("login success")).toBeInTheDocument();
    });
  });
});
