import { describe, it, expect } from "vitest";
import { REGISTRY } from "../../src/modules/powerups";
import { POWER_UP_GUIDE, POWER_UP_LABELS } from "../../frontend/src/lib/powerups";

// The frontend guide hand-authors longer-form text (howItWorks, example) but
// the id / name / description fields must match the worker registry exactly.
describe("Power-up guide vs worker registry", () => {
  it("covers every registry power-up exactly once", () => {
    const registryIds = REGISTRY.map((d) => d.id).sort();
    const guideIds = POWER_UP_GUIDE.map((e) => e.id).sort();
    expect(guideIds).toEqual(registryIds);
  });

  it("name and description match the registry verbatim", () => {
    for (const entry of POWER_UP_GUIDE) {
      const def = REGISTRY.find((d) => d.id === entry.id);
      expect(def, `registry definition for ${entry.id}`).toBeDefined();
      expect(entry.name, `name for ${entry.id}`).toBe(def!.name);
      expect(entry.description, `description for ${entry.id}`).toBe(def!.description);
      expect(entry.category, `category for ${entry.id}`).toBe(def!.category);
    }
  });

  it("every power-up has a display emoji and label", () => {
    for (const entry of POWER_UP_GUIDE) {
      const label = POWER_UP_LABELS[entry.id];
      expect(label).toBeDefined();
      expect(label.emoji.length).toBeGreaterThan(0);
      expect(label.name.length).toBeGreaterThan(0);
    }
  });

  it("guide-only text is non-empty for every entry", () => {
    for (const entry of POWER_UP_GUIDE) {
      expect(entry.howItWorks.length, `howItWorks for ${entry.id}`).toBeGreaterThan(20);
      expect(entry.example.length, `example for ${entry.id}`).toBeGreaterThan(20);
    }
  });
});
