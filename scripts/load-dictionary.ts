import { writeFileSync } from "fs";
import { join } from "path";

const WORD_LIST_URL =
  "https://raw.githubusercontent.com/lorenbrichter/Words/master/Words/en.txt";
const BATCH_SIZE = 500;
const OUTPUT_PATH = join(import.meta.dirname, "../migrations/0002_dictionary_seed.sql");

async function main(): Promise<void> {
  console.log(`Fetching word list from ${WORD_LIST_URL}...`);
  const response = await fetch(WORD_LIST_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch word list: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  const words = text
    .split("\n")
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length > 0);

  console.log(`Fetched ${words.length} words. Generating SQL...`);

  const statements: string[] = [];
  for (let i = 0; i < words.length; i += BATCH_SIZE) {
    const batch = words.slice(i, i + BATCH_SIZE);
    const values = batch.map((w) => `('${w.replace(/'/g, "''")}')`).join(",");
    statements.push(`INSERT OR IGNORE INTO dictionary (word) VALUES ${values};`);

    if ((i + BATCH_SIZE) % 10000 === 0 || i + BATCH_SIZE >= words.length) {
      console.log(`  Processed ${Math.min(i + BATCH_SIZE, words.length)} / ${words.length} words...`);
    }
  }

  const sql = statements.join("\n") + "\n";
  writeFileSync(OUTPUT_PATH, sql, "utf8");

  console.log(`Done. Written ${words.length} words to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
