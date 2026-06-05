CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  elo INTEGER NOT NULL DEFAULT 1000,
  created_at INTEGER NOT NULL,
  linked_oauth_provider TEXT
);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  player1_id TEXT NOT NULL,
  player2_id TEXT NOT NULL,
  winner_id TEXT,
  round_scores TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS match_words (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL,
  round_number INTEGER NOT NULL,
  turn_order INTEGER NOT NULL,
  word TEXT NOT NULL,
  player_id TEXT NOT NULL,
  points INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS dictionary (
  word TEXT PRIMARY KEY
);
