// Single source of truth for power-up display data on the frontend.
//
// The worker holds the canonical power-up registry in src/modules/powerups/.
// Display-only metadata (emoji, "How it works" paragraph, example scenarios)
// lives here so the guide and the in-game HUD stay in sync.

export type PowerUpId =
  | 'freeze'
  | 'secondLife'
  | 'letterBomb'
  | 'double'
  | 'wild'
  | 'anchor'
  | 'tax'

export type PowerUpCategory = 'defensive' | 'offensive' | 'disruption'

export const POWER_UP_LABELS: Record<PowerUpId, { name: string; emoji: string }> = {
  freeze: { name: 'Freeze', emoji: '❄️' },
  secondLife: { name: '2nd Life', emoji: '💚' },
  letterBomb: { name: 'Letter Bomb', emoji: '💣' },
  double: { name: 'Double', emoji: '🎯' },
  wild: { name: 'Wild', emoji: '🃏' },
  anchor: { name: 'Anchor', emoji: '⚓' },
  tax: { name: 'Tax', emoji: '💸' },
}

export interface PowerUpGuideEntry {
  id: PowerUpId
  name: string
  description: string
  category: PowerUpCategory
  // Guide-only longer-form copy.
  howItWorks: string
  example: string
  // Shown in the toast when the OPPONENT earns this power-up.
  opponentDescription: string
}

export const POWER_UP_GUIDE: PowerUpGuideEntry[] = [
  {
    id: 'freeze',
    name: 'Freeze',
    description: 'Add 5 seconds to your own turn timer.',
    opponentDescription: 'They gained 5 extra seconds on their timer.',
    category: 'defensive',
    howItWorks:
      'Instantly extends your current turn timer by 5 seconds. Use it when you need a little more time to find the right word.',
    example: "You have 3 seconds left and almost have a word. Freeze — your timer extends to 8 seconds.",
  },
  {
    id: 'secondLife',
    name: 'Second Life',
    description: 'Resets your turn timer to 25s (10s in Danger Zone). Auto-activates on timeout.',
    opponentDescription: 'They have a Second Life that will save them from one timeout.',
    category: 'defensive',
    howItWorks:
      'Auto-activates if your timer hits zero — you keep playing instead of losing the round. Can also be manually activated anytime to get a fresh 25-second timer.',
    example: "Your timer hits zero. Second Life kicks in automatically — you get a full 25-second reset.",
  },
  {
    id: 'letterBomb',
    name: 'Letter Bomb',
    description: "Force opponent's next word to contain Q, X, Z, or J.",
    opponentDescription: 'Your next word must contain Q, X, Z, or J.',
    category: 'offensive',
    howItWorks:
      'A random hard letter (Q, X, Z, or J) is dropped on the opponent. Their next word must contain it, on top of the usual chain rule.',
    example: "Chain ends in 'on'. Letter Bomb picks X — opponent must play a word starting with 'n' that contains X.",
  },
  {
    id: 'double',
    name: 'Double',
    description: 'Your next 3 words each score 2×. Does not stack with Danger Zone.',
    opponentDescription: 'Their next 3 words will score double points.',
    category: 'offensive',
    howItWorks:
      'Activate on your turn. For each of your next 3 word submissions, the score is doubled. Does not stack with Danger Zone (DZ multiplier takes precedence).',
    example: 'You play "junction" (9 pts). With Double active, it scores 18 pts. Two more double words to go.',
  },
  {
    id: 'wild',
    name: 'Wild',
    description: "Your next word can start with any letter, ignoring the chain rule.",
    opponentDescription: 'They can play any word on their next turn, ignoring the chain rule.',
    category: 'disruption',
    howItWorks:
      "Activate on your turn. Your next word submission ignores the 'must start with X' chain rule. After that word, the chain continues from its last letter as normal.",
    example: "Chain requires 'qz'. Wild — you play 'magnet' instead, chain now requires 't'.",
  },
  {
    id: 'anchor',
    name: 'Anchor',
    description: "Opponent's next word must be 6 or more letters.",
    opponentDescription: 'Your next word must be 6 or more letters.',
    category: 'offensive',
    howItWorks:
      "Activate on your turn. Opponent's next word submission must be at least 6 letters long. Short words will be rejected until they find a qualifying word.",
    example: "Chain ends in 'an'. Anchor applied — opponent must find a word starting with 'n' with 6+ letters.",
  },
  {
    id: 'tax',
    name: 'Tax',
    description: 'Reduce opponent\'s current round score by 10 points (minimum 0).',
    opponentDescription: "They can cut 10 points from your current round score.",
    category: 'offensive',
    howItWorks:
      "Instant effect. Deducts 10 points from the opponent's current round score, floored at 0. Changes the score gap immediately.",
    example: "Opponent has 47 round points. Tax — they drop to 37. You're now 10 points closer to the 59-point win gap.",
  },
]

export const CATEGORY_META: Record<PowerUpCategory, { label: string; tagline: string }> = {
  defensive: { label: 'Defensive', tagline: 'Buy time and survive bad turns.' },
  offensive: { label: 'Offensive', tagline: 'Constrain your opponent.' },
  disruption: { label: 'Disruption', tagline: 'Bend the rules around the chain.' },
}

// Deterministic earning triggers — each trigger always earns one specific power-up.
export const EARN_TRIGGERS = [
  { powerup: 'freeze' as PowerUpId, emoji: '❄️', trigger: 'Every 25 points you score', notes: 'Unlimited' },
  { powerup: 'double' as PowerUpId, emoji: '🎯', trigger: '10+ letter word', notes: 'Any time' },
  { powerup: 'letterBomb' as PowerUpId, emoji: '💣', trigger: 'Word contains Q, X, Z, or J', notes: 'Any time' },
  { powerup: 'anchor' as PowerUpId, emoji: '⚓', trigger: '8+ letter word', notes: 'Any time' },
  { powerup: 'tax' as PowerUpId, emoji: '💸', trigger: 'Any word in Danger Zone', notes: 'Any time in DZ' },
  { powerup: 'wild' as PowerUpId, emoji: '🃏', trigger: 'Every 6 words you play', notes: '6, 12, 18...' },
  { powerup: 'secondLife' as PowerUpId, emoji: '💚', trigger: 'Word scores 15+ pts, uses 4+ distinct vowels, or contains 2+ rare letter tiers', notes: '3 paths + DZ entry' },
] as const

export const GAME_MODES = {
  duel: {
    label: 'Duel',
    emoji: '⚔️',
    turnTimerSec: 25,
    roundsToWinMatch: 3,
    bestOf: 'Best of 5',
    powerUpsEnabled: true,
    tagline: 'Tactical. Power-ups in play. Win a round by 59 points.',
  },
  classic: {
    label: 'Classic',
    emoji: '⚡',
    turnTimerSec: 8,
    roundsToWinMatch: 1,
    bestOf: 'Single round',
    powerUpsEnabled: false,
    tagline: 'Fast. No power-ups. One round — survive the timer.',
  },
} as const
