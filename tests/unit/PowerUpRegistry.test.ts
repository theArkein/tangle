import { describe, it, expect } from "vitest";
import {
  REGISTRY,
  getDefinition,
} from "../../src/modules/powerups";

describe("Power-up registry", () => {
  it("contains exactly the 7 new power-ups", () => {
    const ids = REGISTRY.map((d) => d.id).sort();
    expect(ids).toEqual([
      "anchor",
      "double",
      "extend",
      "letterBomb",
      "secondLife",
      "tax",
      "wild",
    ]);
  });

  it("has at least one definition in each category", () => {
    const categories = new Set(REGISTRY.map((d) => d.category));
    expect(categories.has("defensive")).toBe(true);
    expect(categories.has("offensive")).toBe(true);
    expect(categories.has("disruption")).toBe(true);
  });

  it("has unique ids", () => {
    const ids = REGISTRY.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every definition has required fields", () => {
    for (const d of REGISTRY) {
      expect(typeof d.id).toBe("string");
      expect(typeof d.name).toBe("string");
      expect(["defensive", "offensive", "disruption"]).toContain(d.category);
      expect(typeof d.description).toBe("string");
    }
  });

  it("getDefinition returns the matching record", () => {
    expect(getDefinition("extend")?.name).toBe("Extend");
    expect(getDefinition("nonexistent" as never)).toBeUndefined();
  });
});
