import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LandingPage from "../app/page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/",
}));

// Mock auth hook
const mockLogin = vi.fn().mockResolvedValue(undefined);
const mockLogout = vi.fn().mockResolvedValue(undefined);

vi.mock("../lib/auth", () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    login: mockLogin,
    logout: mockLogout,
    hasPermission: () => true,
    permissions: ["cases:view", "flags:view", "admin:access"],
    scope: { type: "state" },
    refresh: vi.fn(),
  }),
}));

describe("LandingPage", () => {
  it("renders the institutional header, hero value proposition, and key metrics", () => {
    render(<LandingPage />);

    expect(screen.getByText("PDS-VIS")).toBeInTheDocument();
    expect(screen.getByText("Govt. of Gujarat")).toBeInTheDocument();
    expect(
      screen.getByText("Continuous Anomaly Detection & Geospatial Oversight for Fair Price Shops")
    ).toBeInTheDocument();
    expect(screen.getByText("500 Shops")).toBeInTheDocument();
    expect(screen.getByText("< 1.2 Seconds")).toBeInTheDocument();
    expect(screen.getByText("SHA-256")).toBeInTheDocument();
  });

  it("renders the live telemetry radar table with Fair Price Shops and filter controls", () => {
    render(<LandingPage />);

    expect(screen.getByText("Statewide Priority Inspection Radar")).toBeInTheDocument();
    expect(screen.getByText("FPS-00291")).toBeInTheDocument();
    expect(screen.getByText("Palsana Fair Price Centre")).toBeInTheDocument();
    expect(screen.getByText("95.6 / 100")).toBeInTheDocument();

    // Filter by high risk
    const highRiskBtn = screen.getByText("high Risk");
    fireEvent.click(highRiskBtn);

    expect(screen.getByText("FPS-00291")).toBeInTheDocument();
    expect(screen.queryByText("FPS-00049")).not.toBeInTheDocument();
  });

  it("renders official demo personas and handles 1-click role login", async () => {
    render(<LandingPage />);

    expect(screen.getByText("Test-Drive the System by Official Role")).toBeInTheDocument();
    expect(screen.getByText("State Administrator")).toBeInTheDocument();
    expect(screen.getByText("State Vigilance Officer")).toBeInTheDocument();

    const adminLoginBtn = screen.getByText("Login as State Administrator");
    fireEvent.click(adminLoginBtn);

    expect(mockLogin).toHaveBeenCalledWith({
      email: "aarav.patel.1@demo.invalid",
      password: "demoPassword123",
    });
  });

  it("renders the 5-stage enforcement pipeline and switches active focus stage on click", () => {
    render(<LandingPage />);

    expect(screen.getByText("End-to-End Inspection & Sanction Pipeline")).toBeInTheDocument();
    expect(screen.getByText("Continuous Anomaly Scoring")).toBeInTheDocument();
    expect(screen.getByText("Photographic Notice Board OCR")).toBeInTheDocument();

    const ocrStage = screen.getByText("Photographic Notice Board OCR");
    fireEvent.click(ocrStage);

    expect(
      screen.getByText("Focused Stage: Photographic Notice Board OCR")
    ).toBeInTheDocument();
  });
});
