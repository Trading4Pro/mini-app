"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Spinner } from "@/components/ui/spinner"

export const TrendbarPeriod = {
  M1: 1, M2: 2, M5: 3, M10: 4, M15: 5, M30: 6,
  H1: 7, H4: 8, H12: 9, D1: 10, W1: 11, MN1: 12,
} as const

const periodToLibTimeframe: Record<number, string> = {
  [TrendbarPeriod.M1]: "1M", [TrendbarPeriod.M5]: "5M",
  [TrendbarPeriod.M15]: "15M", [TrendbarPeriod.M30]: "30M",
  [TrendbarPeriod.H1]: "1H", [TrendbarPeriod.H4]: "4H",
  [TrendbarPeriod.D1]: "1D",
}

const periodToMs: Record<number, number> = {
  [TrendbarPeriod.M1]: 60_000, [TrendbarPeriod.M5]: 5 * 60_000,
  [TrendbarPeriod.M15]: 15 * 60_000, [TrendbarPeriod.M30]: 30 * 60_000,
  [TrendbarPeriod.H1]: 60 * 60_000, [TrendbarPeriod.H4]: 4 * 60 * 60_000,
  [TrendbarPeriod.D1]: 24 * 60 * 60_000,
}

// Raw trendbar from cTrader JSON API
interface RawTrendbar {
  low: number | string
  deltaOpen: number | string
  deltaClose: number | string
  deltaHigh: number | string
  utcTimestampInMinutes: number
  volume: number | string
}

interface TradingChartProps {
  symbolId: number
  symbolName: string
  digits: number
  getTrendbars: (
    symbolId: number, period: number, fromTimestamp: number, toTimestamp: number,
  ) => Promise<{ trendbar?: unknown[]; [key: string]: unknown }>
  height?: number
}

export function TradingChart({ symbolId, symbolName, digits, getTrendbars, height = 200 }: TradingChartProps) {
  const chartRef = useRef<any>(null)
  const containerNodeRef = useRef<HTMLDivElement | null>(null)
  const [chartReady, setChartReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState(TrendbarPeriod.M5)
  const [libLoaded, setLibLoaded] = useState(false)

  // Dynamically load chart-api.min.js and wait for T4PChart
  useEffect(() => {
    if (window.T4PChart) { setLibLoaded(true); return }

    // Check if script already exists
    if (!document.querySelector('script[src="/chart-api.min.js"]')) {
      const script = document.createElement("script")
      script.src = "/chart-api.min.js"
      script.async = true
      script.onload = () => {
        if (window.T4PChart) setLibLoaded(true)
      }
      document.body.appendChild(script)
    }

    // Poll as fallback
    const interval = setInterval(() => {
      if (window.T4PChart) { setLibLoaded(true); clearInterval(interval) }
    }, 500)
    return () => clearInterval(interval)
  }, [])

  // Initialize chart
  useEffect(() => {
    if (!libLoaded || !containerNodeRef.current || chartRef.current) return
    try {
      const inst = new window.T4PChart(containerNodeRef.current, {
        general: {
          defaultChartType: "candles",
          saveLayout: false,
          saveIndicators: false,
          saveDrawings: false,
          theme: "dark",
        },
        colors: {
          background: "#0d1421",
          gridLine: "#1c2738",
          text: "#6b7d94",
          bull: "#00c853",
          bear: "#ff1744",
          wick: "#6b7d94",
        },
      })
      chartRef.current = inst
      if (typeof inst.addEventHandler === "function") {
        inst.addEventHandler("onChartReady", () => setChartReady(true))
      } else {
        setChartReady(true)
      }
    } catch (err) {
      setError("Chart init failed: " + (err instanceof Error ? err.message : String(err)))
    }
  }, [libLoaded])

  // Load data
  useEffect(() => {
    if (!chartReady || !chartRef.current) return
    const chart = chartRef.current
    const libTimeframe = periodToLibTimeframe[period] || "5M"
    const barMs = periodToMs[period] || 5 * 60_000
    const toMs = Date.now()
    const fromMs = toMs - 500 * barMs
    let cancelled = false

    const loadData = async () => {
      setLoading(true)
      setError(null)
      try {
        if (typeof chart.showLoader === "function") chart.showLoader()

        // Set symbol & timeframe BEFORE pushing data
        if (typeof chart.setSymbol === "function") chart.setSymbol(symbolName)
        if (typeof chart.setDisplayName === "function") chart.setDisplayName(symbolName)
        if (typeof chart.setTimeframe === "function") chart.setTimeframe(libTimeframe)
        if (typeof chart.clearDrawings === "function") chart.clearDrawings()

        const res = await getTrendbars(symbolId, period, fromMs, toMs)
        if (cancelled) return

        const rawBars = (res.trendbar as RawTrendbar[]) || []
        if (rawBars.length === 0) { setError("No chart data"); return }

        // Set precision
        if (typeof chart.setDecimals === "function") chart.setDecimals(symbolName, digits)
        if (chart.data && typeof chart.data.setSymbols === "function") chart.data.setSymbols([symbolName])
        if (chart.data && typeof chart.data.setSchedule === "function") {
          chart.data.setSchedule(symbolName, [{ start: 0, end: 10080 }], 0)
        }
        if (chart.data && typeof chart.data.empty === "function") {
          try { chart.data.empty(symbolName, libTimeframe) } catch { /* ignore */ }
        }

        // Convert trendbars: OHLC are deltas from low, timestamp is in minutes
        const divisor = Math.pow(10, digits)
        const candles = rawBars.map((b) => {
          const low = Number(b.low)
          const dO = Number(b.deltaOpen ?? 0)
          const dH = Number(b.deltaHigh ?? 0)
          const dC = Number(b.deltaClose ?? 0)
          return {
            symbol: symbolName,
            timeframe: libTimeframe,
            timestamp: Number(b.utcTimestampInMinutes) * 60, // minutes → seconds
            open: (low + dO) / divisor,
            high: (low + dH) / divisor,
            low: low / divisor,
            close: (low + dC) / divisor,
            volume_buy: Number(b.volume) || 0,
            volume_sell: 0,
          }
        })

        if (chart.data && typeof chart.data.setCandles === "function") {
          chart.data.setCandles(candles)
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[Chart] Load error:", err)
          setError(err instanceof Error ? err.message : "Chart load failed")
        }
      } finally {
        if (!cancelled) {
          if (typeof chart?.hideLoader === "function") chart.hideLoader()
          setLoading(false)
        }
      }
    }

    loadData()
    return () => { cancelled = true }
  }, [chartReady, symbolId, symbolName, digits, period, getTrendbars])

  useEffect(() => { return () => { chartRef.current = null } }, [])

  const periods = [
    { label: "1M", value: TrendbarPeriod.M1 },
    { label: "5M", value: TrendbarPeriod.M5 },
    { label: "15M", value: TrendbarPeriod.M15 },
    { label: "1H", value: TrendbarPeriod.H1 },
    { label: "4H", value: TrendbarPeriod.H4 },
    { label: "1D", value: TrendbarPeriod.D1 },
  ]

  // Resizable chart height
  const [chartHeight, setChartHeight] = useState(height)
  const draggingRef = useRef(false)
  const startYRef = useRef(0)
  const startHeightRef = useRef(height)

  const onDragStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    draggingRef.current = true
    startYRef.current = e.clientY
    startHeightRef.current = chartHeight
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [chartHeight])

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return
    const delta = startYRef.current - e.clientY // dragging up = bigger
    const newH = Math.max(height, Math.min(height * 2, startHeightRef.current + delta))
    setChartHeight(newH)
  }, [height])

  const onDragEnd = useCallback(() => {
    draggingRef.current = false
  }, [])

  return (
    <div className="border-t border-[var(--border)] shrink-0">
      {/* Drag handle to resize */}
      <div
        className="h-3 flex items-center justify-center cursor-ns-resize bg-[var(--card)] hover:bg-[var(--accent)] transition-colors"
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
      >
        <div className="w-8 h-1 rounded-full bg-[var(--muted-foreground)]/40" />
      </div>

      <div className="flex gap-0.5 px-2 py-1.5 bg-[var(--card)]">
        {periods.map((p) => (
          <button
            key={p.value}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              period === p.value ? "bg-[var(--primary)] text-white" : "text-[var(--muted-foreground)] hover:text-white"
            }`}
            onClick={() => setPeriod(p.value)}
          >
            {p.label}
          </button>
        ))}
        <span className="ml-auto text-[var(--muted-foreground)] text-xs self-center">{symbolName}</span>
      </div>
      <div className="relative chart-dark-container" style={{ height: chartHeight, background: "#0d1421" }}>
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: "#0d1421" }}>
            <p className="text-[var(--muted-foreground)] text-xs">{error}</p>
          </div>
        )}
        {(loading || !libLoaded) && (
          <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: "#0d1421" }}>
            <Spinner className="size-6 text-[var(--primary)]" />
          </div>
        )}
        <div ref={containerNodeRef} style={{ width: "100%", height: "100%" }} />
      </div>
    </div>
  )
}
