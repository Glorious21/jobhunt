// Logo 3f ("Lens · Forest + Lime"): the "o" in jobhunt is a magnifier with a lime handle.
// Geometry is in em so it scales with font-size.

export function Logo({ size = 28, inverse = false }: { size?: number; inverse?: boolean }) {
  const color = inverse ? '#fff' : 'var(--forest)'
  return (
    <span
      aria-label="jobhunt"
      role="img"
      style={{
        display: 'flex',
        alignItems: 'center',
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: size,
        letterSpacing: '-0.05em',
        lineHeight: 1,
        color,
      }}
    >
      <span aria-hidden>j</span>
      <span aria-hidden style={{ position: 'relative', width: '0.56em', height: '0.56em', margin: '0.2em 0.04em 0 0.03em', flex: 'none', zIndex: 1 }}>
        <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `0.1em solid ${color}` }} />
        <span
          style={{
            position: 'absolute',
            left: '84%',
            top: '84%',
            width: '0.09em',
            height: '0.16em',
            marginLeft: '-0.045em',
            borderRadius: '0.05em',
            background: 'var(--lime)',
            transform: 'rotate(-45deg)',
            transformOrigin: '50% 0',
          }}
        />
      </span>
      <span aria-hidden>bhunt</span>
    </span>
  )
}
