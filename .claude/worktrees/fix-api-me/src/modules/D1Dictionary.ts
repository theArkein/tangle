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
}
