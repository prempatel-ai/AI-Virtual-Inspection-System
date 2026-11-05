import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import QueuePage from "../app/queue/page";
import CaseDetailPage from "../app/cases/[id]/page";
import * as api from "../lib/api";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "CASE-FPS-00012" }),
  useSearchParams: () => ({
    get: (key: string) => (key === "week" ? "2026-11-02" : null),
  }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/queue",
}));

describe("Queue and Case Detail Screens", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders queue page with KPIs and cases table", async () => {
    const mockCases: api.CaseListResponse = {
      total: 1,
      items: [
        {
          case_id: "CASE-FPS-00012",
          shop_id: "FPS-00012",
          shop_name: "Shop FPS-00012",
          district: "Ahmedabad",
          taluka: "City",
          status: "assigned",
          risk_score_latest: 84.5,
          band_latest: "high",
          opened_week: "2026-11-02",
          last_flagged_week: "2026-11-02",
          assignee_id: "U-INSP-1",
          assignee_name: "Inspector Patel",
          is_overdue: false,
          last_action_at: "2026-11-03T10:00:00Z",
          created_at: "2026-11-02T10:00:00Z",
        },
      ],
    };

    vi.spyOn(api, "getCases").mockResolvedValue(mockCases);

    render(<QueuePage />);

    expect(screen.getByText("Inspection Queue")).toBeInTheDocument();
    expect(screen.getByText("Open Cases")).toBeInTheDocument();
    expect(screen.getByText("Overdue Inspection")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Shop FPS-00012")).toBeInTheDocument();
      expect(screen.getByText("CASE-FPS-00012")).toBeInTheDocument();
      expect(screen.getByText("Inspector Patel")).toBeInTheDocument();
      expect(screen.getByText("84.5")).toBeInTheDocument();
    });
  });

  it("renders case detail page with actions and timeline", async () => {
    const mockCaseDetail: api.CaseDetailResponse = {
      case: {
        case_id: "CASE-FPS-00012",
        shop_id: "FPS-00012",
        shop_name: "Shop FPS-00012",
        district: "Ahmedabad",
        taluka: "City",
        status: "assigned",
        risk_score_latest: 84.5,
        band_latest: "high",
        opened_week: "2026-11-02",
        last_flagged_week: "2026-11-02",
        assignee_id: "U-INSP-1",
        assignee_name: "Inspector Patel",
        is_overdue: false,
        last_action_at: "2026-11-03T10:00:00Z",
        created_at: "2026-11-02T10:00:00Z",
      },
      allowed_actions: ["start_inspection", "escalate", "add_note"],
      actions: [
        {
          id: 1,
          case_id: "CASE-FPS-00012",
          type: "create",
          actor_id: "SYSTEM",
          actor_name: "System Auto-Assigner",
          actor_role: "system",
          payload: {
            note: "Case opened by scoring pipeline",
          },
          created_at: "2026-11-02T10:00:00Z",
        },
      ],
    };

    vi.spyOn(api, "getCaseDetail").mockResolvedValue(mockCaseDetail);
    vi.spyOn(api, "getShopDetail").mockRejectedValue(new Error("Shop detail not available"));

    render(<CaseDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Shop FPS-00012")).toBeInTheDocument();
      expect(screen.getByText("CASE-FPS-00012")).toBeInTheDocument();
      expect(screen.getByText("Available Officer Actions")).toBeInTheDocument();
      expect(screen.getByText("Start Inspection")).toBeInTheDocument();
      expect(screen.getByText("Escalate Case")).toBeInTheDocument();
      expect(screen.getByText("Add Case Note")).toBeInTheDocument();
      expect(screen.getByText("Case Activity Log")).toBeInTheDocument();
      expect(screen.getByText("Case opened")).toBeInTheDocument();
    });
  });
});
