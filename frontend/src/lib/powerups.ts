// Single source of truth for power-up display data on the frontend.
//
// The worker holds the canonical power-up registry in src/modules/powerups/.
// Display-only metadata (emoji, "How it works" paragraph, example scenarios)
// lives here so the guide and the in-game HUD stay in sync.
//
// The mechanical-correctness contract (id, name, description must match the
// worker registry verbatim) is enforced by tests/unit/PowerUpGuideContent.test.ts.

export type PowerUpId =
  | 'freeze'
  | 'secondLife'
  | 'letterBomb'
  | 'block'
  | 'swap'
  | 'blind'
  | 'shrink'
  | 'rush'
  | 'steal'
  | 'peek'
  | 'blitz'
  | 'wildfire'

export type PowerUpCategory = 'defensive' | 'offensive' | 'disruption' | 'chaos'
export type PowerUpRarity = 'common' | 'uncommon' | 'rare'

export const POWER_UP_LABELS: Record<PowerUpId, { name: string; emoji: string }> = {
  freeze: { name: 'Freeze', emoji: '❄️' },
  secondLife: { name: '2nd Life', emoji: '💚' },
  letterBomb: { name: 'Letter Bomb', emoji: '💣' },
  block: { name: 'Block', emoji: '🛑' },
  swap: { name: 'Swap', emoji: '🔀' },
  blind: { name: 'Blind', emoji: '🙈' },
  shrink: { name: 'Shrink', emoji: '🤏' },
  rush: { name: 'Rush', emoji: '⚡' },
  steal: { name: 'Steal', emoji: '🪝' },
  peek: { name: 'Peek', emoji: '👁' },
  blitz: { name: 'Blitz', emoji: '⚔️' },
  wildfire: { name: 'Wildfire', emoji: '🔥' },
}

export interface PowerUpGuideEntry {
  id: PowerUpId
  // name + description match the worker registry verbatim (test-enforced).
  name: string
  description: string
  category: PowerUpCategory
  rarity: PowerUpRarity
  // Guide-only longer-form copy.
  howItWorks: string
  example: string
}

export const POWER_UP_GUIDE: PowerUpGuideEntry[] = [
  {
    id: 'freeze',
    name: 'Freeze',
    description: "Pause your opponent's timer for 5 seconds.",
    category: 'defensive',
    rarity: 'common',
    howItWorks:
      "Activate on your turn or theirs. The opponent's countdown halts for 5 seconds — buying you breathing room or stealing theirs.",
    example: 'Opponent has 2 seconds left and is typing. Freeze them; their clock holds at 2s while they scramble.',
  },
  {
    id: 'secondLife',
    name: 'Second Life',
    description: 'Survive one timeout this round without losing.',
    category: 'defensive',
    rarity: 'common',
    howItWorks:
      'Auto-activates the first time you would time out. Instead of losing the round, the timer resets and play continues. One use per round.',
    example: "You're stumped and the timer hits zero. Second Life kicks in, you get a fresh timer to find the word.",
  },
  {
    id: 'peek',
    name: 'Peek',
    description: 'See what your opponent is currently typing for one turn.',
    category: 'defensive',
    rarity: 'uncommon',
    howItWorks:
      "Activate before your opponent plays. For their next turn you see their input field update in real time as they type.",
    example: "You suspect your opponent will play a long word. Peek; you see them typing 'philosophy' and prepare your reply.",
  },
  {
    id: 'letterBomb',
    name: 'Letter Bomb',
    description: "Force opponent's next word to contain Q, X, Z, or J.",
    category: 'offensive',
    rarity: 'common',
    howItWorks:
      'Activate to drop a required letter on your opponent. One of Q/X/Z/J is randomly chosen — their next word must contain it in addition to following the chain rule.',
    example: "Chain ends in 'on'. Letter Bomb adds an X requirement; opponent must find a word starting with 'n' that contains X.",
  },
  {
    id: 'block',
    name: 'Block',
    description: "Reject opponent's last word. They must replay with a different word, time preserved.",
    category: 'offensive',
    rarity: 'common',
    howItWorks:
      "Activate during the opponent's turn after they have submitted. The chain rolls back, opponent picks a different word, their remaining time carries over.",
    example: "Opponent plays 'apple'. You Block it. They must find a different word from the same prompt.",
  },
  {
    id: 'shrink',
    name: 'Shrink',
    description: "Opponent's next word must be 4 letters or fewer.",
    category: 'offensive',
    rarity: 'uncommon',
    howItWorks:
      "Activate before opponent's turn. Their next word is capped at 4 letters — limits their points and forces compact words.",
    example: "Chain ends in 'an'. Shrink applied; opponent must find a 1-4 letter word starting with 'n'.",
  },
  {
    id: 'swap',
    name: 'Swap',
    description: 'Change the next required letter to one of your choice. Consumes your turn.',
    category: 'offensive',
    rarity: 'uncommon',
    howItWorks:
      "On your turn, activate and pick any letter a–z. The chain hint changes to that letter, but you forfeit your own play this turn. Opponent now starts from the new letter.",
    example: "Chain ends in 'qz'. You Swap to 'a'; opponent now plays a word starting with 'a' instead.",
  },
  {
    id: 'rush',
    name: 'Rush',
    description: "Cut opponent's timer in half for their next turn.",
    category: 'offensive',
    rarity: 'uncommon',
    howItWorks:
      'Activate before opponent plays. Their next turn timer is halved (30s instead of 60s in Classic).',
    example: 'You activate Rush at the start of opponent\'s turn. They scramble with only 30 seconds.',
  },
  {
    id: 'blind',
    name: 'Blind',
    description: 'Hide the chain from your opponent for 2 turns.',
    category: 'disruption',
    rarity: 'uncommon',
    howItWorks:
      "For the opponent's next 2 turns, the chain history is hidden behind dots. They only see the seed letter hint, not what's been played.",
    example: "Opponent can't see what was played, so they must guess the chain ending from the seed letter alone.",
  },
  {
    id: 'steal',
    name: 'Steal',
    description: "Take opponent's last word and add its points to your score.",
    category: 'disruption',
    rarity: 'rare',
    howItWorks:
      "Activate on your turn. Opponent's last word is removed from their score and credited to yours. The chain rolls back so you play from the previous word.",
    example: 'Opponent just scored 13 points on "elephant". Steal — you gain 13, they lose 13, chain now ends in the word before "elephant".',
  },
  {
    id: 'blitz',
    name: 'Blitz',
    description: "Play two words in a row, skipping opponent's turn.",
    category: 'disruption',
    rarity: 'rare',
    howItWorks:
      "After playing a word this turn, activate Blitz; the turn does not pass. You play another word starting from the chain rule, then play returns to opponent.",
    example: 'You play "elephant" (13 pts). Blitz — instead of opponent\'s turn, you also play "tangent" (10 pts).',
  },
  {
    id: 'wildfire',
    name: 'Wildfire',
    description: 'All words score 3× for both players for the next 3 turns.',
    category: 'chaos',
    rarity: 'rare',
    howItWorks:
      "For the next 3 turns (yours and theirs combined), every word's points are tripled. Affects both sides — high-risk, high-reward.",
    example: 'A 5-point word becomes 15. Long words and rare-letter plays during Wildfire can swing a round.',
  },
]

// Drop trigger configuration. Values match the worker side
// (src/modules/powerups/pools.ts and src/modules/PowerUpEngine.ts).
export const DROP_TRIGGERS = [
  {
    id: 'score_threshold' as const,
    emoji: '📈',
    title: 'Score threshold',
    detail: 'Every 15 points of round score crosses a threshold.',
    pool: 'Defensive' as const,
    cap: 'Unlimited (a single big word can pop multiple).',
  },
  {
    id: 'rare_letter' as const,
    emoji: '🔤',
    title: 'Rare-letter word',
    detail: 'First word containing Q, X, Z, or J.',
    pool: 'Offensive' as const,
    cap: 'Once per player per round.',
  },
  {
    id: 'long_word' as const,
    emoji: '📏',
    title: 'Long word',
    detail: 'First word with 8 or more letters.',
    pool: 'Offensive' as const,
    cap: 'Once per player per round.',
  },
  {
    id: 'chain_length' as const,
    emoji: '🔗',
    title: 'Long chain',
    detail: 'Round chain reaches 10 words.',
    pool: 'Disruption' as const,
    cap: 'Once per round (shared).',
  },
]

export const RARITY_WEIGHTS = { common: 60, uncommon: 30, rare: 10 } as const

export const CATEGORY_META: Record<PowerUpCategory, { label: string; tagline: string }> = {
  defensive: { label: 'Defensive', tagline: 'Buy time and survive bad turns.' },
  offensive: { label: 'Offensive', tagline: 'Constrain your opponent.' },
  disruption: { label: 'Disruption', tagline: 'Bend the rules around the chain.' },
  chaos: { label: 'Chaos', tagline: 'Change the game for everyone.' },
}

export const GAME_MODES = {
  classic: {
    label: 'Classic Duel',
    emoji: '⚔️',
    turnTimerSec: 60,
    faultsToLose: 8,
    roundsToWinMatch: 3,
    bestOf: 'Best of 5',
    powerUpsEnabled: true,
    tagline: 'Tactical. Power-ups in play. Best of 5 rounds.',
  },
  speed_round: {
    label: 'Speed Round',
    emoji: '⚡',
    turnTimerSec: 8,
    faultsToLose: 1,
    roundsToWinMatch: 1,
    bestOf: 'Single round',
    powerUpsEnabled: false,
    tagline: 'Fast. No power-ups. One round decides it.',
  },
} as const
