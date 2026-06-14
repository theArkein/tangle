// Single source of truth for power-up display data on the frontend.
//
// The worker holds the canonical power-up registry in src/modules/powerups/.
// Display-only metadata (emoji, "How it works" paragraph, example scenarios)
// lives here so the guide and the in-game HUD stay in sync.

export type PowerUpId =
  | 'extend'
  | 'secondLife'
  | 'letterBomb'
  | 'double'
  | 'wild'
  | 'anchor'

export type PowerUpCategory = 'defensive' | 'offensive' | 'disruption'

export const POWER_UP_LABELS: Record<PowerUpId, { name: string; emoji: string }> = {
  extend: { name: 'Extend', emoji: '⏳' },
  secondLife: { name: '2nd Life', emoji: '💚' },
  letterBomb: { name: 'Letter Bomb', emoji: '💣' },
  double: { name: 'Double', emoji: '🎯' },
  wild: { name: 'Wild', emoji: '🃏' },
  anchor: { name: 'Anchor', emoji: '⚓' },
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
    id: 'extend',
    name: 'Extend',
    description: 'Add 5 seconds to your own turn timer.',
    opponentDescription: 'They gained 5 extra seconds on their timer.',
    category: 'defensive',
    howItWorks:
      'Instantly extends your current turn timer by 5 seconds. Use it when you need a little more time to find the right word.',
    example: "You have 3 seconds left and almost have a word. Extend — your timer grows to 8 seconds.",
  },
  {
    id: 'secondLife',
    name: 'Second Life',
    description: 'Arm a shield — if your turn timer runs out, it resets once (25s, or 10s in Danger Zone) instead of timing out.',
    opponentDescription: 'They have a Second Life shield that can save them from one timeout.',
    category: 'defensive',
    howItWorks:
      'Tap to arm the shield — your timer is NOT reset right away. If your turn timer later runs out, the shield is consumed to reset it once (25s, or 10s in Danger Zone) instead of you timing out.',
    example: "You arm Second Life, then run out of time searching for a word. Instead of forfeiting your turn, your timer resets and you keep playing.",
  },
  {
    id: 'letterBomb',
    name: 'Letter Bomb',
    description: 'Force opponent\'s next word to contain any rare letter (Q/X/Z/J/V/K/W/F/H/Y/B).',
    opponentDescription: 'Your next word must contain any rare letter (Q/X/Z/J/V/K/W/F/H/Y/B).',
    category: 'offensive',
    howItWorks:
      "Opponent's next word must include at least one rare letter from any tier. Tier 1: Q/X/Z/J. Tier 2: V/K/W. Tier 3: F/H/Y/B.",
    example: "Chain ends in 'on'. Letter Bomb — opponent must play a word starting with 'n' that contains any rare letter.",
  },
  {
    id: 'double',
    name: 'Double',
    description: 'Your next 2 words each score 2×. Does not stack with Danger Zone.',
    opponentDescription: 'Their next 2 words will score double points.',
    category: 'offensive',
    howItWorks:
      'Activate on your turn. For each of your next 2 word submissions, the score is doubled. Does not stack with Danger Zone (DZ multiplier takes precedence).',
    example: 'You play "junction" (9 pts). With Double active, it scores 18 pts. One more double word to go.',
  },
  {
    id: 'wild',
    name: 'Wild',
    description: "Your next word can start with any letter, ignoring the chain rule.",
    opponentDescription: 'They can play any word on their next turn, ignoring the chain rule.',
    category: 'disruption',
    howItWorks:
      "Activate on your turn. Your next word submission ignores the 'must start with X' chain rule. After that word, the chain continues from its last letter as normal.",
    example: "Chain requires 'z'. Wild — you play 'magnet' instead, chain now requires 't'.",
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
]

export const CATEGORY_META: Record<PowerUpCategory, { label: string; tagline: string }> = {
  defensive: { label: 'Defensive', tagline: 'Buy time and survive bad turns.' },
  offensive: { label: 'Offensive', tagline: 'Constrain your opponent.' },
  disruption: { label: 'Disruption', tagline: 'Bend the rules around the chain.' },
}

// Deterministic earning triggers — each trigger always earns one specific power-up.
export const EARN_TRIGGERS = [
  { powerup: 'extend' as PowerUpId, emoji: '⏳', trigger: 'Every 25 points you score', notes: 'Unlimited' },
  { powerup: 'double' as PowerUpId, emoji: '🎯', trigger: '10+ letter word', notes: 'Any time' },
  { powerup: 'letterBomb' as PowerUpId, emoji: '💣', trigger: 'Word contains Q, X, Z, or J', notes: 'Any time' },
  { powerup: 'anchor' as PowerUpId, emoji: '⚓', trigger: '8+ letter word', notes: 'Any time' },
  { powerup: 'wild' as PowerUpId, emoji: '🃏', trigger: 'Word starts and ends with same letter', notes: 'e.g., eagle, radar' },
  { powerup: 'secondLife' as PowerUpId, emoji: '💚', trigger: 'Word scores >15 pts or entering Danger Zone', notes: '2 paths' },
] as const

export const GAME_MODES = {
  duel: {
    label: 'Duel',
    emoji: '⚔️',
    turnTimerSec: 25,
    roundsToWinMatch: 3,
    bestOf: 'Open-ended',
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
