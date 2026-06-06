import { useState } from "react";

const tokens = {
  colors: {
    neutral: {
      0: "#FFFFFF",
      50: "#FAFAF9",
      100: "#F5F5F4",
      200: "#E7E5E4",
      300: "#D6D3D1",
      400: "#A8A29E",
      500: "#78716C",
      600: "#57534E",
      700: "#44403C",
      800: "#292524",
      900: "#1C1917",
      950: "#0F0E0D",
    },
    accent: {
      warm: "#C2A67D",
      warmLight: "#D4BFA0",
      warmMuted: "#A8916A",
      warmFaint: "rgba(194, 166, 125, 0.08)",
      warmSubtle: "rgba(194, 166, 125, 0.15)",
    },
    semantic: {
      success: "#6B8F71",
      successLight: "rgba(107, 143, 113, 0.12)",
      danger: "#C07070",
      dangerLight: "rgba(192, 112, 112, 0.12)",
      warning: "#C2A24D",
      warningLight: "rgba(194, 162, 77, 0.12)",
      info: "#7D9AB5",
      infoLight: "rgba(125, 154, 181, 0.12)",
    },
    game: {
      player1: "#8B9E8B",
      player1Light: "rgba(139, 158, 139, 0.15)",
      player2: "#A08B7B",
      player2Light: "rgba(160, 139, 123, 0.15)",
      dangerZone: "#C07070",
      dangerZoneBg: "rgba(192, 112, 112, 0.06)",
      mystery: "#B5A87D",
      mysteryBg: "rgba(181, 168, 125, 0.1)",
      freeze: "#7D9AB5",
      rare: "#9B8DB5",
      rareBg: "rgba(155, 141, 181, 0.1)",
    },
  },
  typography: {
    display: "'DM Serif Display', Georgia, serif",
    heading: "'Sora', 'Helvetica Neue', sans-serif",
    body: "'IBM Plex Sans', 'Helvetica Neue', sans-serif",
    mono: "'IBM Plex Mono', 'Menlo', monospace",
  },
  radii: {
    sm: "6px",
    md: "10px",
    lg: "14px",
    xl: "20px",
    full: "9999px",
  },
};

const copyToClipboard = (text) => {
  navigator.clipboard.writeText(text);
};

function ColorSwatch({ name, hex, isDark }) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      onClick={() => {
        copyToClipboard(hex);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      style={{
        background: hex,
        borderRadius: "10px",
        padding: "14px 12px",
        minHeight: 72,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        cursor: "pointer",
        border: isDark ? "none" : "1px solid #E7E5E4",
        position: "relative",
        transition: "transform 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {copied && (
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            fontSize: 10,
            color: isDark ? "#A8A29E" : "#78716C",
            fontFamily: tokens.typography.mono,
          }}
        >
          Copied
        </div>
      )}
      <div
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: isDark ? "#A8A29E" : "#78716C",
          fontFamily: tokens.typography.mono,
        }}
      >
        {name}
      </div>
      <div
        style={{
          fontSize: 10,
          color: isDark ? "#78716C" : "#A8A29E",
          fontFamily: tokens.typography.mono,
          marginTop: 2,
        }}
      >
        {hex}
      </div>
    </div>
  );
}

function Section({ title, description, children }) {
  return (
    <div style={{ marginBottom: 56 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          marginBottom: 8,
          borderBottom: "1px solid #E7E5E4",
          paddingBottom: 12,
        }}
      >
        <h2
          style={{
            fontSize: 22,
            fontWeight: 400,
            fontFamily: tokens.typography.display,
            color: tokens.colors.neutral[900],
            margin: 0,
          }}
        >
          {title}
        </h2>
      </div>
      {description && (
        <p
          style={{
            fontSize: 13,
            color: tokens.colors.neutral[500],
            fontFamily: tokens.typography.body,
            marginTop: 8,
            marginBottom: 20,
            lineHeight: 1.6,
            maxWidth: 560,
          }}
        >
          {description}
        </p>
      )}
      {children}
    </div>
  );
}

function SubSection({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3
        style={{
          fontSize: 11,
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: tokens.colors.neutral[400],
          fontFamily: tokens.typography.body,
          margin: "0 0 10px",
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function WordPill({ word, variant = "neutral", size = "md" }) {
  const styles = {
    player1: {
      bg: tokens.colors.game.player1Light,
      color: tokens.colors.game.player1,
      border: "transparent",
    },
    player2: {
      bg: tokens.colors.game.player2Light,
      color: tokens.colors.game.player2,
      border: "transparent",
    },
    danger: {
      bg: tokens.colors.semantic.dangerLight,
      color: tokens.colors.semantic.danger,
      border: "transparent",
    },
    mystery: {
      bg: tokens.colors.game.mysteryBg,
      color: tokens.colors.game.mystery,
      border: `1px dashed ${tokens.colors.game.mystery}`,
    },
    neutral: {
      bg: tokens.colors.neutral[100],
      color: tokens.colors.neutral[600],
      border: `1px solid ${tokens.colors.neutral[200]}`,
    },
  };
  const s = styles[variant];
  const pad = size === "sm" ? "4px 10px" : "6px 14px";
  const fs = size === "sm" ? 12 : 14;
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        border: s.border.includes("px") ? s.border : "none",
        borderRadius: tokens.radii.full,
        padding: pad,
        fontSize: fs,
        fontWeight: 500,
        fontFamily: tokens.typography.body,
        display: "inline-block",
      }}
    >
      {word}
    </span>
  );
}

function Badge({ label, variant = "neutral" }) {
  const styles = {
    success: {
      bg: tokens.colors.semantic.successLight,
      color: tokens.colors.semantic.success,
    },
    danger: {
      bg: tokens.colors.semantic.dangerLight,
      color: tokens.colors.semantic.danger,
    },
    warning: {
      bg: tokens.colors.semantic.warningLight,
      color: tokens.colors.semantic.warning,
    },
    info: {
      bg: tokens.colors.semantic.infoLight,
      color: tokens.colors.semantic.info,
    },
    accent: {
      bg: tokens.colors.accent.warmFaint,
      color: tokens.colors.accent.warmMuted,
    },
    neutral: {
      bg: tokens.colors.neutral[100],
      color: tokens.colors.neutral[500],
    },
    rare: {
      bg: tokens.colors.game.rareBg,
      color: tokens.colors.game.rare,
    },
  };
  const s = styles[variant];
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        borderRadius: tokens.radii.full,
        padding: "3px 10px",
        fontSize: 11,
        fontWeight: 500,
        fontFamily: tokens.typography.body,
        display: "inline-block",
      }}
    >
      {label}
    </span>
  );
}

function Button({ label, variant = "primary", size = "md", icon }) {
  const base = {
    borderRadius: tokens.radii.md,
    fontFamily: tokens.typography.body,
    fontWeight: 500,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    transition: "all 0.15s",
    border: "none",
  };
  const sizes = {
    sm: { padding: "6px 14px", fontSize: 12 },
    md: { padding: "10px 20px", fontSize: 13 },
    lg: { padding: "14px 28px", fontSize: 15 },
  };
  const variants = {
    primary: {
      background: tokens.colors.neutral[900],
      color: tokens.colors.neutral[0],
    },
    secondary: {
      background: tokens.colors.neutral[100],
      color: tokens.colors.neutral[700],
      border: `1px solid ${tokens.colors.neutral[200]}`,
    },
    accent: {
      background: tokens.colors.accent.warm,
      color: tokens.colors.neutral[0],
    },
    ghost: {
      background: "transparent",
      color: tokens.colors.neutral[600],
    },
    danger: {
      background: tokens.colors.semantic.dangerLight,
      color: tokens.colors.semantic.danger,
    },
  };
  return (
    <button style={{ ...base, ...sizes[size], ...variants[variant] }}>
      {icon && <span>{icon}</span>}
      {label}
    </button>
  );
}

function TimerBar({ percent = 40, danger = false }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
      }}
    >
      <div
        style={{
          flex: 1,
          height: 6,
          background: tokens.colors.neutral[200],
          borderRadius: tokens.radii.full,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: "100%",
            background: danger
              ? tokens.colors.semantic.danger
              : tokens.colors.neutral[400],
            borderRadius: tokens.radii.full,
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          fontFamily: tokens.typography.mono,
          color: danger
            ? tokens.colors.semantic.danger
            : tokens.colors.neutral[600],
          minWidth: 28,
          textAlign: "right",
        }}
      >
        {danger ? "5s" : "12s"}
      </span>
    </div>
  );
}

function PowerUpCard({ icon, name, rarity, desc }) {
  const rarityColors = {
    Common: {
      bg: tokens.colors.neutral[100],
      border: tokens.colors.neutral[200],
      badge: "neutral",
    },
    Earned: {
      bg: tokens.colors.accent.warmFaint,
      border: tokens.colors.accent.warmLight,
      badge: "accent",
    },
    Rare: {
      bg: tokens.colors.game.rareBg,
      border: tokens.colors.game.rare,
      badge: "rare",
    },
  };
  const r = rarityColors[rarity];
  return (
    <div
      style={{
        background: r.bg,
        border: `1px solid ${r.border}`,
        borderRadius: tokens.radii.lg,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            fontFamily: tokens.typography.heading,
            color: tokens.colors.neutral[800],
            flex: 1,
          }}
        >
          {name}
        </span>
        <Badge label={rarity} variant={r.badge} />
      </div>
      <span
        style={{
          fontSize: 11,
          color: tokens.colors.neutral[500],
          fontFamily: tokens.typography.body,
          lineHeight: 1.5,
        }}
      >
        {desc}
      </span>
    </div>
  );
}

function PlayerRow({ name, score, variant, isYou }) {
  const color =
    variant === "p1"
      ? tokens.colors.game.player1
      : tokens.colors.game.player2;
  const bg =
    variant === "p1"
      ? tokens.colors.game.player1Light
      : tokens.colors.game.player2Light;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: tokens.radii.full,
          background: bg,
          color: color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 600,
          fontFamily: tokens.typography.heading,
        }}
      >
        {name[0]}
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: tokens.colors.neutral[800],
            fontFamily: tokens.typography.heading,
          }}
        >
          {name}
          {isYou && (
            <span
              style={{
                fontSize: 10,
                color: tokens.colors.neutral[400],
                marginLeft: 6,
                fontWeight: 400,
              }}
            >
              (you)
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 11,
            color: tokens.colors.neutral[400],
            fontFamily: tokens.typography.mono,
          }}
        >
          {score} pts
        </div>
      </div>
    </div>
  );
}

export default function DesignSystem() {
  const [activeTab, setActiveTab] = useState("foundation");

  const tabs = [
    { id: "foundation", label: "Foundation" },
    { id: "components", label: "Components" },
    { id: "patterns", label: "Patterns" },
  ];

  return (
    <div
      style={{
        fontFamily: tokens.typography.body,
        color: tokens.colors.neutral[800],
        background: tokens.colors.neutral[0],
        minHeight: "100vh",
        maxWidth: 840,
        margin: "0 auto",
        padding: "40px 32px",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=Sora:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />

      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: tokens.colors.neutral[400],
              fontFamily: tokens.typography.body,
            }}
          >
            Design System
          </span>
          <span
            style={{
              fontSize: 10,
              color: tokens.colors.neutral[300],
              fontFamily: tokens.typography.mono,
            }}
          >
            v1.0
          </span>
        </div>
        <h1
          style={{
            fontSize: 36,
            fontWeight: 400,
            fontFamily: tokens.typography.display,
            color: tokens.colors.neutral[900],
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          Chain Battle
        </h1>
        <p
          style={{
            fontSize: 14,
            color: tokens.colors.neutral[500],
            margin: "8px 0 0",
            lineHeight: 1.6,
          }}
        >
          A neutral, warm, typography-driven design language for competitive
          word gaming. Designed for clarity under pressure and personality in
          the social layer.
        </p>
      </div>

      {/* Tab nav */}
      <div
        style={{
          display: "flex",
          gap: 2,
          marginBottom: 36,
          borderBottom: `1px solid ${tokens.colors.neutral[200]}`,
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: "10px 18px",
              fontSize: 13,
              fontWeight: 500,
              fontFamily: tokens.typography.body,
              color:
                activeTab === t.id
                  ? tokens.colors.neutral[900]
                  : tokens.colors.neutral[400],
              background: "none",
              border: "none",
              borderBottom:
                activeTab === t.id
                  ? `2px solid ${tokens.colors.neutral[900]}`
                  : "2px solid transparent",
              cursor: "pointer",
              transition: "all 0.15s",
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* FOUNDATION TAB */}
      {activeTab === "foundation" && (
        <>
          <Section
            title="Color — Neutral core"
            description="The primary palette is built on warm stone neutrals. These form the foundation of every screen. Click any swatch to copy its hex value."
          >
            <SubSection title="Neutral scale">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(6, 1fr)",
                  gap: 8,
                }}
              >
                {Object.entries(tokens.colors.neutral).map(([k, v]) => (
                  <ColorSwatch
                    key={k}
                    name={k}
                    hex={v}
                    isDark={parseInt(k) >= 600}
                  />
                ))}
              </div>
            </SubSection>

            <SubSection title="Accent — Warm gold">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(5, 1fr)",
                  gap: 8,
                }}
              >
                {Object.entries(tokens.colors.accent).map(([k, v]) => (
                  <ColorSwatch
                    key={k}
                    name={k}
                    hex={v}
                    isDark={false}
                  />
                ))}
              </div>
              <p
                style={{
                  fontSize: 11,
                  color: tokens.colors.neutral[400],
                  marginTop: 8,
                }}
              >
                Used sparingly for earned rewards, achievements, and premium
                moments. Never for primary actions.
              </p>
            </SubSection>

            <SubSection title="Semantic">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 8,
                }}
              >
                {[
                  ["Success", tokens.colors.semantic.success],
                  ["Danger", tokens.colors.semantic.danger],
                  ["Warning", tokens.colors.semantic.warning],
                  ["Info", tokens.colors.semantic.info],
                ].map(([name, hex]) => (
                  <ColorSwatch key={name} name={name} hex={hex} isDark />
                ))}
              </div>
            </SubSection>

            <SubSection title="Game-specific">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 8,
                }}
              >
                {[
                  ["Player 1", tokens.colors.game.player1],
                  ["Player 2", tokens.colors.game.player2],
                  ["Danger Zone", tokens.colors.game.dangerZone],
                  ["Freeze", tokens.colors.game.freeze],
                  ["Mystery", tokens.colors.game.mystery],
                  ["Rare", tokens.colors.game.rare],
                ].map(([name, hex]) => (
                  <ColorSwatch key={name} name={name} hex={hex} isDark />
                ))}
              </div>
              <p
                style={{
                  fontSize: 11,
                  color: tokens.colors.neutral[400],
                  marginTop: 8,
                }}
              >
                Player colors are intentionally muted — sage green and warm
                clay — so they don't compete with the chain content.
              </p>
            </SubSection>
          </Section>

          <Section
            title="Typography"
            description="Four typeface roles, each with a distinct purpose. The hierarchy is designed for fast scanning during gameplay and comfortable reading in social screens."
          >
            <div
              style={{ display: "flex", flexDirection: "column", gap: 20 }}
            >
              {[
                {
                  role: "Display",
                  family: tokens.typography.display,
                  name: "DM Serif Display",
                  sample: "Chain Battle",
                  size: 32,
                  weight: 400,
                  usage: "Logo, section titles, celebratory moments",
                },
                {
                  role: "Heading",
                  family: tokens.typography.heading,
                  name: "Sora",
                  sample: "Round 3 of 5 — Your Turn",
                  size: 20,
                  weight: 600,
                  usage:
                    "Screen titles, player names, mode labels, in-game HUD",
                },
                {
                  role: "Body",
                  family: tokens.typography.body,
                  name: "IBM Plex Sans",
                  sample:
                    "Build the longest chain. Each word starts with the last letter of the previous one.",
                  size: 14,
                  weight: 400,
                  usage:
                    "Descriptions, rules, chat messages, settings, onboarding",
                },
                {
                  role: "Mono",
                  family: tokens.typography.mono,
                  name: "IBM Plex Mono",
                  sample: "12s  ·  2,450 XP  ·  ELO 1,280",
                  size: 13,
                  weight: 500,
                  usage:
                    "Timers, scores, stats, counters, technical data",
                },
              ].map((t) => (
                <div
                  key={t.role}
                  style={{
                    borderBottom: `1px solid ${tokens.colors.neutral[100]}`,
                    paddingBottom: 18,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: tokens.colors.neutral[400],
                      }}
                    >
                      {t.role}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: tokens.colors.neutral[300],
                        fontFamily: tokens.typography.mono,
                      }}
                    >
                      {t.name}
                    </span>
                  </div>
                  <div
                    style={{
                      fontFamily: t.family,
                      fontSize: t.size,
                      fontWeight: t.weight,
                      color: tokens.colors.neutral[900],
                      marginBottom: 6,
                    }}
                  >
                    {t.sample}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: tokens.colors.neutral[400],
                    }}
                  >
                    {t.usage}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section
            title="Spacing & Radii"
            description="A 4px base grid. Border radii are generous but not bubbly — rounded enough to feel approachable, sharp enough to feel competitive."
          >
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "flex-end",
                marginBottom: 24,
              }}
            >
              {[
                ["sm", 6],
                ["md", 10],
                ["lg", 14],
                ["xl", 20],
                ["full", 40],
              ].map(([name, r]) => (
                <div key={name} style={{ textAlign: "center" }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: name === "full" ? 9999 : r,
                      border: `2px solid ${tokens.colors.neutral[300]}`,
                      background: tokens.colors.neutral[50],
                    }}
                  />
                  <div
                    style={{
                      fontSize: 11,
                      fontFamily: tokens.typography.mono,
                      color: tokens.colors.neutral[500],
                      marginTop: 6,
                    }}
                  >
                    {name}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: tokens.colors.neutral[400],
                      fontFamily: tokens.typography.mono,
                    }}
                  >
                    {name === "full" ? "9999" : r}px
                  </div>
                </div>
              ))}
            </div>

            <SubSection title="Spacing scale">
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                {[4, 8, 12, 16, 20, 24, 32, 40, 48, 64].map((s) => (
                  <div key={s} style={{ textAlign: "center" }}>
                    <div
                      style={{
                        width: 20,
                        height: s,
                        background: tokens.colors.neutral[200],
                        borderRadius: 3,
                      }}
                    />
                    <div
                      style={{
                        fontSize: 10,
                        fontFamily: tokens.typography.mono,
                        color: tokens.colors.neutral[400],
                        marginTop: 4,
                      }}
                    >
                      {s}
                    </div>
                  </div>
                ))}
              </div>
            </SubSection>
          </Section>
        </>
      )}

      {/* COMPONENTS TAB */}
      {activeTab === "components" && (
        <>
          <Section
            title="Buttons"
            description="Primary actions use solid dark. Secondary uses bordered neutrals. Accent gold is reserved for earned/achievement moments only."
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                marginBottom: 16,
              }}
            >
              <Button label="Play now" variant="primary" />
              <Button label="Invite friend" variant="secondary" icon="+" />
              <Button label="Claim reward" variant="accent" />
              <Button label="Settings" variant="ghost" />
              <Button label="Leave match" variant="danger" />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Button label="Small" variant="primary" size="sm" />
              <Button label="Medium" variant="primary" size="md" />
              <Button label="Large" variant="primary" size="lg" />
            </div>
          </Section>

          <Section
            title="Word Pills"
            description="The core visual unit of the game. Each word in the chain is a pill. Player colors distinguish turns. Danger Zone and mystery variants add drama."
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 16,
              }}
            >
              <WordPill word="tiger" variant="player1" />
              <WordPill word="rabbit" variant="player2" />
              <WordPill word="tornado" variant="player1" />
              <WordPill word="octopus" variant="player2" />
              <WordPill word="sanguine" variant="danger" />
              <WordPill word="enigma" variant="mystery" />
              <WordPill word="apricot" variant="neutral" />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <WordPill word="small" variant="player1" size="sm" />
              <WordPill word="medium" variant="player1" size="md" />
            </div>
          </Section>

          <Section
            title="Badges"
            description="Lightweight status indicators. Muted tints with matching text color. Used for rarity, status, achievements, and labels."
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Badge label="Common" variant="neutral" />
              <Badge label="Earned" variant="accent" />
              <Badge label="Rare" variant="rare" />
              <Badge label="Victory" variant="success" />
              <Badge label="Defeat" variant="danger" />
              <Badge label="New record" variant="warning" />
              <Badge label="Online" variant="info" />
            </div>
          </Section>

          <Section
            title="Timer"
            description="The most important UI element during gameplay. Neutral fill in normal play. Red fill in Danger Zone."
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 16,
                maxWidth: 400,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: tokens.colors.neutral[400],
                    marginBottom: 6,
                  }}
                >
                  Normal
                </div>
                <TimerBar percent={65} />
              </div>
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: tokens.colors.neutral[400],
                    marginBottom: 6,
                  }}
                >
                  Danger Zone
                </div>
                <TimerBar percent={30} danger />
              </div>
            </div>
          </Section>

          <Section
            title="Power-up Cards"
            description="Three visual tiers matching rarity. Background tint and border treatment escalate with rarity."
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              <PowerUpCard
                icon="❄️"
                name="Freeze"
                rarity="Common"
                desc="Pause opponent's timer for 5 seconds."
              />
              <PowerUpCard
                icon="🛡️"
                name="Second Life"
                rarity="Common"
                desc="Survive one timeout."
              />
              <PowerUpCard
                icon="💣"
                name="Letter Bomb"
                rarity="Earned"
                desc="Force a hard letter on opponent."
              />
              <PowerUpCard
                icon="🔮"
                name="Peek"
                rarity="Rare"
                desc="See what opponent is typing."
              />
            </div>
          </Section>

          <Section
            title="Player Identity"
            description="Avatar circles with muted player colors. Monogram fallback when no image is set."
          >
            <div style={{ display: "flex", gap: 32 }}>
              <PlayerRow name="You" score="2,450" variant="p1" isYou />
              <PlayerRow name="Priya" score="2,180" variant="p2" />
            </div>
          </Section>
        </>
      )}

      {/* PATTERNS TAB */}
      {activeTab === "patterns" && (
        <>
          <Section
            title="Game Card — Live Match"
            description="How a match in progress appears. The chain, timer, and player context are all visible at a glance."
          >
            <div
              style={{
                border: `1px solid ${tokens.colors.neutral[200]}`,
                borderRadius: tokens.radii.xl,
                overflow: "hidden",
                maxWidth: 420,
                background: tokens.colors.neutral[0],
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: "14px 18px",
                  borderBottom: `1px solid ${tokens.colors.neutral[100]}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      fontFamily: tokens.typography.heading,
                      color: tokens.colors.neutral[900],
                    }}
                  >
                    Classic Duel
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: tokens.colors.neutral[400],
                      fontFamily: tokens.typography.mono,
                    }}
                  >
                    Round 3 of 5
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: tokens.typography.mono,
                    color: tokens.colors.neutral[800],
                  }}
                >
                  2 – 1
                </div>
              </div>

              {/* Players */}
              <div
                style={{
                  padding: "12px 18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: `1px solid ${tokens.colors.neutral[100]}`,
                }}
              >
                <PlayerRow
                  name="You"
                  score="14 words"
                  variant="p1"
                  isYou
                />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: tokens.colors.neutral[300],
                    padding: "0 12px",
                  }}
                >
                  VS
                </span>
                <PlayerRow name="Priya" score="12 words" variant="p2" />
              </div>

              {/* Chain */}
              <div
                style={{
                  padding: "14px 18px",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  borderBottom: `1px solid ${tokens.colors.neutral[100]}`,
                }}
              >
                <WordPill word="tiger" variant="player1" size="sm" />
                <WordPill word="rabbit" variant="player2" size="sm" />
                <WordPill word="top" variant="player1" size="sm" />
                <WordPill word="penguin" variant="player2" size="sm" />
                <WordPill word="never" variant="player1" size="sm" />
                <WordPill word="reptile" variant="player2" size="sm" />
                <WordPill word="eagle" variant="player1" size="sm" />
                <WordPill word="early" variant="player2" size="sm" />
                <WordPill word="yoga" variant="player1" size="sm" />
              </div>

              {/* Timer */}
              <div style={{ padding: "12px 18px" }}>
                <TimerBar percent={55} />
              </div>

              {/* Input */}
              <div
                style={{
                  padding: "0 18px 16px",
                  display: "flex",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    flex: 1,
                    border: `1px solid ${tokens.colors.neutral[200]}`,
                    borderRadius: tokens.radii.md,
                    padding: "10px 14px",
                    fontSize: 14,
                    fontFamily: tokens.typography.body,
                    color: tokens.colors.neutral[300],
                  }}
                >
                  Type a word starting with{" "}
                  <span
                    style={{
                      color: tokens.colors.neutral[800],
                      fontWeight: 600,
                    }}
                  >
                    a
                  </span>
                  …
                </div>
                <Button label="Play" variant="primary" size="md" />
              </div>
            </div>
          </Section>

          <Section
            title="Share Card"
            description="Auto-generated after every match. Clean enough to look great on Instagram stories and iMessage previews."
          >
            <div
              style={{
                background: tokens.colors.neutral[950],
                borderRadius: tokens.radii.xl,
                padding: "28px 24px",
                maxWidth: 380,
                color: tokens.colors.neutral[0],
              }}
            >
              <div
                style={{
                  fontFamily: tokens.typography.display,
                  fontSize: 20,
                  marginBottom: 4,
                  color: tokens.colors.neutral[100],
                }}
              >
                Chain Battle
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: tokens.colors.neutral[600],
                  fontFamily: tokens.typography.mono,
                  marginBottom: 18,
                }}
              >
                Classic Duel · June 6, 2026
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 18,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: tokens.typography.heading,
                      color: tokens.colors.game.player1,
                    }}
                  >
                    You
                  </div>
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 600,
                      fontFamily: tokens.typography.heading,
                      color: tokens.colors.neutral[100],
                    }}
                  >
                    3
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: tokens.colors.neutral[600],
                    alignSelf: "center",
                  }}
                >
                  VS
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: tokens.typography.heading,
                      color: tokens.colors.game.player2,
                    }}
                  >
                    Priya
                  </div>
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 600,
                      fontFamily: tokens.typography.heading,
                      color: tokens.colors.neutral[400],
                    }}
                  >
                    1
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 5,
                  marginBottom: 18,
                  padding: "14px 0",
                  borderTop: `1px solid ${tokens.colors.neutral[800]}`,
                  borderBottom: `1px solid ${tokens.colors.neutral[800]}`,
                }}
              >
                {[
                  ["tiger", "p1"],
                  ["rabbit", "p2"],
                  ["top", "p1"],
                  ["penguin", "p2"],
                  ["never", "p1"],
                  ["reptile", "p2"],
                  ["eagle", "p1"],
                ].map(([w, p], i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 11,
                      padding: "3px 8px",
                      borderRadius: 9999,
                      background:
                        p === "p1"
                          ? "rgba(139, 158, 139, 0.2)"
                          : "rgba(160, 139, 123, 0.2)",
                      color:
                        p === "p1"
                          ? tokens.colors.game.player1
                          : tokens.colors.game.player2,
                      fontFamily: tokens.typography.body,
                      fontWeight: 500,
                    }}
                  >
                    {w}
                  </span>
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11,
                  fontFamily: tokens.typography.mono,
                  color: tokens.colors.neutral[600],
                }}
              >
                <span>Best word: reptile</span>
                <span>chainbattle.app</span>
              </div>
            </div>
          </Section>

          <Section
            title="Danger Zone State"
            description="When the chain exceeds 20 words. The entire card shifts to a subtle danger treatment — not overwhelming, just enough tension."
          >
            <div
              style={{
                border: `1px solid ${tokens.colors.semantic.danger}`,
                borderRadius: tokens.radii.xl,
                padding: "16px 18px",
                maxWidth: 420,
                background: tokens.colors.game.dangerZoneBg,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <Badge label="DANGER ZONE" variant="danger" />
                <span
                  style={{
                    fontSize: 11,
                    color: tokens.colors.neutral[400],
                    fontFamily: tokens.typography.mono,
                  }}
                >
                  3× scoring active
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  marginBottom: 14,
                }}
              >
                <WordPill word="quizzical" variant="danger" size="sm" />
                <WordPill word="landslide" variant="danger" size="sm" />
                <WordPill word="enigmatic" variant="danger" size="sm" />
              </div>
              <TimerBar percent={25} danger />
            </div>
          </Section>

          <Section
            title="Design Principles"
            description="The rules that govern every visual decision in Chain Battle."
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              {[
                {
                  title: "Neutral foundation",
                  desc: "Every screen starts from warm stone neutrals. Color is additive, never default. This keeps the word chain — the core content — as the visual focus.",
                },
                {
                  title: "Earned color",
                  desc: "Gold accent appears only for achievements, rewards, and progression moments. It should feel like a reward to see it. Never use it for navigation or standard actions.",
                },
                {
                  title: "Tension through reduction",
                  desc: "Danger Zone doesn't scream — it removes. Fewer colors, tighter timer, smaller type. Restraint creates more tension than excess.",
                },
                {
                  title: "Typography carries hierarchy",
                  desc: "With a neutral palette, type weight and family do the heavy lifting. Display serif for celebration, geometric sans for status, mono for data. Never rely on color alone.",
                },
              ].map((p, i) => (
                <div
                  key={i}
                  style={{
                    border: `1px solid ${tokens.colors.neutral[200]}`,
                    borderRadius: tokens.radii.lg,
                    padding: "16px 18px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      fontFamily: tokens.typography.heading,
                      color: tokens.colors.neutral[800],
                      marginBottom: 6,
                    }}
                  >
                    {p.title}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: tokens.colors.neutral[500],
                      lineHeight: 1.6,
                    }}
                  >
                    {p.desc}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
