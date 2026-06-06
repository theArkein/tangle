export default function LeaguePage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', padding: '40px 20px' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏅</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '26px', color: 'var(--n900)', marginBottom: '8px' }}>
        Leagues
      </div>
      <div style={{ fontSize: '14px', color: 'var(--n500)', maxWidth: '280px', lineHeight: 1.6 }}>
        Compete in weekly seasons with friends. Coming soon.
      </div>
    </div>
  )
}
