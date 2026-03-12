import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Mocks ──

const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...args: any[]) => mockFrom(...args) },
}));

vi.mock("@/contexts/CompanyContext", () => ({
  useCompany: () => ({
    currentCompany: { id: "co-1", name: "Test Co", code: "TST" },
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1", email: "test@test.com" }, loading: false }),
}));

// Mock importHelpers to avoid real Supabase calls
const mockPreviewWoo = vi.fn();
const mockPreviewShipment = vi.fn();
const mockImportWoo = vi.fn();
const mockImportShipments = vi.fn();

vi.mock("@/lib/importHelpers", () => ({
  previewWooCommerceImport: (...args: any[]) => mockPreviewWoo(...args),
  previewShipmentImport: (...args: any[]) => mockPreviewShipment(...args),
  previewMasterImport: vi.fn(),
  importWooCommerceOrders: (...args: any[]) => mockImportWoo(...args),
  importShipments: (...args: any[]) => mockImportShipments(...args),
  importMasterRows: vi.fn(),
}));

vi.mock("@/hooks/useSupabaseData", () => ({
  useDataIntakeLogs: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

// Mock file reading helpers to return controlled text
vi.mock("@/lib/csvParsers", async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    readFileAsText: vi.fn().mockResolvedValue(""),
    readFileAsArrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
  };
});

import UploadsPage from "@/pages/UploadsPage";
import { readFileAsText } from "@/lib/csvParsers";

const mockReadFileAsText = readFileAsText as ReturnType<typeof vi.fn>;

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

function renderPage() {
  return render(createElement(UploadsPage), { wrapper: makeWrapper() });
}

function createFile(name: string, content: string, type = "text/csv"): File {
  return new File([content], name, { type });
}

// ── Tests ──

describe("UploadsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: supabase.from returns empty for data_intake_logs and any queries
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: [], error: null }),
      then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
    });
  });

  // ── Rendering ──

  it("renders the page title and source selector buttons", () => {
    renderPage();
    expect(screen.getByText("Data Intake")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "WooCommerce" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pirate Ship" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Master XLSX" })).toBeInTheDocument();
  });

  it("highlights the selected source button", () => {
    renderPage();
    const wooButton = screen.getByRole("button", { name: "WooCommerce" });
    expect(wooButton.className).toContain("bg-primary");
  });

  it("switches selected source on click", () => {
    renderPage();
    const pirateButton = screen.getByRole("button", { name: "Pirate Ship" });
    fireEvent.click(pirateButton);
    expect(pirateButton.className).toContain("bg-primary");
    const wooButton = screen.getByRole("button", { name: "WooCommerce" });
    expect(wooButton.className).not.toContain("bg-primary");
  });

  it("shows destination info for selected source", () => {
    renderPage();
    // Default is WooCommerce → orders table
    expect(screen.getByText(/orders/)).toBeInTheDocument();
  });

  it("renders the drop zone area", () => {
    renderPage();
    expect(screen.getByText(/Drop.*files here/)).toBeInTheDocument();
  });

  // ── File selection → preview flow (WooCommerce) ──

  it("shows import preview after selecting a WooCommerce CSV", async () => {
    const wooCSV = `order_id,status,billing_first_name,billing_email,order_total\n1001,processing,Jane,jane@test.com,50.00`;
    mockReadFileAsText.mockResolvedValue(wooCSV);
    mockPreviewWoo.mockResolvedValue({
      newOrders: 1, updatedOrders: 0, newShipments: 0, updatedShipments: 0, onHoldOrders: 0, totalRows: 1,
    });

    renderPage();

    // Simulate file input change
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [createFile("orders.csv", wooCSV)] } });
    });

    await waitFor(() => {
      expect(screen.getByText(/Import Preview/)).toBeInTheDocument();
    });

    // Should show new orders count
    expect(screen.getByText("New Orders")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();

    // Should show confirm button
    expect(screen.getByText(/Confirm Import/)).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("shows updated orders count in preview when records exist", async () => {
    const wooCSV = `order_id,status\n1001,processing\n1002,completed`;
    mockReadFileAsText.mockResolvedValue(wooCSV);
    mockPreviewWoo.mockResolvedValue({
      newOrders: 1, updatedOrders: 1, newShipments: 0, updatedShipments: 0, onHoldOrders: 0, totalRows: 2,
    });

    renderPage();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [createFile("orders.csv", wooCSV)] } });
    });

    await waitFor(() => {
      expect(screen.getByText("New Orders")).toBeInTheDocument();
      expect(screen.getByText("Updated Orders")).toBeInTheDocument();
    });
  });

  it("shows on-hold exception count in preview", async () => {
    const wooCSV = `order_id,status\n1001,on-hold`;
    mockReadFileAsText.mockResolvedValue(wooCSV);
    mockPreviewWoo.mockResolvedValue({
      newOrders: 1, updatedOrders: 0, newShipments: 0, updatedShipments: 0, onHoldOrders: 1, totalRows: 1,
    });

    renderPage();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [createFile("orders.csv", wooCSV)] } });
    });

    await waitFor(() => {
      expect(screen.getByText("On-Hold → Exceptions")).toBeInTheDocument();
    });
  });

  // ── Cancel import ──

  it("clears preview when Cancel is clicked", async () => {
    const wooCSV = `order_id,status\n1001,processing`;
    mockReadFileAsText.mockResolvedValue(wooCSV);
    mockPreviewWoo.mockResolvedValue({
      newOrders: 1, updatedOrders: 0, newShipments: 0, updatedShipments: 0, onHoldOrders: 0, totalRows: 1,
    });

    renderPage();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [createFile("orders.csv", wooCSV)] } });
    });

    await waitFor(() => expect(screen.getByText(/Import Preview/)).toBeInTheDocument());

    fireEvent.click(screen.getByText("Cancel"));

    await waitFor(() => {
      expect(screen.queryByText(/Import Preview/)).not.toBeInTheDocument();
    });
  });

  // ── Confirm import ──

  it("calls import function and shows success toast on confirm", async () => {
    const wooCSV = `order_id,status\n1001,processing`;
    mockReadFileAsText.mockResolvedValue(wooCSV);
    mockPreviewWoo.mockResolvedValue({
      newOrders: 1, updatedOrders: 0, newShipments: 0, updatedShipments: 0, onHoldOrders: 0, totalRows: 1,
    });
    mockImportWoo.mockResolvedValue({ processed: 1, errors: 0, errorMessages: [] });

    renderPage();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [createFile("orders.csv", wooCSV)] } });
    });

    await waitFor(() => expect(screen.getByText(/Confirm Import/)).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByText(/Confirm Import/));
    });

    await waitFor(() => {
      expect(mockImportWoo).toHaveBeenCalledOnce();
    });
  });

  // ── Pirate Ship flow ──

  it("shows shipment preview for Pirate Ship source", async () => {
    const pirateCSV = `Order ID,Tracking Number,Tracking Status,Recipient\n1001,TRACK001,Delivered,John`;
    mockReadFileAsText.mockResolvedValue(pirateCSV);
    mockPreviewShipment.mockResolvedValue({
      newOrders: 0, updatedOrders: 0, newShipments: 1, updatedShipments: 0, onHoldOrders: 0, totalRows: 1,
    });

    renderPage();
    // Switch to Pirate Ship
    fireEvent.click(screen.getByText("Pirate Ship"));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [createFile("shipments.csv", pirateCSV)] } });
    });

    await waitFor(() => {
      expect(screen.getByText(/Import Preview/)).toBeInTheDocument();
      expect(screen.getByText("New Shipments")).toBeInTheDocument();
    });

    // Confirm button should reference shipments table
    expect(screen.getByText(/→ shipments/)).toBeInTheDocument();
  });

  // ── Source mismatch detection ──

  it("shows mismatch warning when selected source doesn't match detected headers", async () => {
    // User selects WooCommerce but CSV has Pirate Ship headers
    const pirateCSV = `Order ID,Tracking Number,Tracking Status,Recipient,Ship Date,Carrier,Cost\n1001,TRACK001,Delivered,John,2024-01-20,USPS,4.50`;
    mockReadFileAsText.mockResolvedValue(pirateCSV);
    mockPreviewShipment.mockResolvedValue({
      newOrders: 0, updatedOrders: 0, newShipments: 1, updatedShipments: 0, onHoldOrders: 0, totalRows: 1,
    });

    renderPage();
    // WooCommerce is already selected by default
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [createFile("shipments.csv", pirateCSV)] } });
    });

    await waitFor(() => {
      expect(screen.getByText("Source Mismatch Detected")).toBeInTheDocument();
    });

    // Should show switch and keep buttons
    expect(screen.getByText(/Switch to Pirate Ship/)).toBeInTheDocument();
    expect(screen.getByText(/Keep WooCommerce anyway/)).toBeInTheDocument();
  });

  it("auto-corrects source when user clicks Switch button on mismatch", async () => {
    const pirateCSV = `Order ID,Tracking Number,Tracking Status,Recipient,Ship Date,Carrier,Cost\n1001,TRACK001,Delivered,John,2024-01-20,USPS,4.50`;
    mockReadFileAsText.mockResolvedValue(pirateCSV);
    mockPreviewShipment.mockResolvedValue({
      newOrders: 0, updatedOrders: 0, newShipments: 1, updatedShipments: 0, onHoldOrders: 0, totalRows: 1,
    });

    renderPage();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [createFile("shipments.csv", pirateCSV)] } });
    });

    await waitFor(() => expect(screen.getByText("Source Mismatch Detected")).toBeInTheDocument());

    fireEvent.click(screen.getByText(/Switch to Pirate Ship/));

    await waitFor(() => {
      // Mismatch warning should be gone, preview should be visible
      expect(screen.queryByText("Source Mismatch Detected")).not.toBeInTheDocument();
      expect(screen.getByText(/Import Preview/)).toBeInTheDocument();
    });
  });

  it("allows override when user clicks Keep button on mismatch", async () => {
    const pirateCSV = `Order ID,Tracking Number,Tracking Status,Recipient,Ship Date,Carrier,Cost\n1001,TRACK001,Delivered,John,2024-01-20,USPS,4.50`;
    mockReadFileAsText.mockResolvedValue(pirateCSV);
    mockPreviewShipment.mockResolvedValue({
      newOrders: 0, updatedOrders: 0, newShipments: 1, updatedShipments: 0, onHoldOrders: 0, totalRows: 1,
    });

    renderPage();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [createFile("shipments.csv", pirateCSV)] } });
    });

    await waitFor(() => expect(screen.getByText("Source Mismatch Detected")).toBeInTheDocument());

    fireEvent.click(screen.getByText(/Keep WooCommerce anyway/));

    await waitFor(() => {
      expect(screen.queryByText("Source Mismatch Detected")).not.toBeInTheDocument();
      expect(screen.getByText(/Import Preview/)).toBeInTheDocument();
    });
  });

  // ── Error handling ──

  it("shows error toast when parsing fails", async () => {
    mockReadFileAsText.mockRejectedValue(new Error("File read timed out"));

    renderPage();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [createFile("bad.csv", "")] } });
    });

    const { toast } = await import("@/hooks/use-toast");
    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Parse failed", variant: "destructive" })
      );
    });
  });

  // ── File size limit ──

  it("rejects files larger than 20MB with a toast", async () => {
    renderPage();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    // Create a small file but override .size to simulate >20MB
    const oversizedFile = createFile("huge.csv", "a");
    Object.defineProperty(oversizedFile, "size", { value: 21 * 1024 * 1024 });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [oversizedFile] } });
    });

    const { toast } = await import("@/hooks/use-toast");
    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "File too large", variant: "destructive" })
      );
    });

    // Should NOT show import preview
    expect(screen.queryByText(/Import Preview/)).not.toBeInTheDocument();
  });

  it("accepts files exactly at 20MB", async () => {
    const wooCSV = `order_id,status\n1001,processing`;
    mockReadFileAsText.mockResolvedValue(wooCSV);
    mockPreviewWoo.mockResolvedValue({
      newOrders: 1, updatedOrders: 0, newShipments: 0, updatedShipments: 0, onHoldOrders: 0, totalRows: 1,
    });

    renderPage();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    const borderlineFile = createFile("exact20mb.csv", "a");
    Object.defineProperty(borderlineFile, "size", { value: 20 * 1024 * 1024 });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [borderlineFile] } });
    });

    // Should proceed to preview (not be rejected)
    await waitFor(() => {
      expect(screen.getByText(/Import Preview/)).toBeInTheDocument();
    });
  });
});
