/** Deterministic gradient avatar derived from an address. No external image service. */
export function Avatar({ address, size = 24 }: { address: string; size?: number }) {
  const n = parseInt(address.slice(2, 10), 16)
  const h1 = n % 360
  const h2 = (h1 + 40 + ((n >>> 9) % 120)) % 360
  const angle = (n >>> 5) % 360
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(${angle}deg, hsl(${h1} 72% 62%), hsl(${h2} 78% 70%))`,
        boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.7), 0 1px 4px rgba(18,45,69,0.18)',
      }}
    />
  )
}
