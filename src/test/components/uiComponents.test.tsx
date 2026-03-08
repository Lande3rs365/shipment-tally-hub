import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StatusBadge from "@/components/StatusBadge";
import KpiCard from "@/components/KpiCard";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Package } from "lucide-react";

// ─────────────────────────────────────────────
// StatusBadge
// ─────────────────────────────────────────────
describe("StatusBadge", () => {
  it("renders processing status", () => {
    render(<StatusBadge status="processing" />);
    expect(screen.getByText(/processing/i)).toBeInTheDocument();
  });

  it("renders completed status", () => {
    render(<StatusBadge status="completed" />);
    expect(screen.getByText(/completed/i)).toBeInTheDocument();
  });

  it("renders cancelled status", () => {
    render(<StatusBadge status="cancelled" />);
    expect(screen.getByText(/cancelled/i)).toBeInTheDocument();
  });

  it("renders on-hold status", () => {
    render(<StatusBadge status="on-hold" />);
    expect(screen.getByText(/on.hold/i)).toBeInTheDocument();
  });

  it("renders delivered status", () => {
    render(<StatusBadge status="delivered" />);
    expect(screen.getByText(/delivered/i)).toBeInTheDocument();
  });

  it("renders in_transit status", () => {
    render(<StatusBadge status="in_transit" />);
    expect(screen.getByText(/transit/i)).toBeInTheDocument();
  });

  it("renders label_created status", () => {
    render(<StatusBadge status="label_created" />);
    expect(screen.getByText(/label/i)).toBeInTheDocument();
  });

  it("renders unknown status without crashing", () => {
    render(<StatusBadge status="unknown_status" />);
    // Should render something — no crash
    expect(document.body).toBeTruthy();
  });
});

// ─────────────────────────────────────────────
// KpiCard
// ─────────────────────────────────────────────
describe("KpiCard", () => {
  it("renders title and value", () => {
    render(<KpiCard title="Total Orders" value={123} icon={Package} />);
    expect(screen.getByText("Total Orders")).toBeInTheDocument();
    expect(screen.getByText("123")).toBeInTheDocument();
  });

  it("renders string value", () => {
    render(<KpiCard title="Status" value="Active" icon={Package} />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("renders zero value correctly", () => {
    render(<KpiCard title="Errors" value={0} icon={Package} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("renders without optional props", () => {
    render(<KpiCard title="Simple" value={5} icon={Package} />);
    expect(screen.getByText("Simple")).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────
// EmptyState
// ─────────────────────────────────────────────
describe("EmptyState", () => {
  it("renders title and description", () => {
    render(<EmptyState title="No orders found" description="Import a CSV to get started" />);
    expect(screen.getByText("No orders found")).toBeInTheDocument();
    expect(screen.getByText("Import a CSV to get started")).toBeInTheDocument();
  });

  it("renders without description", () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────
// LoadingSpinner
// ─────────────────────────────────────────────
describe("LoadingSpinner", () => {
  it("renders without crashing", () => {
    const { container } = render(<LoadingSpinner />);
    expect(container).toBeTruthy();
  });

  it("has an accessible element in the DOM", () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.firstChild).toBeTruthy();
  });
});
