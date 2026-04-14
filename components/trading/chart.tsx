"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Spinner } from "@/components/ui/spinner"
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  CrosshairMode,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts"

export const TrendbarPeriod = {
  M1: 1, M2: 2, M5: 3, M10: 4, M15: 5, M30: 6,
  H1: 7, H4: 8, H12: 9, D1: 10, W1: 11, MN1: 12,
} as const

const periodToMs: Record<number, number> = {
  [TrendbarPeriod.M1]: 60_000, [TrendbarPeriod.M5]: 5 * 60_000,
  [TrendbarPeriod.M15]: 15 * 60_000, [TrendbarPeriod.M30]: 30 * 60_000,
  [TrendbarPeriod.H1]: 60 * 60_000, [TrendbarPeriod.H4]: 4 * 60 * 60_000,
  [TrendbarPeriod.D1]: 24 * 60 * 60_000,
}

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
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<number>(TrendbarPeriod.M5)
  const [chartHeight, setChartHeight] = useState(height)

  // Create chart
  useEffect(() => {
    if (!containerRef.current || chartRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#1B1C28" },
        textColor: "#8A8E9C",
        fontSize: 11,
        fontFamily: "Inter, system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: "#2A2D3A" },
        horzLines: { color: "#2A2D3A" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#4F6FE3", style: 3, width: 1 },
        horzLine: { color: "#4F6FE3", style: 3, width: 1 },
      },
      rightPriceScale: {
        borderColor: "#2E303C",
        scaleMargins: { top: 0.08, bottom: 0.25 },
      },
      timeScale: {
        borderColor: "#2E303C",
        timeVisible: true,
        secondsVisible: false,
      },
      width: containerRef.current.clientWidth,
      height: chartHeight,
      autoSize: true,
    })

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#049F30",
      downColor: "#EF6161",
      borderUpColor: "#049F30",
      borderDownColor: "#EF6161",
      wickUpColor: "#049F30",
      wickDownColor: "#EF6161",
      priceFormat: { type: "price", precision: digits, minMove: 1 / Math.pow(10, digits) },
    })

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: "#2A43B6",
      priceFormat: { type: "volume" },
      priceScaleId: "",
    })
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    })

    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    volumeSeriesRef.current = volumeSeries

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: chartHeight,
        })
      }
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      volumeSeriesRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update precision when digits change
  useEffect(() => {
    if (candleSeriesRef.current) {
      candleSeriesRef.current.applyOptions({
        priceFormat: { type: "price", precision: digits, minMove: 1 / Math.pow(10, digits) },
      })
    }
  }, [digits])

  // Load data
  const loadData = useCallback(async () => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return
    setLoading(true)
    setError(null)
    try {
      const barMs = periodToMs[period] || 5 * 60_000
      const toMs = Date.now()
      const fromMs = toMs - 500 * barMs

      const res = await getTrendbars(symbolId, period, fromMs, toMs)
      const rawBars = (res.trendbar as RawTrendbar[]) || []
      if (rawBars.length === 0) {
        setError("No chart data")
        candleSeriesRef.current.setData([])
        volumeSeriesRef.current.setData([])
        return
      }

      const divisor = Math.pow(10, digits)
      const candles = rawBars.map((b) => {
        const low = Number(b.low)
        const dO = Number(b.deltaOpen ?? 0)
        const dH = Number(b.deltaHigh ?? 0)
        const dC = Number(b.deltaClose ?? 0)
        return {
          time: (Number(b.utcTimestampInMinutes) * 60) as Time,
          open: (low + dO) / divisor,
          high: (low + dH) / divisor,
          low: low / divisor,
          close: (low + dC) / divisor,
          volume: Number(b.volume) || 0,
        }
      }).sort((a, b) => (a.time as number) - (b.time as number))

      candleSeriesRef.current.setData(candles.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })))
      volumeSeriesRef.current.setData(candles.map(({ time, volume, open, close }) => ({
        time,
        value: volume,
        color: close >= open ? "rgba(4,159,48,0.35)" : "rgba(239,97,97,0.35)",
      })))

      chartRef.current?.timeScale().fitContent()
    } catch (err) {
      console.error("[Chart] Load error:", err)
      setError(err instanceof Error ? err.message : "Chart load failed")
    } finally {
      setLoading(false)
    }
  }, [symbolId, period, digits, getTrendbars])

  useEffect(() => { loadData() }, [loadData])

  const periods = [
    { label: "1M", value: TrendbarPeriod.M1 },
    { label: "5M", value: TrendbarPeriod.M5 },
    { label: "15M", value: TrendbarPeriod.M15 },
    { label: "1H", value: TrendbarPeriod.H1 },
    { label: "4H", value: TrendbarPeriod.H4 },
    { label: "1D", value: TrendbarPeriod.D1 },
  ]

  // Resize grip
  const resizingRef = useRef(false)
  const onResizeStart = (e: React.MouseEvent | React.TouchEvent) => {
    resizingRef.current = true
    e.preventDefault()
  }
  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!resizingRef.current || !containerRef.current) return
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY
      const rect = containerRef.current.getBoundingClientRect()
      const next = Math.max(120, Math.min(500, rect.bottom - clientY))
      setChartHeight(next)
    }
    const onEnd = () => { resizingRef.current = false }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("touchmove", onMove)
    window.addEventListener("mouseup", onEnd)
    window.addEventListener("touchend", onEnd)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("touchmove", onMove)
      window.removeEventListener("mouseup", onEnd)
      window.removeEventListener("touchend", onEnd)
    }
  }, [])

  return (
    <div className="shrink-0 border-t border-[var(--border)]" style={{ background: "#1B1C28" }}>
      <div
        onMouseDown={onResizeStart}
        onTouchStart={onResizeStart}
        className="h-3 flex items-center justify-center cursor-ns-resize hover:bg-[var(--surface-2)] transition-colors"
      >
        <div className="w-10 h-0.5 rounded-full bg-[var(--border-strong)]" />
      </div>

      {/* Timeframe selector */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-[var(--border)]">
        {periods.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
              period === p.value
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--muted-foreground)] hover:bg-[var(--surface-2)]"
            }`}
          >
            {p.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 pr-2">
          <span className="text-[11px] text-[var(--muted-foreground)] font-mono">{symbolName}</span>
        </div>
      </div>

      <div className="relative" style={{ height: chartHeight, background: "#1B1C28" }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <Spinner className="size-5 text-[var(--primary-accent)]" />
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <span className="text-[var(--muted-foreground)] text-xs">{error}</span>
          </div>
        )}
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  )
}
