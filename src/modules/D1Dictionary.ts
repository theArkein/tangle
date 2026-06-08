import type { Dictionary } from "./WordValidator";

export class D1Dictionary implements Dictionary {
  constructor(private db: D1Database) {}
  async has(word: string): Promise<boolean> {
    const result = await this.db
      .prepare("SELECT 1 FROM dictionary WHERE word = ?")
      .bind(word)
      .first();
    return result !== null;
  }

  async pickWord(startsWith: string, excluded: Set<string>): Promise<string | null> {
    const rows = await this.db
      .prepare("SELECT word FROM dictionary WHERE word LIKE ? LIMIT 100")
      .bind(startsWith.toLowerCase() + "%")
      .all<{ word: string }>();
    const candidates = (rows.results ?? []).map((r) => r.word).filter((w) => !excluded.has(w));
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
  }
}
