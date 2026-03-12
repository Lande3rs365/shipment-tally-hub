import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { createElement } from "react";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn() },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" }, loading: false }),
}));

vi.mock("@/contexts/CompanyContext", () => ({
  useCompany: vi.fn(),
}));

import CompanyGate from "@/components/CompanyGate";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";

const mockUseCompany = useCompany as ReturnType<typeof vi.fn>;
const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

function buildProfileChain(onboardingCompleted: boolean) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { onboarding_completed: onboardingCompleted },
      error: null,
    }),
  };
}

describe("CompanyGate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders children when onboarded and has company", async () => {
    mockUseCompany.mockReturnValue({
      companies: [{ id: "co-1", name: "Acme" }],
      loading: false,
    });
    mockFrom.mockReturnValue(buildProfileChain(true));

    render(
      createElement(
        MemoryRouter, { future: { v7_startTransition: true, v7_relativeSplatPath: true } },
        createElement(CompanyGate, null, createElement("div", { "data-testid": "child" }, "Content"))
      )
    );

    await waitFor(() => expect(screen.getByTestId("child")).toBeInTheDocument());
  });

  it("redirects to /onboarding when not onboarded", async () => {
    mockUseCompany.mockReturnValue({ companies: [], loading: false });
    mockFrom.mockReturnValue(buildProfileChain(false));

    render(
      createElement(
        MemoryRouter, { initialEntries: ["/dashboard"], future: { v7_startTransition: true, v7_relativeSplatPath: true } },
        createElement(
          Routes, null,
          createElement(Route, {
            path: "/onboarding",
            element: createElement("div", null, "Onboarding"),
          }),
          createElement(Route, {
            path: "/dashboard",
            element: createElement(CompanyGate, null, createElement("div", null, "Content")),
          }),
        )
      )
    );

    await waitFor(() => expect(screen.getByText("Onboarding")).toBeInTheDocument());
  });

  it("redirects to /onboarding when company list is empty even if onboarded", async () => {
    mockUseCompany.mockReturnValue({ companies: [], loading: false });
    mockFrom.mockReturnValue(buildProfileChain(true));

    render(
      createElement(
        MemoryRouter, { initialEntries: ["/dashboard"], future: { v7_startTransition: true, v7_relativeSplatPath: true } },
        createElement(
          Routes, null,
          createElement(Route, {
            path: "/onboarding",
            element: createElement("div", null, "Onboarding"),
          }),
          createElement(Route, {
            path: "/dashboard",
            element: createElement(CompanyGate, null, createElement("div", null, "Content")),
          }),
        )
      )
    );

    await waitFor(() => expect(screen.getByText("Onboarding")).toBeInTheDocument());
  });

  it("shows spinner while company context is loading", () => {
    mockUseCompany.mockReturnValue({ companies: [], loading: true });

    const { container } = render(
      createElement(
        MemoryRouter, null,
        createElement(CompanyGate, null, createElement("div", null, "Content"))
      )
    );

    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  it("redirects (not spinner) when profile fetch throws", async () => {
    mockUseCompany.mockReturnValue({ companies: [], loading: false });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockRejectedValue(new Error("DB error")),
    });

    render(
      createElement(
        MemoryRouter, { initialEntries: ["/dashboard"] },
        createElement(
          Routes, null,
          createElement(Route, {
            path: "/onboarding",
            element: createElement("div", null, "Onboarding"),
          }),
          createElement(Route, {
            path: "/dashboard",
            element: createElement(CompanyGate, null, createElement("div", null, "Content")),
          }),
        )
      )
    );

    await waitFor(() => expect(screen.getByText("Onboarding")).toBeInTheDocument());
  });
});
