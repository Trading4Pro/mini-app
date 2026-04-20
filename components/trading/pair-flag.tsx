"use client"

import { useEffect, useState } from "react"

// Fallback palette for symbols without a /flags/<Name>.svg file
const CCY_STYLE: Record<string, { bg: string; fg: string; stripe?: string }> = {
  USD: { bg: "#0A3161", fg: "#fff", stripe: "#B22234" },
  EUR: { bg: "#003399", fg: "#FFCC00" },
  GBP: { bg: "#012169", fg: "#fff", stripe: "#C8102E" },
  JPY: { bg: "#fff", fg: "#BC002D", stripe: "#BC002D" },
  CHF: { bg: "#D52B1E", fg: "#fff" },
  AUD: { bg: "#012169", fg: "#fff", stripe: "#E4002B" },
  CAD: { bg: "#D52B1E", fg: "#fff" },
  NZD: { bg: "#012169", fg: "#fff" },
  XAU: { bg: "#FFC107", fg: "#3A2A00" },
  XAG: { bg: "#BFC6CC", fg: "#2C2C2C" },
  XPT: { bg: "#8D8D8D", fg: "#fff" },
  XPD: { bg: "#5A5A5A", fg: "#fff" },
  BTC: { bg: "#F7931A", fg: "#fff" },
  ETH: { bg: "#627EEA", fg: "#fff" },
}

function firstCcy(name: string): string {
  const up = name.toUpperCase().replace(/[^A-Z]/g, "")
  return up.slice(0, 3)
}

export function PairFlag({
  name,
  size = 48,
  disabled = false,
}: {
  name: string
  size?: number
  disabled?: boolean
}) {
  const [failed, setFailed] = useState(false)

  // Re-attempt if the symbol name changes
  useEffect(() => { setFailed(false) }, [name])

  const src = `/flags/${encodeURIComponent(name)}.svg`
  const strokeWidth = Math.max(1, size * (1.24 / 48))

  if (!failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        onError={() => setFailed(true)}
        style={{
          display: "block",
          width: size,
          height: size,
          objectFit: "contain",
          borderRadius: 4,
          flexShrink: 0,
          filter: disabled ? "grayscale(1) opacity(0.5)" : undefined,
        }}
      />
    )
  }

  // Fallback: a neutral colored badge with the first currency code
  const code = firstCcy(name)
  const style = CCY_STYLE[code] || { bg: "#404358", fg: "#fff" }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 4,
        border: `${strokeWidth}px solid ${disabled ? "var(--mkt-text-disabled)" : "var(--mkt-stroke-muted)"}`,
        boxSizing: "border-box",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: Math.round(size * 0.32),
        color: disabled ? "var(--mkt-text-disabled)" : style.fg,
        background: disabled
          ? "var(--mkt-divider)"
          : style.stripe
          ? `linear-gradient(180deg, ${style.bg} 0 50%, ${style.stripe} 50% 100%)`
          : style.bg,
        letterSpacing: "-0.02em",
        flexShrink: 0,
      }}
    >
      {code || "?"}
    </div>
  )
}
