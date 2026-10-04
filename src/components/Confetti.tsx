'use client'

import { useEffect } from 'react'

const COLORS = ['oklch(0.33 0.07 160)', 'oklch(0.84 0.18 128)', 'oklch(0.78 0.13 140)', 'oklch(0.68 0.19 45)']

/** Deterministic pseudo-random in [0, 1) for piece i, channel k. */
const rand = (i: number, k: number) => (((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1) + 1) % 1

const PIECES = Array.from({ length: 42 }, (_, i) => {
  const angle = rand(i, 1) * Math.PI * 2
  const dist = 140 + rand(i, 2) * 260
  return {
    width: 6 + rand(i, 3) * 6,
    height: 10 + rand(i, 4) * 8,
    background: COLORS[i % 4],
    '--x': `${Math.cos(angle) * dist}px`,
    '--y': `${Math.sin(angle) * dist - 120}px`,
    '--r': `${rand(i, 5) * 720 - 360}deg`,
    animation: `jhConfetti ${1.2 + rand(i, 6) * 0.5}s cubic-bezier(.15,.7,.3,1) ${rand(i, 7) * 0.12}s forwards`,
  } as React.CSSProperties
})

/** 42-piece burst from 50% / 38% of the viewport; removes itself after 1.9s. */
export default function Confetti({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1900)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="confetti" aria-hidden>
      {PIECES.map((style, i) => (
        <span key={i} style={style} />
      ))}
    </div>
  )
}
