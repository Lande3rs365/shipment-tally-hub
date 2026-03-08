import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], error: null }),
      then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
    }),
  },
}));

vi.mock("@/contexts/CompanyContext", () => ({
  useCompany: () => ({ currentCompany: null, companies: [], setCurrentCompany: vi.fn() }),
  CompanyProvider: ({ children }: any) => children,
}));

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import ProtectedRoute from "@/components/ProtectedRoute";

const mockGetSession = supabase.auth.getSession as ReturnType<typeof vi.fn>;
const mockOnAuthStateChange = supabase.auth.onAuthStateChange as ReturnType<typeof vi.fn>;
const mockSignOut = supabase.auth.signOut as ReturnType<typeof vi.fn>;

function buildSubscription() {
  return { data: { subscription: { unsubscribe: vi.fn() } } };
}

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnAuthStateChange.mockReturnValue(buildSubscription());
  });

  it("starts in loading state before session resolves", () => {
    mockGetSession.mockReturnValue(new Promise(() => {})); // never resolves
    let capturedLoading = false;
    function TestConsumer() {
      capturedLoading = useAuth().loading;
      return null;
    }
    render(createElement(AuthProvider, null, createElement(TestConsumer)));
    expect(capturedLoading).toBe(true);
  });

  it("resolves to null user when no session", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    let auth: any;
    function TestConsumer() {
      auth = useAuth();
      return createElement("div", { "data-testid": "state" }, auth.loading ? "loading" : "ready");
    }
    render(createElement(AuthProvider, null, createElement(TestConsumer)));
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("ready"));
    expect(auth.user).toBeNull();
  });

  it("resolves to user when session exists", async () => {
    const session = { user: { id: "uid-1", email: "test@example.com" }, access_token: "tok" };
    mockGetSession.mockResolvedValue({ data: { session } });
    let auth: any;
    function TestConsumer() {
      auth = useAuth();
      return createElement("div", { "data-testid": "state" }, auth.loading ? "loading" : "ready");
    }
    render(createElement(AuthProvider, null, createElement(TestConsumer)));
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("ready"));
    expect(auth.user?.id).toBe("uid-1");
  });

  it("calls supabase.auth.signOut on signOut()", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockSignOut.mockResolvedValue({});
    let auth: any;
    function TestConsumer() {
      auth = useAuth();
      return null;
    }
    render(createElement(AuthProvider, null, createElement(TestConsumer)));
    await waitFor(() => auth?.loading === false);
    await auth.signOut();
    expect(mockSignOut).toHaveBeenCalledOnce();
  });

  it("subscribes to auth state changes on mount", () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    render(createElement(AuthProvider, null, createElement("div")));
    expect(mockOnAuthStateChange).toHaveBeenCalledOnce();
  });

  it("unsubscribes on unmount", () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const unsub = vi.fn();
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: unsub } } });
    const { unmount } = render(createElement(AuthProvider, null, createElement("div")));
    unmount();
    expect(unsub).toHaveBeenCalled();
  });
});

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnAuthStateChange.mockReturnValue(buildSubscription());
  });

  it("redirects to /login when unauthenticated and loading is done", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    render(
      createElement(
        AuthProvider, null,
        createElement(
          MemoryRouter, { initialEntries: ["/dashboard"] },
          createElement(
            Routes, null,
            createElement(Route, { path: "/login", element: createElement("div", null, "Login Page") }),
            createElement(Route, { path: "/dashboard", element: createElement(ProtectedRoute, null, createElement("div", null, "Dashboard")) }),
          )
        )
      )
    );
    await waitFor(() => expect(screen.queryByText("Login Page")).toBeInTheDocument());
  });
});
