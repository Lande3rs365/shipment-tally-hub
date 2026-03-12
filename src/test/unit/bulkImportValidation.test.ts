import { describe, it, expect } from "vitest";

/**
 * These tests mirror the server-side validation rules enforced by the
 * bulk-import-products edge function. They verify the same constraints
 * client-side so malformed payloads are caught before making a network call.
 */

const MAX_BATCH = 5000;
const VALID_ROW_TYPES = new Set(["parent", "variant", "standalone"]);

interface ProductPayload {
  sku: string;
  name: string;
  row_type: string;
  category?: string | null;
  description?: string | null;
}

function validateProduct(p: any, index: number): string | null {
  if (!p || typeof p !== "object") return `Item ${index}: not an object`;
  if (typeof p.sku !== "string" || !p.sku.trim() || p.sku.length > 50) {
    return `Item ${index}: sku must be a non-empty string ≤ 50 chars`;
  }
  if (typeof p.name !== "string" || !p.name.trim() || p.name.length > 255) {
    return `Item ${index}: name must be a non-empty string ≤ 255 chars`;
  }
  if (p.category !== undefined && p.category !== null && (typeof p.category !== "string" || p.category.length > 100)) {
    return `Item ${index}: category must be a string ≤ 100 chars`;
  }
  if (p.description !== undefined && p.description !== null && (typeof p.description !== "string" || p.description.length > 2000)) {
    return `Item ${index}: description must be a string ≤ 2000 chars`;
  }
  if (!p.row_type || !VALID_ROW_TYPES.has(p.row_type)) {
    return `Item ${index}: row_type must be one of parent, variant, standalone`;
  }
  return null;
}

function validateBatch(products: any[]): string[] {
  if (products.length > MAX_BATCH) {
    return [`Batch too large. Maximum ${MAX_BATCH} products per request.`];
  }
  const errors: string[] = [];
  for (let i = 0; i < products.length; i++) {
    const err = validateProduct(products[i], i);
    if (err) errors.push(err);
    if (errors.length >= 10) { errors.push("...and more errors"); break; }
  }
  return errors;
}

// ── Batch size limits ──

describe("batch size validation", () => {
  it("accepts batch of exactly 5000 products", () => {
    const products = Array.from({ length: 5000 }, (_, i) => ({
      sku: `SKU-${i}`, name: `Product ${i}`, row_type: "standalone",
    }));
    expect(validateBatch(products)).toHaveLength(0);
  });

  it("rejects batch of 5001 products", () => {
    const products = Array.from({ length: 5001 }, (_, i) => ({
      sku: `SKU-${i}`, name: `Product ${i}`, row_type: "standalone",
    }));
    const errors = validateBatch(products);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("5000");
  });

  it("accepts empty batch", () => {
    expect(validateBatch([])).toHaveLength(0);
  });
});

// ── SKU validation ──

describe("SKU field validation", () => {
  it("rejects empty SKU", () => {
    const err = validateProduct({ sku: "", name: "Test", row_type: "standalone" }, 0);
    expect(err).toContain("sku");
  });

  it("rejects whitespace-only SKU", () => {
    const err = validateProduct({ sku: "   ", name: "Test", row_type: "standalone" }, 0);
    expect(err).toContain("sku");
  });

  it("rejects SKU longer than 50 chars", () => {
    const err = validateProduct({ sku: "A".repeat(51), name: "Test", row_type: "standalone" }, 0);
    expect(err).toContain("sku");
    expect(err).toContain("50");
  });

  it("accepts SKU of exactly 50 chars", () => {
    const err = validateProduct({ sku: "A".repeat(50), name: "Test", row_type: "standalone" }, 0);
    expect(err).toBeNull();
  });

  it("rejects non-string SKU", () => {
    const err = validateProduct({ sku: 12345, name: "Test", row_type: "standalone" }, 0);
    expect(err).toContain("sku");
  });
});

// ── Name validation ──

describe("name field validation", () => {
  it("rejects empty name", () => {
    const err = validateProduct({ sku: "SKU-1", name: "", row_type: "standalone" }, 0);
    expect(err).toContain("name");
  });

  it("rejects name longer than 255 chars", () => {
    const err = validateProduct({ sku: "SKU-1", name: "N".repeat(256), row_type: "standalone" }, 0);
    expect(err).toContain("name");
  });

  it("accepts name of exactly 255 chars", () => {
    const err = validateProduct({ sku: "SKU-1", name: "N".repeat(255), row_type: "standalone" }, 0);
    expect(err).toBeNull();
  });
});

// ── row_type validation ──

describe("row_type validation", () => {
  it("accepts 'parent'", () => {
    const err = validateProduct({ sku: "SKU-1", name: "Test", row_type: "parent" }, 0);
    expect(err).toBeNull();
  });

  it("accepts 'variant'", () => {
    const err = validateProduct({ sku: "SKU-1", name: "Test", row_type: "variant" }, 0);
    expect(err).toBeNull();
  });

  it("accepts 'standalone'", () => {
    const err = validateProduct({ sku: "SKU-1", name: "Test", row_type: "standalone" }, 0);
    expect(err).toBeNull();
  });

  it("rejects unknown row_type", () => {
    const err = validateProduct({ sku: "SKU-1", name: "Test", row_type: "bundle" }, 0);
    expect(err).toContain("row_type");
  });

  it("rejects missing row_type", () => {
    const err = validateProduct({ sku: "SKU-1", name: "Test" }, 0);
    expect(err).toContain("row_type");
  });

  it("rejects empty string row_type", () => {
    const err = validateProduct({ sku: "SKU-1", name: "Test", row_type: "" }, 0);
    expect(err).toContain("row_type");
  });
});

// ── Optional field validation ──

describe("optional field validation", () => {
  it("accepts null category", () => {
    const err = validateProduct({ sku: "SKU-1", name: "Test", row_type: "standalone", category: null }, 0);
    expect(err).toBeNull();
  });

  it("accepts undefined category", () => {
    const err = validateProduct({ sku: "SKU-1", name: "Test", row_type: "standalone" }, 0);
    expect(err).toBeNull();
  });

  it("rejects category longer than 100 chars", () => {
    const err = validateProduct({ sku: "SKU-1", name: "Test", row_type: "standalone", category: "C".repeat(101) }, 0);
    expect(err).toContain("category");
  });

  it("accepts category of exactly 100 chars", () => {
    const err = validateProduct({ sku: "SKU-1", name: "Test", row_type: "standalone", category: "C".repeat(100) }, 0);
    expect(err).toBeNull();
  });

  it("rejects description longer than 2000 chars", () => {
    const err = validateProduct({ sku: "SKU-1", name: "Test", row_type: "standalone", description: "D".repeat(2001) }, 0);
    expect(err).toContain("description");
  });

  it("accepts description of exactly 2000 chars", () => {
    const err = validateProduct({ sku: "SKU-1", name: "Test", row_type: "standalone", description: "D".repeat(2000) }, 0);
    expect(err).toBeNull();
  });

  it("rejects numeric category", () => {
    const err = validateProduct({ sku: "SKU-1", name: "Test", row_type: "standalone", category: 123 }, 0);
    expect(err).toContain("category");
  });
});

// ── Error cap at 10 ──

describe("error accumulation cap", () => {
  it("caps errors at 10 with trailing message", () => {
    const products = Array.from({ length: 15 }, () => ({
      sku: "", name: "", row_type: "invalid",
    }));
    const errors = validateBatch(products);
    expect(errors.length).toBeLessThanOrEqual(11);
    expect(errors[errors.length - 1]).toBe("...and more errors");
  });
});

// ── Non-object items ──

describe("non-object item validation", () => {
  it("rejects null item", () => {
    const err = validateProduct(null, 0);
    expect(err).toContain("not an object");
  });

  it("rejects string item", () => {
    const err = validateProduct("not-a-product", 0);
    expect(err).toContain("not an object");
  });

  it("rejects number item", () => {
    const err = validateProduct(42, 0);
    expect(err).toContain("not an object");
  });
});
