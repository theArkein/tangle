'use client'

import Link from 'next/link'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import WordPill from '@/components/ui/WordPill'
import {
  POWER_UP_GUIDE,
  POWER_UP_LABELS,
  CATEGORY_META,
  EARN_TRIGGERS,
  GAME_MODES,
  type PowerUpCategory,
  type PowerUpGuideEntry,
} from '@/lib/powerups'

const SECTIONS: Array<{ id: string; label: string }> = [
  { id: 'basics', label: 'Basics' },
  { id: 'scoring', label: 'Scoring' },
  { id: 'powerups', label: 'Power-ups' },
  { id: 'earning', label: 'Earning' },
  { id: 'modes', label: 'Modes' },
]

const SectionTitle = ({ id, children, eyebrow }: { id: string; children: string; eyebrow?: string }) => (
  <div id={id} style={{ scrollMarginTop: 80, marginBottom: 16 }}>
    {eyebrow && (
      <div
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--n400)',
          marginBottom: 6,
        }}
      >
        {eyebrow}
      </div>
    )}
    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--n900)', margin: 0 }}>{children}</h2>
  </div>
)

function PowerUpCard({ entry }: { entry: PowerUpGuideEntry }) {
  const emoji = POWER_UP_LABELS[entry.id].emoji
  return (
    <Card style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
        <div
          style={{
            fontSize: 26,
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--n50)',
            borderRadius: 'var(--radius-md)',
            flexShrink: 0,
          }}
        >
          {emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 15, color: 'var(--n900)' }}>
              {entry.name}
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--n400)',
                background: 'var(--n100)',
                padding: '2px 6px',
                borderRadius: 'var(--radius-full)',
              }}
            >
              {entry.category}
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--n500)', marginTop: 2 }}>{entry.description}</div>
        </div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--n700)', lineHeight: 1.5, marginTop: 10 }}>{entry.howItWorks}</div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--n500)',
          marginTop: 10,
          padding: '8px 10px',
          background: 'var(--n50)',
          borderRadius: 'var(--radius-md)',
          fontStyle: 'italic',
          lineHeight: 1.5,
        }}
      >
        {entry.example}
      </div>
    </Card>
  )
}

export default function GuidePage() {
  const groupedByCategory: Record<PowerUpCategory, PowerUpGuideEntry[]> = {
    defensive: [],
    offensive: [],
    disruption: [],
  }
  for (const e of POWER_UP_GUIDE) groupedByCategory[e.category].push(e)

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px 80px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--n900)', margin: 0, lineHeight: 1.2 }}>
          How to play
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--n400)', marginTop: 6 }}>
          Everything you need to know — rules, scoring, power-ups, and how to earn them.
        </p>
      </div>

      {/* Section nav */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          marginBottom: 28,
          paddingBottom: 4,
        }}
      >
        {SECTIONS.map(s => (
          <a
            key={s.id}
            href={`#${s.id}`}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--n200)',
              background: 'var(--n0)',
              color: 'var(--n700)',
              fontFamily: 'var(--font-heading)',
              fontSize: 12,
              fontWeight: 500,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {s.label}
          </a>
        ))}
      </div>

      {/* Section 1: Basics */}
      <section style={{ marginBottom: 36 }}>
        <SectionTitle id="basics" eyebrow="01 · Basics">
          The chain rule
        </SectionTitle>
        <Card style={{ padding: 18, marginBottom: 12 }}>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--n700)', lineHeight: 1.6 }}>
            Each word must start with the <strong>last letter</strong> of the previous word. You and your opponent
            take turns adding to the chain.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <WordPill word="apple" variant="player1" />
            <span style={{ color: 'var(--n400)' }}>→</span>
            <WordPill word="elephant" variant="player2" />
            <span style={{ color: 'var(--n400)' }}>→</span>
            <WordPill word="tiger" variant="player1" />
          </div>
          <p style={{ fontSize: 12, color: 'var(--n500)', marginTop: 10, marginBottom: 0 }}>
            <strong>apple</strong> ends in <code>e</code> → <strong>elephant</strong> starts with <code>e</code>, ends
            in <code>t</code> → <strong>tiger</strong> starts with <code>t</code>.
          </p>
        </Card>
        <Card style={{ padding: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--n400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                Timer
              </div>
              <div style={{ fontSize: 13, color: 'var(--n700)' }}>
                <strong>Duel:</strong> 25s per turn. <strong>Classic:</strong> 8s per turn.
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--n400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                Round win (Duel)
              </div>
              <div style={{ fontSize: 13, color: 'var(--n700)' }}>
                Build a <strong>59-point gap</strong> over your opponent to win the round. Run out of time and you lose.
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--n400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                Format
              </div>
              <div style={{ fontSize: 13, color: 'var(--n700)' }}>
                Duel is open-ended rounds. Classic is a single round.
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--n400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                Fault penalty
              </div>
              <div style={{ fontSize: 13, color: 'var(--n700)' }}>
                Invalid word? <strong>−2 seconds</strong> from your turn timer.
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* Section 2: Scoring */}
      <section style={{ marginBottom: 36 }}>
        <SectionTitle id="scoring" eyebrow="02 · Scoring">
          How points work
        </SectionTitle>
        <Card style={{ padding: 18, marginBottom: 12 }}>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <li style={{ fontSize: 14, color: 'var(--n700)', lineHeight: 1.5 }}>
              <strong>Base:</strong> 1 point per letter.
            </li>
            <li style={{ fontSize: 14, color: 'var(--n700)', lineHeight: 1.5 }}>
              <strong>Tier 1 rare:</strong> +3 per <code>Q</code>, <code>X</code>, <code>Z</code>, or <code>J</code>.
            </li>
            <li style={{ fontSize: 14, color: 'var(--n700)', lineHeight: 1.5 }}>
              <strong>Tier 2 rare:</strong> +2 per <code>V</code>, <code>K</code>, or <code>W</code>.
            </li>
            <li style={{ fontSize: 14, color: 'var(--n700)', lineHeight: 1.5 }}>
              <strong>Tier 3 rare:</strong> +1 per <code>F</code>, <code>H</code>, <code>Y</code>, or <code>B</code>.
            </li>
            <li style={{ fontSize: 14, color: 'var(--n700)', lineHeight: 1.5 }}>
              <strong>Long word bonus:</strong> +5 if the word is 8 letters or longer.
            </li>
            <li style={{ fontSize: 14, color: 'var(--n700)', lineHeight: 1.5 }}>
              <strong>Danger Zone:</strong> 2× multiplier when the chain reaches 16+ words.
            </li>
          </ul>
        </Card>
        <Card style={{ padding: 18 }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 12, fontWeight: 600, color: 'var(--n400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Worked example
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
            <WordPill word="jazzy" variant="player1" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--n500)' }}>
              5 letters + J(+3) + Z(+3) + Z(+3) = <strong>14 pts</strong>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <WordPill word="elephant" variant="player2" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--n500)' }}>
              8 letters + long-word bonus = 8 + 5 = <strong>13 pts</strong>
            </span>
          </div>
        </Card>
      </section>

      {/* Section 3: Power-ups */}
      <section style={{ marginBottom: 36 }}>
        <SectionTitle id="powerups" eyebrow="03 · Power-ups">
          The 7 power-ups
        </SectionTitle>
        {(Object.keys(CATEGORY_META) as PowerUpCategory[]).map(cat => (
          <div key={cat} style={{ marginBottom: 22 }}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 600, color: 'var(--n900)', margin: 0 }}>
                  {CATEGORY_META[cat].label}
                </h3>
                <span style={{ fontSize: 12, color: 'var(--n400)' }}>{CATEGORY_META[cat].tagline}</span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
              {groupedByCategory[cat].map(entry => (
                <PowerUpCard key={entry.id} entry={entry} />
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Section 4: Earning */}
      <section style={{ marginBottom: 36 }}>
        <SectionTitle id="earning" eyebrow="04 · Earning">
          How to earn power-ups
        </SectionTitle>
        <Card style={{ padding: 18, marginBottom: 12 }}>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--n700)', lineHeight: 1.6 }}>
            Power-ups are earned <strong>deterministically</strong> — specific actions always earn specific power-ups.
            No randomness, no pools. Play well and you know exactly what you get.
          </p>
          <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--n500)' }}>
            Your inventory resets at the start of every round. Fresh canvas each time.
          </p>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {EARN_TRIGGERS.map(t => (
            <Card key={t.powerup} style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ fontSize: 22 }}>{t.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14, color: 'var(--n900)', marginBottom: 4 }}>
                    {POWER_UP_LABELS[t.powerup].name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--n600)', lineHeight: 1.5, marginBottom: 4 }}>{t.trigger}</div>
                  <div style={{ fontSize: 11, color: 'var(--n400)' }}>{t.notes}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Section 5: Modes */}
      <section style={{ marginBottom: 36 }}>
        <SectionTitle id="modes" eyebrow="05 · Modes">
          Duel vs Classic
        </SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {(Object.entries(GAME_MODES) as Array<[keyof typeof GAME_MODES, typeof GAME_MODES[keyof typeof GAME_MODES]]>).map(([key, m]) => (
            <Card key={key} style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 22 }}>{m.emoji}</span>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 600, color: 'var(--n900)' }}>
                  {m.label}
                </div>
              </div>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--n500)' }}>{m.tagline}</p>
              <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 12, rowGap: 6, fontSize: 13 }}>
                <dt style={{ color: 'var(--n400)' }}>Turn timer</dt>
                <dd style={{ margin: 0, color: 'var(--n800)' }}>{m.turnTimerSec}s</dd>
                <dt style={{ color: 'var(--n400)' }}>Format</dt>
                <dd style={{ margin: 0, color: 'var(--n800)' }}>{m.bestOf}</dd>
                <dt style={{ color: 'var(--n400)' }}>Power-ups</dt>
                <dd style={{ margin: 0, color: 'var(--n800)' }}>{m.powerUpsEnabled ? 'Enabled' : 'Disabled'}</dd>
              </dl>
            </Card>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <Button variant="primary" size="lg">
            Ready — take me to Play
          </Button>
        </Link>
      </div>
    </div>
  )
}
