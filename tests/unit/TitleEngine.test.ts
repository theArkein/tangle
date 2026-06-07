import { describe, it, expect } from "vitest";
import { titleForWins, titleProgress } from "../../src/modules/TitleEngine";

describe("TitleEngine.titleForWins", () => {
  it("returns Apprentice at 0 wins", () => {
    expect(titleForWins(0)).toBe("Apprentice");
  });

  it("stays Apprentice at 9 wins", () => {
    expect(titleForWins(9)).toBe("Apprentice");
  });

  it("promotes to Word Slinger exactly at 10 wins", () => {
    expect(titleForWins(10)).toBe("Word Slinger");
  });

  it("stays Word Slinger at 49 wins", () => {
    expect(titleForWins(49)).toBe("Word Slinger");
  });

  it("promotes to Chain Forger at 50 wins", () => {
    expect(titleForWins(50)).toBe("Chain Forger");
  });

  it("promotes to Wordsmith at 200 wins", () => {
    expect(titleForWins(200)).toBe("Wordsmith");
  });

  it("promotes to Chain Lord at 500 wins", () => {
    expect(titleForWins(500)).toBe("Chain Lord");
  });

  it("promotes to Lexicon at 1000 wins", () => {
    expect(titleForWins(1000)).toBe("Lexicon");
  });

  it("stays Lexicon beyond 1000 wins", () => {
    expect(titleForWins(5000)).toBe("Lexicon");
  });
});

describe("TitleEngine.titleProgress", () => {
  it("returns next title and remaining wins at Apprentice", () => {
    const p = titleProgress(3);
    expect(p.current).toBe("Apprentice");
    expect(p.next).toBe("Word Slinger");
    expect(p.winsToNext).toBe(7);
  });

  it("returns 0 winsToNext exactly at the threshold-before-promotion", () => {
    const p = titleProgress(10);
    expect(p.current).toBe("Word Slinger");
    expect(p.next).toBe("Chain Forger");
    expect(p.winsToNext).toBe(40);
  });

  it("returns no next at Lexicon (terminal title)", () => {
    const p = titleProgress(1500);
    expect(p.current).toBe("Lexicon");
    expect(p.next).toBeUndefined();
    expect(p.winsToNext).toBeUndefined();
  });
});
