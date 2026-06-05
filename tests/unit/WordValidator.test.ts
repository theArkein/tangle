import { describe, it, expect } from "vitest";
import { validate } from "../../src/modules/WordValidator";
import type { Dictionary } from "../../src/modules/WordValidator";

class MemoryDictionary implements Dictionary {
  private words: Set<string>;
  constructor(words: string[]) {
    this.words = new Set(words.map((w) => w.toLowerCase()));
  }
  async has(word: string): Promise<boolean> {
    return this.words.has(word);
  }
}

describe("WordValidator.validate", () => {
  it("accepts a valid word", async () => {
    const dict = new MemoryDictionary(["apple"]);
    const result = await validate("apple", "a", new Set(), dict);
    expect(result).toEqual({ valid: true });
  });

  it("rejects a word with the wrong starting letter", async () => {
    const dict = new MemoryDictionary(["banana"]);
    const result = await validate("banana", "a", new Set(), dict);
    expect(result).toEqual({ valid: false, reason: "wrong_start" });
  });

  it("rejects a word not in the dictionary", async () => {
    const dict = new MemoryDictionary([]);
    const result = await validate("apple", "a", new Set(), dict);
    expect(result).toEqual({ valid: false, reason: "not_in_dictionary" });
  });

  it("rejects a word already in usedWords", async () => {
    const dict = new MemoryDictionary(["apple"]);
    const result = await validate("apple", "a", new Set(["apple"]), dict);
    expect(result).toEqual({ valid: false, reason: "duplicate" });
  });

  it("accepts 'TIGER' when requiredLetter is 't' and dict has 'tiger' (case-insensitive input)", async () => {
    const dict = new MemoryDictionary(["tiger"]);
    const result = await validate("TIGER", "t", new Set(), dict);
    expect(result).toEqual({ valid: true });
  });

  it("rejects 'Tiger' as duplicate when usedWords contains 'tiger'", async () => {
    const dict = new MemoryDictionary(["tiger"]);
    const result = await validate("Tiger", "t", new Set(["tiger"]), dict);
    expect(result).toEqual({ valid: false, reason: "duplicate" });
  });
});
