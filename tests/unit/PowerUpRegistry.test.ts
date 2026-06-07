import { describe, it, expect } from "vitest";
import {
  REGISTRY,
  getDefinition,
  definitionsForCategory,
} from "../../src/modules/powerups";
import { pickFromCategory, RARITY_WEIGHTS, TRIGGER_CATEGORY } from "../../src/modules/powerups/pools";

describe("Power-up registry", () => {
  it("contains the four Phase 1 power-ups", () => {
    const ids = REGISTRY.map((d) => d.id).sort();
    expect(ids).toEqual(["block", "freeze", "letterBomb", "secondLife"]);
  });

  it("has unique ids", () => {
    const ids = REGISTRY.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every definition has required fields", () => {
    for (const d of REGISTRY) {
      expect(typeof d.id).toBe("string");
      expect(typeof d.name).toBe("string");
      expect(["defensive", "offensive", "disruption", "chaos"]).toContain(d.category);
      expect(["common", "uncommon", "rare"]).toContain(d.rarity);
      expect(typeof d.description).toBe("string");
    }
  });

  it("getDefinition returns the matching record", () => {
    expect(getDefinition("freeze")?.name).toBe("Freeze");
    expect(getDefinition("nonexistent" as never)).toBeUndefined();
  });

  it("definitionsForCategory returns only matching definitions", () => {
    const defensive = definitionsForCategory("defensive").map((d) => d.id);
    expect(defensive).toContain("freeze");
    expect(defensive).toContain("secondLife");
    expect(defensive).not.toContain("letterBomb");
  });
});

describe("pools.pickFromCategory", () => {
  it("never returns a definition from a different category", () => {
    const samples = 50;
    for (let i = 0; i < samples; i++) {
      const def = pickFromCategory("offensive", Math.random);
      expect(def?.category).toBe("offensive");
    }
  });

  it("returns the first matching definition with rng=0", () => {
    const def = pickFromCategory("defensive", () => 0);
    expect(def?.id).toBe("freeze");
  });

  it("respects rarity weights — common pool is dominant in Phase 1", () => {
    // In Phase 1 all entries are 'common', so this is a sanity check that the
    // weighting machinery does not return undefined or off-category items.
    let count = 0;
    for (let i = 0; i < 100; i++) {
      const def = pickFromCategory(TRIGGER_CATEGORY.score_threshold, Math.random);
      if (def && RARITY_WEIGHTS[def.rarity] > 0) count++;
    }
    expect(count).toBe(100);
  });
});
