export default function Logo({ size = 'md', dark = false }) {
  const sizes = {
    sm: { text: 14, gap: 6, bar: 20 },
    md: { text: 18, gap: 8, bar: 26 },
    lg: { text: 24, gap: 10, bar: 34 },
  }
  const s = sizes[size] || sizes.md
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: s.gap }}>
        <span style={{
          fontSize: s.text,
          fontWeight: 500,
          letterSpacing: '-0.3px',
          color: dark ? 'white' : 'var(--tw-color-slate-800, #1e293b)',
        }}>
          Happy
        </span>
        <span style={{
          fontSize: s.text,
          fontWeight: 500,
          letterSpacing: '-0.3px',
          color: '#1F7A5C',
        }}>
          Life
        </span>
      </div>
      <div style={{
        width: s.bar,
        height: 2,
        background: '#1F7A5C',
        borderRadius: 2,
      }} />
    </div>
  )
}
