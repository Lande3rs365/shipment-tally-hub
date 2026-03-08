import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn (className utility)", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("deduplicates conflicting Tailwind classes (last wins)", () => {
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("handles undefined and null gracefully", () => {
    expect(cn("base", undefined, null as any)).toBe("base");
  });

  it("returns empty string when no classes", () => {
    expect(cn()).toBe("");
  });

  it("handles array of classes", () => {
    expect(cn(["foo", "bar"])).toBe("foo bar");
  });

  it("handles object syntax", () => {
    expect(cn({ "text-bold": true, "text-italic": false })).toBe("text-bold");
  });

  it("merges padding classes correctly", () => {
    expect(cn("p-4", "px-2")).toBe("p-4 px-2");
  });
});
