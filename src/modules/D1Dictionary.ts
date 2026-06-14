import type { Dictionary } from "./WordValidator";

// Mirrors RARE_LETTERS_ALL in WordValidator — used to pick a Letter-Bomb-compliant
// word for the bot.
const RARE_LETTERS = new Set(["q", "x", "z", "j", "v", "k", "w", "f", "h", "y", "b"]);

export class D1Dictionary implements Dictionary {
  constructor(private db: D1Database) {}
  async has(word: string): Promise<boolean> {
    const result = await this.db
      .prepare("SELECT 1 FROM dictionary WHERE word = ?")
      .bind(word)
      .first();
    return result !== null;
  }

  async pickWord(
    startsWith: string,
    excluded: Set<string>,
    options: { requiredAnyRareLetter?: boolean | undefined; minLength?: number | undefined } = {}
  ): Promise<string | null> {
    // Pull a larger sample when constrained so the bot can still find a
    // compliant word; LENGTH is filtered in SQL, rare letter in JS.
    const constrained = options.requiredAnyRareLetter || options.minLength;
    const limit = constrained ? 500 : 100;
    let sql = "SELECT word FROM dictionary WHERE word LIKE ?";
    const binds: (string | number)[] = [startsWith.toLowerCase() + "%"];
    if (options.minLength && options.minLength > 0) {
      sql += " AND LENGTH(word) >= ?";
      binds.push(options.minLength);
    }
    sql += ` LIMIT ${limit}`;

    const rows = await this.db.prepare(sql).bind(...binds).all<{ word: string }>();
    let candidates = (rows.results ?? []).map((r) => r.word).filter((w) => !excluded.has(w));
    if (options.requiredAnyRareLetter) {
      candidates = candidates.filter((w) => [...w].some((c) => RARE_LETTERS.has(c)));
    }
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
  }
}
