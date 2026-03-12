import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createElement, type ReactNode } from "react";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn() },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

import { CompanyProvider, useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const mockFrom = supabase.from as ReturnType<typeof vi.fn>;
const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

function makeWrapper() {
  return ({ children }: { children: ReactNode }) =>
    createElement(CompanyProvider, null, children);
}

describe("CompanyContext", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty state when user is null", async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    const { result } = renderHook(() => useCompany(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.companies).toHaveLength(0);
    expect(result.current.currentCompany).toBeNull();
  });

  it("stays loading while auth is loading", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    const { result } = renderHook(() => useCompany(), { wrapper: makeWrapper() });
    expect(result.current.loading).toBe(true);
  });

  it("loads companies for authenticated user", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "user-1" }, loading: false });
    mockFrom.mockImplementation((table: string) => {
      if (table === "user_companies") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [{ company_id: "co-1" }], error: null }),
        };
      }
      // companies
      return {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [{ id: "co-1", name: "Acme", code: "ACM", created_at: "", updated_at: "" }],
          error: null,
        }),
      };
    });
    const { result } = renderHook(() => useCompany(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.companies).toHaveLength(1);
    expect(result.current.currentCompany?.name).toBe("Acme");
  });

  it("handles empty memberships gracefully", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "user-1" }, loading: false });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    const { result } = renderHook(() => useCompany(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.companies).toHaveLength(0);
    expect(result.current.currentCompany).toBeNull();
  });

  it("setCurrentCompany updates context and persists to localStorage", async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    const { result } = renderHook(() => useCompany(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const company = { id: "co-2", name: "Beta Corp", code: "BET", created_at: "", updated_at: "" };
    act(() => {
      result.current.setCurrentCompany(company);
    });

    await waitFor(() => expect(result.current.currentCompany?.id).toBe("co-2"));
    expect(localStorage.getItem("distrohub_company_id")).toBe("co-2");
  });
});
