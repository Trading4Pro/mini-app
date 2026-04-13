"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import Script from "next/script"
import { useCTrader } from "@/hooks/use-ctrader"
import { TRADE_SIDE, ORDER_TYPE } from "@/types/ctrader"
import type { OALightSymbol, OASymbol, OAPosition, OAOrder } from "@/types/ctrader"
import { Spinner } from "@/components/ui/spinner"
import { TradingChart } from "@/components/trading/chart"
import {
  MenuIcon,
  XIcon,
  ChevronLeftIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  StarIcon,
  SearchIcon,
  InfoIcon,
} from "lucide-react"

// ============================================================
// MAIN APP
// ============================================================
export default function TradingApp() {
  const ct = useCTrader()

  const [tgUser, setTgUser] = useState<{ first_name?: string; username?: string } | null>(null)
  const [screen, setScreen] = useState<"markets" | "account" | "activity" | "deal">("markets")
  const [menuOpen, setMenuOpen] = useState(false)
  const [dealSymbol, setDealSymbol] = useState<OALightSymbol | null>(null)
  const [symbolSearch, setSymbolSearch] = useState("")
  const [activityTab, setActivityTab] = useState<"positions" | "orders" | "closed">("positions")
  const [expandedPosition, setExpandedPosition] = useState<number | null>(null)
  const [chartSymbolId, setChartSymbolId] = useState<number | null>(null)

  // Telegram init
  useEffect(() => {
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp
      tg.ready()
      tg.expand()
      setTgUser(tg.initDataUnsafe?.user || null)
    }
  }, [])

  // Auto-connect
  useEffect(() => {
    if (ct.accessToken && ct.status === "disconnected") {
      ct.connect(ct.accessToken, ct.isLive).catch(() => {})
    }
  }, [ct.accessToken, ct.status, ct.isLive, ct.connect])

  const openDeal = useCallback((symbol: OALightSymbol) => {
    setDealSymbol(symbol)
    setScreen("deal")
  }, [])

  const filteredSymbols = useMemo(() => {
    if (!symbolSearch) return ct.symbols
    const q = symbolSearch.toLowerCase()
    return ct.symbols.filter((s) => s.symbolName.toLowerCase().includes(q))
  }, [ct.symbols, symbolSearch])

  const formatPrice = useCallback((price: number | undefined, symbolId: number) => {
    if (price === undefined) return "—"
    const details = ct.symbolDetails.get(symbolId)
    const digits = details?.digits ?? 5
    return (price / 100000).toFixed(digits)
  }, [ct.symbolDetails])

  const formatMoney = useCallback((amount: number, digits = 2) => {
    return (amount / Math.pow(10, digits)).toFixed(2)
  }, [])

  const formatVolume = useCallback((volumeInCents: number, symbolId: number) => {
    const details = ct.symbolDetails.get(symbolId)
    const lotSize = details?.lotSize ?? 100000
    const lots = volumeInCents / 100 / lotSize
    // Show in units (volume in base currency)
    return (volumeInCents / 100).toLocaleString()
  }, [ct.symbolDetails])

  // ---- LOGIN ----
  if (!ct.accessToken) {
    return (
      <>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <main className="min-h-screen flex flex-col items-center justify-center px-6 bg-[var(--background)]">
          <div className="text-center space-y-6 max-w-sm w-full">
            {/* Logo */}
            <div className="space-y-1">
              <div className="w-16 h-16 mx-auto mb-4">
                <svg viewBox="0 0 64 64" className="w-full h-full">
                  <circle cx="32" cy="32" r="28" fill="none" stroke="#ff4444" strokeWidth="3" />
                  <path d="M32 12 L32 20 M32 44 L32 52 M12 32 L20 32 M44 32 L52 32" stroke="#ff4444" strokeWidth="3" strokeLinecap="round" />
                  <circle cx="32" cy="32" r="8" fill="#ff4444" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-white">cTrader</h1>
              <p className="text-[var(--muted-foreground)] text-sm">Open source example</p>
            </div>

            <p className="text-[var(--muted-foreground)] text-sm">
              To experience all the features offered by this app please:
            </p>

            {/* Demo/Live toggle */}
            <div className="flex gap-2 justify-center">
              <button
                className={`px-6 py-2 rounded text-sm font-medium border transition-colors ${
                  !ct.isLive ? "bg-[var(--primary)] text-white border-[var(--primary)]" : "border-[var(--border)] text-[var(--muted-foreground)]"
                }`}
                onClick={() => ct.setIsLive(false)}
              >
                Demo
              </button>
              <button
                className={`px-6 py-2 rounded text-sm font-medium border transition-colors ${
                  ct.isLive ? "bg-[var(--primary)] text-white border-[var(--primary)]" : "border-[var(--border)] text-[var(--muted-foreground)]"
                }`}
                onClick={() => ct.setIsLive(true)}
              >
                Live
              </button>
            </div>

            <button
              onClick={ct.login}
              className="w-full py-3 border border-[var(--primary)] text-[var(--primary)] rounded-lg font-medium text-sm hover:bg-[var(--primary)] hover:text-white transition-colors"
            >
              Log in with your cTrader account
            </button>
          </div>
        </main>
      </>
    )
  }

  // ---- CONNECTING ----
  if (ct.status === "connecting" || ct.status === "authenticating") {
    return (
      <>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <main className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)]">
          <Spinner className="h-8 w-8 text-[var(--primary)]" />
          <p className="text-[var(--muted-foreground)] mt-3 text-sm">
            {ct.status === "connecting" ? "Connecting..." : "Authenticating..."}
          </p>
        </main>
      </>
    )
  }

  // ---- ERROR ----
  if (ct.status === "error") {
    return (
      <>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <main className="min-h-screen flex flex-col items-center justify-center px-6 bg-[var(--background)]">
          <div className="text-center space-y-4 max-w-sm">
            <p className="text-[var(--destructive)] font-medium">Connection failed</p>
            <p className="text-[var(--muted-foreground)] text-sm break-words">{ct.error}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => ct.connect(ct.accessToken!, ct.isLive)}
                className="px-6 py-2 border border-[var(--border)] rounded text-sm text-white"
              >
                Retry
              </button>
              <button onClick={ct.logout} className="px-6 py-2 text-sm text-[var(--muted-foreground)]">
                Logout
              </button>
            </div>
          </div>
        </main>
      </>
    )
  }

  // ---- ACCOUNT SELECTION ----
  if (!ct.selectedAccountId && ct.accounts.length > 0) {
    return (
      <>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <main className="min-h-screen flex flex-col bg-[var(--background)]">
          <div className="h-12 flex items-center justify-center border-b border-[var(--border)]">
            <span className="text-white font-medium">Select Account</span>
          </div>
          <div className="flex-1 p-3 space-y-2">
            {ct.accounts.map((acc) => (
              <button
                key={acc.ctidTraderAccountId}
                className="w-full p-4 rounded-lg border border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)] transition-colors text-left"
                onClick={() => ct.selectAccount(acc.ctidTraderAccountId)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-white text-sm font-medium">{acc.traderLogin}</span>
                    <p className="text-[var(--muted-foreground)] text-xs mt-0.5">
                      ID: {acc.ctidTraderAccountId}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                    acc.isLive ? "bg-[var(--color-buy)]/20 text-[var(--color-buy)]" : "bg-[var(--accent)] text-[var(--muted-foreground)]"
                  }`}>
                    {acc.isLive ? "Live" : "Demo"}
                  </span>
                </div>
              </button>
            ))}
          </div>
          <div className="p-3 border-t border-[var(--border)]">
            <button onClick={ct.logout} className="w-full py-2 text-[var(--muted-foreground)] text-sm">
              Log out
            </button>
          </div>
        </main>
      </>
    )
  }

  // ============================================================
  // MAIN TRADING APP
  // ============================================================
  const moneyDigits = ct.trader?.moneyDigits ?? 2

  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <main className="h-dvh flex flex-col bg-[var(--background)] text-white overflow-hidden">
        {/* ---- MENU OVERLAY ---- */}
        {menuOpen && (
          <div className="fixed inset-0 z-50 flex">
            <div className="w-72 bg-[var(--card)] flex flex-col h-full shadow-2xl">
              <div className="h-12 flex items-center justify-between px-4 border-b border-[var(--border)]">
                <span className="font-medium">Menu</span>
                <button onClick={() => setMenuOpen(false)}>
                  <XIcon className="size-5 text-[var(--muted-foreground)]" />
                </button>
              </div>
              <div className="p-4">
                <p className="text-[var(--muted-foreground)] text-sm">
                  Hello, {tgUser?.first_name || tgUser?.username || "Trader"}
                </p>
              </div>
              <nav className="flex-1">
                <MenuItem label="Markets" onClick={() => { setScreen("markets"); setMenuOpen(false) }} />
                <MenuItem label="My account" onClick={() => { setScreen("account"); setMenuOpen(false) }} />
                <MenuItem
                  label="My activity"
                  badge={ct.positions.length + ct.orders.length}
                  onClick={() => { setScreen("activity"); setMenuOpen(false) }}
                />
              </nav>
              <div className="border-t border-[var(--border)] p-4">
                <button onClick={ct.logout} className="text-[var(--muted-foreground)] text-sm">
                  Log out
                </button>
              </div>
              <div className="px-4 pb-4">
                <span className="text-[var(--primary)] text-xs">Open API support</span>
              </div>
            </div>
            <div className="flex-1 bg-black/50" onClick={() => setMenuOpen(false)} />
          </div>
        )}

        {/* ---- DEAL SCREEN ---- */}
        {screen === "deal" && dealSymbol ? (
          <DealScreen
            symbol={dealSymbol}
            ct={ct}
            formatPrice={formatPrice}
            onBack={() => setScreen("markets")}
          />
        ) : (
          <>
            {/* HEADER */}
            <div className="h-12 flex items-center px-4 border-b border-[var(--border)] shrink-0">
              <button onClick={() => setMenuOpen(true)} className="mr-3">
                <MenuIcon className="size-5 text-[var(--muted-foreground)]" />
              </button>
              <span className="flex-1 text-center font-medium text-sm">
                {screen === "markets" ? "Markets" : screen === "account" ? "My account" : "My activity"}
              </span>
              <div className="w-5" />
            </div>

            {/* ERROR BANNER */}
            {ct.error && (
              <div className="px-4 py-2 bg-[var(--destructive)]/10 text-[var(--destructive)] text-xs">
                {ct.error}
              </div>
            )}

            {/* SCREEN CONTENT */}
            <div className={`flex-1 ${screen === "markets" ? "flex flex-col overflow-hidden" : "overflow-y-auto"}`}>
              {screen === "markets" && (
                <MarketsScreen
                  symbols={filteredSymbols}
                  quotes={ct.quotes}
                  positions={ct.positions}
                  symbolDetails={ct.symbolDetails}
                  symbolSearch={symbolSearch}
                  setSymbolSearch={setSymbolSearch}
                  formatPrice={formatPrice}
                  formatVolume={formatVolume}
                  getSymbolName={ct.getSymbolName}
                  onOpenDeal={openDeal}
                  chartSymbolId={chartSymbolId}
                  setChartSymbolId={setChartSymbolId}
                  getTrendbars={ct.getTrendbars}
                />
              )}
              {screen === "account" && (
                <AccountScreen
                  trader={ct.trader}
                  depositAssetName={ct.depositAssetName}
                  isLive={ct.isLive}
                  positions={ct.positions}
                  orders={ct.orders}
                  formatMoney={formatMoney}
                  moneyDigits={moneyDigits}
                  userName={tgUser?.first_name || tgUser?.username || "Trader"}
                />
              )}
              {screen === "activity" && (
                <ActivityScreen
                  positions={ct.positions}
                  orders={ct.orders}
                  quotes={ct.quotes}
                  symbolDetails={ct.symbolDetails}
                  getSymbolName={ct.getSymbolName}
                  formatPrice={formatPrice}
                  formatVolume={formatVolume}
                  closePosition={ct.closePosition}
                  cancelOrder={ct.cancelOrder}
                  activityTab={activityTab}
                  setActivityTab={setActivityTab}
                  expandedPosition={expandedPosition}
                  setExpandedPosition={setExpandedPosition}
                />
              )}
            </div>

            {/* FOOTER */}
            <div className="h-10 flex items-center justify-between px-4 border-t border-[var(--border)] shrink-0">
              <span className="text-[var(--muted-foreground)] text-xs font-medium">Sources and details</span>
              <div className="flex items-center gap-1.5">
                <svg viewBox="0 0 20 20" className="w-4 h-4">
                  <circle cx="10" cy="10" r="7" fill="none" stroke="#ff4444" strokeWidth="1.5" />
                  <circle cx="10" cy="10" r="2.5" fill="#ff4444" />
                </svg>
                <span className="text-[var(--muted-foreground)] text-xs font-medium">Open API</span>
              </div>
            </div>
          </>
        )}
      </main>
    </>
  )
}

// ============================================================
// MARKETS SCREEN
// ============================================================
// Classify symbols into asset class groups based on name patterns
function classifySymbol(name: string): string {
  const n = name.toUpperCase()
  // Metals
  if (n.includes("XAU") || n.includes("XAG") || n.includes("XPT") || n.includes("XPD") || n.includes("GOLD") || n.includes("SILVER")) return "Metals"
  // Indices
  if (n.includes("US30") || n.includes("US500") || n.includes("US100") || n.includes("SPX") || n.includes("NAS") || n.includes("DAX") || n.includes("FTSE") || n.includes("NIK") || n.includes("AUS") || n.includes("INDEX") || n.match(/^[A-Z]{2,4}\d{2,3}$/)) return "Indices"
  // Crypto
  if (n.includes("BTC") || n.includes("ETH") || n.includes("LTC") || n.includes("XRP") || n.includes("DOGE") || n.includes("SOL") || n.includes("ADA") || n.includes("DOT")) return "Crypto"
  // Energy
  if (n.includes("BRENT") || n.includes("WTI") || n.includes("CRUDE") || n.includes("NGAS") || n.includes("OIL")) return "Energy"
  // Stocks
  if (n.includes(".US") || n.includes(".EU") || n.includes(".UK")) return "Stocks"
  // Default: Forex
  return "Forex"
}

function MarketsScreen({
  symbols, quotes, positions, symbolDetails, symbolSearch, setSymbolSearch,
  formatPrice, formatVolume, getSymbolName, onOpenDeal,
  chartSymbolId, setChartSymbolId, getTrendbars,
}: {
  symbols: OALightSymbol[]
  quotes: Map<number, { bid?: number; ask?: number; timestamp: number }>
  positions: OAPosition[]
  symbolDetails: Map<number, OASymbol>
  symbolSearch: string
  setSymbolSearch: (v: string) => void
  formatPrice: (price: number | undefined, symbolId: number) => string
  formatVolume: (vol: number, symbolId: number) => string
  getSymbolName: (id: number) => string
  onOpenDeal: (symbol: OALightSymbol) => void
  chartSymbolId: number | null
  setChartSymbolId: (id: number | null) => void
  getTrendbars: (symbolId: number, period: number, from: number, to: number) => Promise<any>
}) {
  const [activeCategory, setActiveCategory] = useState("All")

  // Group symbols by asset class
  const grouped = useMemo(() => {
    const groups = new Map<string, OALightSymbol[]>()
    symbols.forEach((s) => {
      const cat = classifySymbol(s.symbolName)
      if (!groups.has(cat)) groups.set(cat, [])
      groups.get(cat)!.push(s)
    })
    return groups
  }, [symbols])

  const categories = useMemo(() => ["All", ...Array.from(grouped.keys()).sort()], [grouped])

  const visibleSymbols = useMemo(() => {
    if (activeCategory === "All") return symbols
    return grouped.get(activeCategory) || []
  }, [activeCategory, symbols, grouped])

  // Chart follows first symbol of the visible category
  const activeChartId = visibleSymbols.length > 0 ? visibleSymbols[0].symbolId : null
  const activeChartSymbol = visibleSymbols.length > 0 ? visibleSymbols[0] : null
  const activeChartDetails = activeChartId ? symbolDetails.get(activeChartId) : null

  // Layout: flex column, symbol list scrolls, chart stays at bottom
  return (
    <div className="flex flex-col h-full">
      {/* Search - fixed */}
      <div className="p-3 shrink-0">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--muted-foreground)]" />
          <input
            placeholder="Search symbols..."
            value={symbolSearch}
            onChange={(e) => setSymbolSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-[var(--card)] border border-[var(--border)] text-white text-sm placeholder:text-[var(--muted-foreground)] outline-none focus:border-[var(--primary)]"
          />
        </div>
      </div>

      {/* Category tabs - fixed */}
      <div className="flex gap-0 px-3 border-b border-[var(--border)] shrink-0 overflow-x-auto">
        {categories.map((cat) => (
          <TabButton key={cat} label={cat} active={activeCategory === cat} onClick={() => setActiveCategory(cat)} />
        ))}
      </div>

      {/* Symbol list - scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {visibleSymbols.map((symbol) => {
          const quote = quotes.get(symbol.symbolId)
          const details = symbolDetails.get(symbol.symbolId)
          const symbolPositions = positions.filter((p) => p.tradeData.symbolId === symbol.symbolId)
          const bid = quote?.bid ? quote.bid / 100000 : undefined
          const ask = quote?.ask ? quote.ask / 100000 : undefined
          const spread = bid && ask ? (ask - bid).toFixed(details?.digits ?? 5) : undefined

          return (
            <div key={symbol.symbolId} className="border-b border-[var(--border)]">
              <div className="px-3 py-2.5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-[var(--accent)] flex items-center justify-center text-xs font-bold text-[var(--muted-foreground)]">
                      {symbol.symbolName.slice(0, 2)}
                    </div>
                    <div>
                      <span className="text-white text-sm font-semibold">{symbol.symbolName}</span>
                      <p className="text-[var(--muted-foreground)] text-xs">{symbol.description || classifySymbol(symbol.symbolName)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {spread && <span className="text-[var(--muted-foreground)] text-xs">{spread}</span>}
                    <StarIcon className="size-4 text-[var(--muted-foreground)]" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => onOpenDeal(symbol)} className="flex-1 py-2 rounded border border-[var(--border)] bg-[var(--card)] text-center">
                    <span className="text-[var(--muted-foreground)] text-xs block">Sell</span>
                    <span className="text-[var(--color-sell)] text-sm font-mono font-semibold tabular-nums">{formatPrice(quote?.bid, symbol.symbolId)}</span>
                  </button>
                  <button onClick={() => onOpenDeal(symbol)} className="flex-1 py-2 rounded border border-[var(--border)] bg-[var(--card)] text-center">
                    <span className="text-[var(--muted-foreground)] text-xs block">Buy</span>
                    <span className="text-[var(--color-buy)] text-sm font-mono font-semibold tabular-nums">{formatPrice(quote?.ask, symbol.symbolId)}</span>
                  </button>
                  <button className="w-8 flex items-center justify-center text-[var(--muted-foreground)]">
                    <InfoIcon className="size-4" />
                  </button>
                </div>
                {symbolPositions.map((pos) => {
                  const isBuy = pos.tradeData.tradeSide === TRADE_SIDE.BUY
                  const currentPrice = isBuy ? quote?.bid : quote?.ask
                  const pipPos = details?.pipPosition ?? 4
                  const entry = pos.price / 100000
                  const current = currentPrice ? currentPrice / 100000 : null
                  const pnlPips = current ? (isBuy ? (current - entry) : (entry - current)) * Math.pow(10, pipPos) : null
                  return (
                    <div key={pos.positionId} className="flex items-center gap-2 mt-1.5 pl-2 text-xs">
                      <span className="text-[var(--muted-foreground)]">{isBuy ? "Buy" : "Sell"}</span>
                      <span className="text-[var(--muted-foreground)]">{formatVolume(pos.tradeData.volume, pos.tradeData.symbolId)}</span>
                      {pnlPips !== null && (
                        <span className={`ml-auto font-mono ${pnlPips >= 0 ? "text-[var(--color-buy)]" : "text-[var(--color-sell)]"}`}>
                          {pnlPips.toFixed(2)}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
        {visibleSymbols.length === 0 && (
          <p className="text-center text-[var(--muted-foreground)] text-sm py-12">
            {symbols.length === 0 ? "Loading symbols..." : "No symbols in this category"}
          </p>
        )}
      </div>

      {/* Chart - STICKY at bottom, never scrolls */}
      {activeChartSymbol && activeChartId && (
        <TradingChart
          symbolId={activeChartId}
          symbolName={activeChartSymbol.symbolName}
          digits={activeChartDetails?.digits ?? 5}
          getTrendbars={getTrendbars}
          height={200}
        />
      )}
    </div>
  )
}

// ============================================================
// DEAL SCREEN
// ============================================================
function DealScreen({
  symbol, ct, formatPrice, onBack,
}: {
  symbol: OALightSymbol
  ct: ReturnType<typeof useCTrader>
  formatPrice: (price: number | undefined, symbolId: number) => string
  onBack: () => void
}) {
  const [side, setSide] = useState<"BUY" | "SELL">("SELL")
  const [submitting, setSubmitting] = useState(false)
  const [popup, setPopup] = useState<{ type: "success" | "error"; title: string; message: string; details?: Record<string, string> } | null>(null)
  const [slEnabled, setSlEnabled] = useState(false)
  const [tpEnabled, setTpEnabled] = useState(false)
  const [trailingEnabled, setTrailingEnabled] = useState(false)

  const quote = ct.quotes.get(symbol.symbolId)
  const details = ct.symbolDetails.get(symbol.symbolId)
  const digits = details?.digits ?? 5

  // Volume params from symbol details (values come in cents from API, divide by 100)
  const minVol = details?.minVolume ? details.minVolume / 100 : 1000
  const maxVol = details?.maxVolume ? details.maxVolume / 100 : 10000000
  const stepVol = details?.stepVolume ? details.stepVolume / 100 : 1000

  // Load last traded volume from localStorage, default to minVolume
  const [volume, setVolume] = useState(() => {
    if (typeof window === "undefined") return minVol
    const saved = localStorage.getItem(`lastVol_${symbol.symbolId}`)
    if (saved) {
      const v = Number(saved)
      if (v >= minVol && v <= maxVol) return v
    }
    return minVol
  })

  // Save volume to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(`lastVol_${symbol.symbolId}`, String(volume))
  }, [volume, symbol.symbolId])

  const bidPrice = formatPrice(quote?.bid, symbol.symbolId)
  const askPrice = formatPrice(quote?.ask, symbol.symbolId)

  // Calculate spread
  const bid = quote?.bid ? quote.bid / 100000 : 0
  const ask = quote?.ask ? quote.ask / 100000 : 0
  const spread = bid && ask ? (ask - bid).toFixed(digits) : "0"

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const volumeInCents = volume * 100

      const res = await ct.placeOrder({
        symbolId: symbol.symbolId,
        tradeSide: side === "BUY" ? TRADE_SIDE.BUY : TRADE_SIDE.SELL,
        volume: volumeInCents,
        orderType: ORDER_TYPE.MARKET,
      })

      console.log("[cTrader] Order response:", res)

      if (res.payloadType === 2132 || res.payloadType === 2142) {
        // ORDER_ERROR_EVENT or general error
        const desc = (res.description as string) || (res.errorCode as string) || "Unknown error"
        setPopup({
          type: "error",
          title: "An error occurred",
          message: `Error description: ${desc}`,
        })
      } else {
        // Success (EXECUTION_EVENT 2126 or other)
        // executionType can be a number (enum) or string:
        // 2=ORDER_ACCEPTED, 3=ORDER_FILLED, 11=ORDER_PARTIAL_FILL
        const execTypeRaw = res.executionType
        const isFilled = execTypeRaw === 3 || execTypeRaw === 11 ||
          String(execTypeRaw).includes("FILL")
        const isAccepted = execTypeRaw === 2 || String(execTypeRaw) === "ORDER_ACCEPTED"

        const order = res.order as Record<string, unknown> | undefined
        const position = res.position as Record<string, unknown> | undefined
        const orderId = order?.orderId ?? ""
        const posId = position?.positionId ?? ""

        setPopup({
          type: "success",
          title: isFilled ? "Position opened" : "Pending order was created",
          message: `${side} ${symbol.symbolName} ${isFilled ? "order was filled" : "pending order was created"}.`,
          details: {
            Amount: `${volume.toLocaleString()}`,
            Price: side === "BUY" ? askPrice : bidPrice,
            ...(orderId ? { "Order ID": String(orderId) } : {}),
            ...(posId ? { "Position ID": String(posId) } : {}),
          },
        })

        // Save last traded volume
        localStorage.setItem(`lastVol_${symbol.symbolId}`, String(volume))
      }
    } catch (err) {
      console.error("[cTrader] Order error:", err)
      setPopup({
        type: "error",
        title: "An error occurred",
        message: err instanceof Error ? err.message : "Order failed",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-12 flex items-center px-4 border-b border-[var(--border)] shrink-0">
        <button onClick={onBack} className="flex items-center gap-1 text-[var(--primary)] text-sm">
          <ChevronLeftIcon className="size-4" />
          Back
        </button>
        <span className="flex-1 text-center font-medium text-sm text-white">
          {side} {symbol.symbolName}
        </span>
        <div className="w-12" />
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Symbol info */}
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-[var(--accent)] flex items-center justify-center text-xs font-bold text-[var(--muted-foreground)]">
            {symbol.symbolName.slice(0, 2)}
          </div>
          <div className="flex-1">
            <span className="text-white font-semibold">{symbol.symbolName}</span>
            <p className="text-[var(--muted-foreground)] text-xs">{symbol.description || "Forex"}</p>
          </div>
          <div className="text-right">
            <span className="text-[var(--color-buy)] text-sm">{spread}</span>
          </div>
          <StarIcon className="size-4 text-[var(--muted-foreground)]" />
        </div>

        {/* Sell / Buy toggle */}
        <div className="px-4 flex gap-2 mb-4">
          <button
            className={`flex-1 py-2.5 rounded border text-center transition-colors ${
              side === "SELL"
                ? "bg-[var(--card)] border-[var(--primary)]"
                : "border-[var(--border)]"
            }`}
            onClick={() => setSide("SELL")}
          >
            <span className="text-[var(--muted-foreground)] text-xs block">Sell</span>
            <span className="text-[var(--color-sell)] text-sm font-mono font-semibold">{bidPrice}</span>
          </button>
          <button
            className={`flex-1 py-2.5 rounded border text-center transition-colors ${
              side === "BUY"
                ? "bg-[var(--card)] border-[var(--primary)]"
                : "border-[var(--border)]"
            }`}
            onClick={() => setSide("BUY")}
          >
            <span className="text-[var(--muted-foreground)] text-xs block">Buy</span>
            <span className="text-[var(--color-buy)] text-sm font-mono font-semibold">{askPrice}</span>
          </button>
          <button className="w-8 flex items-center justify-center text-[var(--muted-foreground)]">
            <InfoIcon className="size-4" />
          </button>
        </div>

        <div className="px-4 space-y-4">
          {/* Volume */}
          <div>
            <span className="text-[var(--muted-foreground)] text-xs block mb-2">Barrels</span>
            <div className="flex gap-2">
              <button
                className="w-12 h-10 rounded bg-[var(--card)] border border-[var(--border)] flex items-center justify-center text-white text-lg"
                onClick={() => setVolume((v) => {
                  const next = v - stepVol
                  // Snap to nearest step multiple
                  const snapped = Math.round(next / stepVol) * stepVol
                  return Math.max(minVol, snapped)
                })}
              >
                −
              </button>
              <input
                type="number"
                value={volume}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (!v || v < minVol) { setVolume(minVol); return }
                  if (v > maxVol) { setVolume(maxVol); return }
                  // Snap to nearest step
                  setVolume(Math.round(v / stepVol) * stepVol)
                }}
                className="flex-1 h-10 text-center rounded bg-[var(--card)] border border-[var(--border)] text-[var(--primary)] font-mono text-sm outline-none"
              />
              <button
                className="w-12 h-10 rounded bg-[var(--card)] border border-[var(--border)] flex items-center justify-center text-white text-lg"
                onClick={() => setVolume((v) => {
                  const next = v + stepVol
                  const snapped = Math.round(next / stepVol) * stepVol
                  return Math.min(maxVol, snapped)
                })}
              >
                +
              </button>
            </div>
          </div>

          <Divider />

          {/* Take Profit */}
          <ToggleRow label="Take profit" enabled={tpEnabled} onToggle={() => setTpEnabled(!tpEnabled)} />

          <Divider />

          {/* Stop Loss */}
          <ToggleRow label="Stop loss" enabled={slEnabled} onToggle={() => setSlEnabled(!slEnabled)} />

          <Divider />

          {/* Trailing Stop */}
          <ToggleRow label="Trailing stop" enabled={trailingEnabled} onToggle={() => setTrailingEnabled(!trailingEnabled)} />
        </div>
      </div>

      {/* Submit button */}
      <div className="p-4 shrink-0">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3.5 rounded-lg bg-[var(--primary)] text-white font-semibold text-sm disabled:opacity-50"
        >
          {submitting ? <Spinner className="size-5 mx-auto" /> : side}
        </button>
      </div>

      {/* Footer */}
      <div className="h-10 flex items-center justify-between px-4 border-t border-[var(--border)] shrink-0">
        <span className="text-[var(--muted-foreground)] text-xs font-medium">Sources and details</span>
        <div className="flex items-center gap-1.5">
          <svg viewBox="0 0 20 20" className="w-4 h-4">
            <circle cx="10" cy="10" r="7" fill="none" stroke="#ff4444" strokeWidth="1.5" />
            <circle cx="10" cy="10" r="2.5" fill="#ff4444" />
          </svg>
          <span className="text-[var(--muted-foreground)] text-xs font-medium">Open API</span>
        </div>
      </div>

      {/* POPUP */}
      {popup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
          <div className="bg-[var(--card)] rounded-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-white font-bold text-center text-lg">{popup.title}</h3>
            <p className="text-[var(--muted-foreground)] text-sm text-center">{popup.message}</p>
            {popup.details && (
              <>
                <div className="border-t border-[var(--border)]" />
                <div className="space-y-2">
                  {Object.entries(popup.details).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-[var(--muted-foreground)]">{k}</span>
                      <span className="text-white font-semibold">{v}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-[var(--border)]" />
              </>
            )}
            <button
              onClick={() => { setPopup(null); if (popup.type === "success") onBack() }}
              className="w-48 mx-auto block py-2.5 rounded-lg bg-[var(--primary)] text-white font-medium text-sm"
            >
              Ok
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// ACCOUNT SCREEN
// ============================================================
function AccountScreen({
  trader, depositAssetName, isLive, positions, orders, formatMoney, moneyDigits, userName,
}: {
  trader: ReturnType<typeof useCTrader>["trader"]
  depositAssetName: string
  isLive: boolean
  positions: OAPosition[]
  orders: OAOrder[]
  formatMoney: (amount: number, digits?: number) => string
  moneyDigits: number
  userName: string
}) {
  if (!trader) return <p className="text-center text-[var(--muted-foreground)] py-8">Loading...</p>

  return (
    <div className="p-4 space-y-4">
      <p className="text-[var(--muted-foreground)] text-sm">Hello, {userName}</p>

      {/* Account selector */}
      <div className="flex items-center gap-2">
        <span className="text-[var(--muted-foreground)] text-sm">Account</span>
        <div className="flex-1 px-3 py-2 rounded bg-[var(--card)] border border-[var(--border)] text-white text-sm">
          {trader.ctidTraderAccountId} — {isLive ? "Live" : "Demo"}
        </div>
      </div>

      <div className="border-t border-[var(--border)]" />

      {/* Metrics */}
      <div className="space-y-3">
        <MetricRow label="Balance:" value={`${formatMoney(trader.balance, moneyDigits)}${depositAssetName}`} />
        <MetricRow label="Leverage:" value={`1:${trader.leverageInCents / 100}`} />
        <MetricRow label="Open Positions:" value={String(positions.length)} />
        <MetricRow label="Pending Orders:" value={String(orders.length)} />
      </div>
    </div>
  )
}

// ============================================================
// ACTIVITY SCREEN
// ============================================================
function ActivityScreen({
  positions, orders, quotes, symbolDetails, getSymbolName,
  formatPrice, formatVolume, closePosition, cancelOrder,
  activityTab, setActivityTab, expandedPosition, setExpandedPosition,
}: {
  positions: OAPosition[]
  orders: OAOrder[]
  quotes: Map<number, { bid?: number; ask?: number; timestamp: number }>
  symbolDetails: Map<number, OASymbol>
  getSymbolName: (id: number) => string
  formatPrice: (price: number | undefined, symbolId: number) => string
  formatVolume: (vol: number, symbolId: number) => string
  closePosition: (positionId: number, volume: number) => Promise<unknown>
  cancelOrder: (orderId: number) => Promise<unknown>
  activityTab: string
  setActivityTab: (t: "positions" | "orders" | "closed") => void
  expandedPosition: number | null
  setExpandedPosition: (id: number | null) => void
}) {
  return (
    <div>
      {/* Tabs */}
      <div className="flex border-b border-[var(--border)]">
        {(["positions", "orders", "closed"] as const).map((tab) => (
          <button
            key={tab}
            className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${
              activityTab === tab
                ? "text-white border-b-2 border-[var(--primary)]"
                : "text-[var(--muted-foreground)]"
            }`}
            onClick={() => setActivityTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Positions */}
      {activityTab === "positions" && (
        <div>
          {positions.map((pos) => {
            const isBuy = pos.tradeData.tradeSide === TRADE_SIDE.BUY
            const quote = quotes.get(pos.tradeData.symbolId)
            const details = symbolDetails.get(pos.tradeData.symbolId)
            const currentPrice = isBuy ? quote?.bid : quote?.ask
            const digits = details?.digits ?? 5
            const pipPos = details?.pipPosition ?? 4
            const entry = pos.price / 100000
            const current = currentPrice ? currentPrice / 100000 : null
            const pnlPips = current
              ? isBuy
                ? (current - entry) * Math.pow(10, pipPos)
                : (entry - current) * Math.pow(10, pipPos)
              : null
            const expanded = expandedPosition === pos.positionId

            return (
              <div key={pos.positionId} className="border-b border-[var(--border)]">
                <button
                  className="w-full px-3 py-3 flex items-center gap-3 text-left"
                  onClick={() => setExpandedPosition(expanded ? null : pos.positionId)}
                >
                  <div className="w-8 h-8 rounded bg-[var(--accent)] flex items-center justify-center text-[10px] font-bold text-[var(--muted-foreground)]">
                    {getSymbolName(pos.tradeData.symbolId).slice(0, 2)}
                  </div>
                  <span className={`text-sm font-medium ${isBuy ? "text-[var(--color-buy)]" : "text-[var(--color-sell)]"}`}>
                    {isBuy ? "Buy" : "Sell"}
                  </span>
                  <span className="text-white text-sm">
                    {formatVolume(pos.tradeData.volume, pos.tradeData.symbolId)}
                  </span>
                  <span className={`ml-auto text-sm font-mono tabular-nums ${
                    pnlPips !== null && pnlPips >= 0 ? "text-[var(--color-buy)]" : "text-[var(--color-sell)]"
                  }`}>
                    {pnlPips !== null ? `${pnlPips >= 0 ? "" : ""}${pnlPips.toFixed(2)}$` : "—"}
                  </span>
                  {expanded ? (
                    <ChevronUpIcon className="size-4 text-[var(--muted-foreground)]" />
                  ) : (
                    <ChevronDownIcon className="size-4 text-[var(--muted-foreground)]" />
                  )}
                </button>

                {expanded && (
                  <div className="px-3 pb-3 space-y-2">
                    <DetailRow label="Position ID" value={String(pos.positionId)} />
                    <DetailRow label="Amount" value={`${formatVolume(pos.tradeData.volume, pos.tradeData.symbolId)}`} />
                    <DetailRow label="Open rate" value={entry.toFixed(digits)} />
                    {current && <DetailRow label="Current rate" value={current.toFixed(digits)} />}
                    {pos.stopLoss && <DetailRow label="Stop Loss" value={(pos.stopLoss / 100000).toFixed(digits)} />}
                    {pos.takeProfit && <DetailRow label="Take Profit" value={(pos.takeProfit / 100000).toFixed(digits)} />}
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => closePosition(pos.positionId, pos.tradeData.volume)}
                        className="flex-1 py-2 rounded bg-[var(--destructive)] text-white text-sm font-medium"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {positions.length === 0 && (
            <p className="text-center text-[var(--muted-foreground)] text-sm py-12">No open positions</p>
          )}
        </div>
      )}

      {/* Orders */}
      {activityTab === "orders" && (
        <div>
          {orders.map((ord) => {
            const isBuy = ord.tradeData.tradeSide === TRADE_SIDE.BUY
            const details = symbolDetails.get(ord.tradeData.symbolId)
            const digits = details?.digits ?? 5
            const price = ord.limitPrice ?? ord.stopPrice ?? 0

            return (
              <div key={ord.orderId} className="border-b border-[var(--border)] px-3 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-[var(--accent)] flex items-center justify-center text-[10px] font-bold text-[var(--muted-foreground)]">
                  {getSymbolName(ord.tradeData.symbolId).slice(0, 2)}
                </div>
                <span className={`text-sm font-medium ${isBuy ? "text-[var(--color-buy)]" : "text-[var(--color-sell)]"}`}>
                  {isBuy ? "Buy" : "Sell"}
                </span>
                <span className="text-white text-sm">
                  {formatVolume(ord.tradeData.volume, ord.tradeData.symbolId)}
                </span>
                <span className="ml-auto text-[var(--muted-foreground)] text-xs">
                  {price > 0 ? (price / 100000).toFixed(digits) : "Market"}
                </span>
                <button
                  onClick={() => cancelOrder(ord.orderId)}
                  className="text-[var(--destructive)]"
                >
                  <XIcon className="size-4" />
                </button>
              </div>
            )
          })}
          {orders.length === 0 && (
            <p className="text-center text-[var(--muted-foreground)] text-sm py-12">No pending orders</p>
          )}
        </div>
      )}

      {activityTab === "closed" && (
        <p className="text-center text-[var(--muted-foreground)] text-sm py-12">No closed positions</p>
      )}
    </div>
  )
}

// ============================================================
// HELPER COMPONENTS
// ============================================================
function MenuItem({ label, badge, onClick }: { label: string; badge?: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-3 border-b border-[var(--border)] hover:bg-[var(--accent)] transition-colors"
    >
      <span className="text-white text-sm">{label}</span>
      <div className="flex items-center gap-2">
        {badge !== undefined && badge > 0 && (
          <span className="bg-[var(--color-buy)] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {badge}
          </span>
        )}
        <ChevronDownIcon className="size-4 text-[var(--muted-foreground)] -rotate-90" />
      </div>
    </button>
  )
}

function TabButton({ label, active, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
        active
          ? "border-[var(--primary)] text-white"
          : "border-transparent text-[var(--muted-foreground)]"
      }`}
    >
      {label}
    </button>
  )
}

function ToggleRow({ label, enabled, onToggle }: { label: string; enabled: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white text-sm">{label}</span>
      <button
        onClick={onToggle}
        className={`w-11 h-6 rounded-full relative transition-colors ${
          enabled ? "bg-[var(--primary)]" : "bg-[var(--accent)]"
        }`}
      >
        <div
          className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
            enabled ? "translate-x-5.5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  )
}

function Divider() {
  return <div className="border-t border-[var(--border)]" />
}

function MetricRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--muted-foreground)] text-sm">{label}</span>
      <span className={`text-sm font-mono ${valueColor || "text-white"}`}>{value}</span>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  )
}
