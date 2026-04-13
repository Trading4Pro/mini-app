"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Spinner } from "@/components/ui/spinner"

// Trendbar period enum matching cTrader Open API
export const TrendbarPeriod = {
  M1: 1,
  M2: 2,
  M5: 3,
  M10: 4,
  M15: 5,
  M30: 6,
  H1: 7,
  H4: 8,
  H12: 9,
  D1: 10,
  W1: 11,
  MN1: 12,
} as const

// Map period enum to library timeframe string
const periodToLibTimeframe: Record<number, string> = {
  [TrendbarPeriod.M1]: "1M",
  [TrendbarPeriod.M5]: "5M",
  [TrendbarPeriod.M15]: "15M",
  [TrendbarPeriod.M30]: "30M",
  [TrendbarPeriod.H1]: "1H",
  [TrendbarPeriod.H4]: "4H",
  [TrendbarPeriod.D1]: "1D",
}

// Map period enum to ms per bar
const periodToMs: Record<number, number> = {
  [TrendbarPeriod.M1]: 60_000,
  [TrendbarPeriod.M5]: 5 * 60_000,
  [TrendbarPeriod.M15]: 15 * 60_000,
  [TrendbarPeriod.M30]: 30 * 60_000,
  [TrendbarPeriod.H1]: 60 * 60_000,
  [TrendbarPeriod.H4]: 4 * 60 * 60_000,
  [TrendbarPeriod.D1]: 24 * 60 * 60_000,
}

interface Trendbar {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface TradingChartProps {
  symbolId: number
  symbolName: string
  digits: number
  getTrendbars: (
    symbolId: number,
    period: number,
    fromTimestamp: number,
    toTimestamp: number,
  ) => Promise<{ trendbar?: Trendbar[]; [key: string]: unknown }>
  height?: number
}

export function TradingChart({
  symbolId,
  symbolName,
  digits,
  getTrendbars,
  height = 200,
}: TradingChartProps) {
  const chartRef = useRef<ReturnType<typeof window.T4PChart> | null>(null)
  const [chartReady, setChartReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState(TrendbarPeriod.M5)
  const loadedRef = useRef(false)
  const currentSymbolRef = useRef("")

  // Initialize chart on mount
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) {
      chartRef.current = null
      loadedRef.current = false
      setChartReady(false)
      return
    }
    if (chartRef.current) return

    if (!window.T4PChart) {
      setError("Chart library not loaded")
      return
    }

    try {
      const inst = new window.T4PChart(node, {
        general: {
          defaultChartType: "candles",
          saveLayout: false,
          saveIndicators: false,
          saveDrawings: false,
        },
      })

      chartRef.current = inst
      if (typeof inst.addEventHandler === "function") {
        inst.addEventHandler("onChartReady", () => {
          setChartReady(true)
        })
      } else {
        setChartReady(true)
      }
    } catch (err) {
      setError("Failed to initialize chart: " + (err instanceof Error ? err.message : String(err)))
    }
  }, [])

  // Load data when symbol, period, or chart readiness changes
  useEffect(() => {
    if (!chartReady || !chartRef.current) return

    const chart = chartRef.current
    const libTimeframe = periodToLibTimeframe[period] || "5M"
    const barMs = periodToMs[period] || 5 * 60_000

    // Calculate time range: load ~500 bars
    const toMs = Date.now()
    const fromMs = toMs - 500 * barMs

    const loadData = async () => {
      setLoading(true)
      setError(null)

      try {
        if (typeof chart.showLoader === "function") chart.showLoader()

        // Set symbol & timeframe BEFORE pushing data (setSymbol clears chart)
        if (typeof chart.setSymbol === "function") chart.setSymbol(symbolName)
        if (typeof chart.setDisplayName === "function") chart.setDisplayName(symbolName)
        if (typeof chart.setTimeframe === "function") chart.setTimeframe(libTimeframe)
        if (typeof chart.clearDrawings === "function") chart.clearDrawings()

        const res = await getTrendbars(symbolId, period, fromMs, toMs)
        const bars = (res.trendbar as Trendbar[]) || []

        if (bars.length === 0) {
          setError("No data available")
          return
        }

        // Set precision
        if (typeof chart.setDecimals === "function") {
          chart.setDecimals(symbolName, digits)
        }

        // Initialize data store
        if (chart.data && typeof chart.data.setSymbols === "function") {
          chart.data.setSymbols([symbolName])
        }

        // Set trading schedule (full week)
        if (chart.data && typeof chart.data.setSchedule === "function") {
          chart.data.setSchedule(symbolName, [{ start: 0, end: 10080 }], 0)
        }

        // Initialize data slot BEFORE setCandles (prevents crash)
        if (chart.data && typeof chart.data.empty === "function") {
          try {
            chart.data.empty(symbolName, libTimeframe)
          } catch {
            /* ignore */
          }
        }

        // Convert and push candles
        // cTrader returns prices as integers (multiply by pipette)
        // Trendbar: open/high/low/close are relative prices in 1/100000
        const candles = bars.map((b) => ({
          symbol: symbolName,
          timeframe: libTimeframe,
          timestamp: Math.floor(b.timestamp / 1000), // CRITICAL: convert ms to seconds
          open: b.open / 100000,
          high: b.high / 100000,
          low: b.low / 100000,
          close: b.close / 100000,
          volume_buy: b.volume || 0,
          volume_sell: 0,
        }))

        if (chart.data && typeof chart.data.setCandles === "function") {
          chart.data.setCandles(candles)
        }

        currentSymbolRef.current = symbolName
      } catch (err) {
        console.error("[Chart] Load error:", err)
        setError(err instanceof Error ? err.message : "Failed to load chart data")
      } finally {
        if (typeof chart?.hideLoader === "function") chart.hideLoader()
        setLoading(false)
      }
    }

    loadData()
  }, [chartReady, symbolId, symbolName, digits, period, getTrendbars])

  const periods = [
    { label: "1M", value: TrendbarPeriod.M1 },
    { label: "5M", value: TrendbarPeriod.M5 },
    { label: "15M", value: TrendbarPeriod.M15 },
    { label: "1H", value: TrendbarPeriod.H1 },
    { label: "4H", value: TrendbarPeriod.H4 },
    { label: "1D", value: TrendbarPeriod.D1 },
  ]

  return (
    <div className="border-t border-[var(--border)]">
      {/* Period selector */}
      <div className="flex gap-0.5 px-2 py-1.5 bg-[var(--card)]">
        {periods.map((p) => (
          <button
            key={p.value}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              period === p.value
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--muted-foreground)] hover:text-white"
            }`}
            onClick={() => setPeriod(p.value)}
          >
            {p.label}
          </button>
        ))}
        <span className="ml-auto text-[var(--muted-foreground)] text-xs self-center">
          {symbolName}
        </span>
      </div>

      {/* Chart container */}
      <div className="relative" style={{ height }}>
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--background)]/80 z-10">
            <p className="text-[var(--muted-foreground)] text-xs">{error}</p>
          </div>
        )}
        {loading && !chartReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--background)] z-10">
            <Spinner className="size-6 text-[var(--primary)]" />
          </div>
        )}
        <div
          ref={containerRef as React.RefCallback<HTMLDivElement>}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    </div>
  )
}
