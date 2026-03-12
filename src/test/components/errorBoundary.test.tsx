import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const mockCaptureException = vi.hoisted(() => vi.fn());

vi.mock("@/lib/sentry", () => ({
  Sentry: { captureException: mockCaptureException },
}));

// Suppress React's built-in error logging during tests so output stays clean
const originalConsoleError = console.error;
beforeEach(() => { console.error = vi.fn(); });
afterEach(() => { console.error = originalConsoleError; });

const Bomb = () => { throw new Error("Test explosion"); };

describe("ErrorBoundary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders children normally when no error occurs", () => {
    render(
      <ErrorBoundary>
        <div data-testid="content">All good</div>
      </ErrorBoundary>
    );
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("shows fallback UI when a child throws", () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reload page/i })).toBeInTheDocument();
  });

  it("displays a generic error message in the fallback UI", () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );
    expect(screen.getByText(/an unexpected error occurred/i)).toBeInTheDocument();
  });

  it("reports the error to Sentry", () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ extra: expect.any(Object) })
    );
  });

  it("does not show fallback when no error", () => {
    render(
      <ErrorBoundary>
        <div>Normal content</div>
      </ErrorBoundary>
    );
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });
});
