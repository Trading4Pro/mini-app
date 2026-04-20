"use client"

import { useEffect, useState, useMemo, useCallback, useRef, TouchEvent } from "react"
import { useCTrader } from "@/hooks/use-ctrader"
import { TRADE_SIDE, ORDER_TYPE } from "@/types/ctrader"
import type { OALightSymbol, OASymbol, OAPosition, OAOrder } from "@/types/ctrader"
import { Spinner } from "@/components/ui/spinner"
import { PairFlag } from "@/components/trading/pair-flag"
import {
  MenuIcon,
  XIcon,
  ChevronLeftIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronRightIcon,
  StarIcon,
  SearchIcon,
  InfoIcon,
  PencilIcon,
  PlusIcon,
  MinusIcon,
  ExternalLinkIcon,
  SendIcon,
  GithubIcon,
} from "lucide-react"

type Screen = "markets" | "account" | "activity" | "deal"
type ActivityTab = "positions" | "orders" | "closed"

// ============================================================
// BROKER LIST (Login screen)
// ============================================================
const BROKERS: { name: string; url: string; color: string; abbr: string }[] = [
  { name: "IC Markets", url: "https://www.icmarkets.com/open-new-live-account/?camp=3263", color: "#0F4C81", abbr: "IC" },
  { name: "FxPro", url: "https://direct.fxpro.com.cy/partner/8033201", color: "#E60606", abbr: "Fx" },
  { name: "Fondex", url: "https://www.fondex.com/en/", color: "#19C6A8", abbr: "Fx" },
  { name: "Pepperstone", url: "https://track.pepperstonepartners.com/visit/?bta=35600&nci=5399", color: "#E52A2A", abbr: "P" },
  { name: "TopFX", url: "https://signup.topfx.com.sc/Registration/Main/Account?dest=live&isSpecAts=true&camp=7087", color: "#4A90E2", abbr: "T" },
]

// ============================================================
// MAIN APP
// ============================================================
export default function TradingApp() {
  const ct = useCTrader()

  const [tgUser, setTgUser] = useState<{ first_name?: string; username?: string } | null>(null)
  const [screen, setScreen] = useState<Screen>("markets")
  const [menuOpen, setMenuOpen] = useState(false)
  const [dealSymbol, setDealSymbol] = useState<OALightSymbol | null>(null)
  const [symbolSearch, setSymbolSearch] = useState("")
  const [activityTab, setActivityTab] = useState<ActivityTab>("positions")
  const [expandedPosition, setExpandedPosition] = useState<number | null>(null)
  const [tooltipStep, setTooltipStep] = useState<0 | 1 | 2 | 3>(0) // 0=off, 1/2/3 per spec
  const [closeConfirm, setCloseConfirm] = useState<{ id: number; volume: number } | null>(null)

  // Telegram init
  useEffect(() => {
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp
      tg.ready()
      tg.expand()
      setTgUser(tg.initDataUnsafe?.user || null)
    }
    // Show onboarding tooltip once per device
    if (typeof window !== "undefined" && !localStorage.getItem("ctr_tt_seen")) {
      setTooltipStep(1)
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

  const formatVolume = useCallback((volumeInCents: number) => {
    return (volumeInCents / 100).toLocaleString()
  }, [])

  // Swipe navigation (right-to-left cycles Markets → Account → Activity)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e: TouchEvent) => {
    if (!touchStart.current || screen === "deal") return
    const t = e.changedTouches[0]
    const dx = t.clientX - touchStart.current.x
    const dy = t.clientY - touchStart.current.y
    const ax = Math.abs(dx)
    const ay = Math.abs(dy)
    if (ax > 60 && ax > ay * 2) {
      const order: Screen[] = ["markets", "account", "activity"]
      const idx = order.indexOf(screen)
      if (idx >= 0) {
        if (dx < 0 && idx < order.length - 1) setScreen(order[idx + 1])
        if (dx > 0 && idx > 0) setScreen(order[idx - 1])
      }
    }
    touchStart.current = null
  }

  const dismissTooltip = () => {
    setTooltipStep((s) => (s < 3 ? ((s + 1) as 0 | 1 | 2 | 3) : 0))
    if (tooltipStep >= 3 || tooltipStep === 0) localStorage.setItem("ctr_tt_seen", "1")
  }

  // ---- LOGIN ----
  if (!ct.accessToken) {
    return <LoginScreen onLogin={ct.login} />
  }

  // ---- LOADER (initial connection) ----
  if (ct.status === "connecting" || ct.status === "authenticating") {
    return <LoaderScreen />
  }

  // ---- ERROR ----
  if (ct.status === "error") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 bg-[var(--background)]">
        <div className="text-center space-y-4 max-w-sm">
          <p className="text-[var(--destructive)] font-semibold">Connection failed</p>
          <p className="text-[var(--muted-foreground)] text-sm break-words">{ct.error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => ct.connect(ct.accessToken!, ct.isLive)}
              className="px-6 py-2 rounded-md bg-[var(--primary)] text-white text-sm font-medium"
            >
              Retry
            </button>
            <button onClick={ct.logout} className="px-6 py-2 text-sm text-[var(--muted-foreground)]">
              Logout
            </button>
          </div>
        </div>
      </main>
    )
  }

  // ---- ACCOUNT SELECTION ----
  if (!ct.selectedAccountId && ct.accounts.length > 0) {
    return (
      <main className="min-h-screen flex flex-col bg-[var(--background)]">
        <Header title="Select Account" />
        {ct.error && (
          <div className="px-3 py-2 bg-[var(--destructive)]/10 text-[var(--destructive)] text-xs text-center">
            {ct.error}
          </div>
        )}
        <div className="flex-1 p-3 space-y-2">
          {ct.accounts.map((acc) => (
            <button
              key={acc.ctidTraderAccountId}
              className="w-full p-4 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--primary-accent)] transition-colors text-left"
              onClick={() => ct.selectAccount(acc.ctidTraderAccountId)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-white text-sm font-semibold">{acc.traderLogin}</span>
                  <p className="text-[var(--muted-foreground)] text-xs mt-0.5">
                    ID: {acc.ctidTraderAccountId}
                  </p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide ${
                  acc.isLive ? "bg-[var(--color-buy-soft)] text-[var(--color-buy)]" : "bg-[var(--surface-2)] text-[var(--muted-foreground)]"
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
    )
  }

  // ============================================================
  // MAIN TRADING APP
  // ============================================================
  const moneyDigits = ct.trader?.moneyDigits ?? 2
  const userName = tgUser?.first_name || tgUser?.username || "Trader"

  return (
    <main
      className="h-screen flex flex-col bg-[var(--background)] text-white overflow-hidden"
      style={{ height: "100vh" }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* ---- MENU DRAWER ---- */}
      {menuOpen && (
        <MenuDrawer
          userName={userName}
          positions={ct.positions}
          orders={ct.orders}
          onClose={() => setMenuOpen(false)}
          onNavigate={(s) => { setScreen(s); setMenuOpen(false) }}
          onLogout={ct.logout}
        />
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
          <Header
            title={screen === "markets" ? "Markets" : screen === "account" ? "My account" : "My activity"}
            leftIcon={<MenuIcon className="size-5" />}
            onLeft={() => setMenuOpen(true)}
          />

          {ct.error && (
            <div className="px-4 py-1.5 bg-[var(--destructive)]/10 text-[var(--destructive)] text-xs">
              {ct.error}
            </div>
          )}

          <div className={`flex-1 ${screen === "markets" || screen === "activity" ? "flex flex-col overflow-hidden" : "overflow-y-auto thin-scrollbar"}`}>
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
                onClosePosition={(id, v) => setCloseConfirm({ id, volume: v })}
              />
            )}
            {screen === "account" && (
              <AccountScreen
                trader={ct.trader}
                depositAssetName={ct.depositAssetName}
                isLive={ct.isLive}
                accounts={ct.accounts}
                selectedAccountId={ct.selectedAccountId}
                onSelectAccount={ct.selectAccount}
                positions={ct.positions}
                formatMoney={formatMoney}
                moneyDigits={moneyDigits}
                userName={userName}
              />
            )}
            {screen === "activity" && (
              <ActivityScreen
                positions={ct.positions}
                orders={ct.orders}
                quotes={ct.quotes}
                symbolDetails={ct.symbolDetails}
                getSymbolName={ct.getSymbolName}
                formatVolume={formatVolume}
                onClosePosition={(id, v) => setCloseConfirm({ id, volume: v })}
                cancelOrder={ct.cancelOrder}
                getDealList={ct.getDealList}
                activityTab={activityTab}
                setActivityTab={setActivityTab}
                expandedPosition={expandedPosition}
                setExpandedPosition={setExpandedPosition}
                onEditSymbol={(symbolId) => {
                  const s = ct.symbols.find((x) => x.symbolId === symbolId)
                  if (s) openDeal(s)
                }}
              />
            )}
          </div>

          {screen !== "activity" && <Footer />}
        </>
      )}

      {/* ---- FIRST-SESSION TOOLTIPS (spec: swipe, rotate, menu edge) ---- */}
      {tooltipStep > 0 && screen === "markets" && (
        <TooltipOverlay step={tooltipStep} onDismiss={dismissTooltip} />
      )}

      {/* ---- CLOSE POSITION CONFIRM ---- */}
      {closeConfirm && (
        <ConfirmDialog
          title="Closing position"
          body={`Do you really want to close position ID:${closeConfirm.id}?`}
          onYes={() => {
            ct.closePosition(closeConfirm.id, closeConfirm.volume).catch(() => {})
            setCloseConfirm(null)
          }}
          onNo={() => setCloseConfirm(null)}
        />
      )}
    </main>
  )
}

// ============================================================
// HEADER / FOOTER
// ============================================================
function Header({
  title, leftIcon, onLeft, rightIcon, onRight,
}: {
  title: string
  leftIcon?: React.ReactNode
  onLeft?: () => void
  rightIcon?: React.ReactNode
  onRight?: () => void
}) {
  return (
    <div className="h-11 flex items-center px-4 border-b border-[var(--border)] shrink-0">
      {onLeft ? (
        <button onClick={onLeft} className="text-white -ml-1 p-1">{leftIcon}</button>
      ) : (
        <div className="w-7" />
      )}
      <span className="flex-1 text-center font-semibold text-[15px] text-white tracking-wide">{title}</span>
      {onRight ? (
        <button onClick={onRight} className="text-white -mr-1 p-1">{rightIcon}</button>
      ) : (
        <div className="w-7" />
      )}
    </div>
  )
}

function Footer() {
  return (
    <div
      className="h-10 flex items-center justify-between px-4 shrink-0"
      style={{ background: "var(--footer-bg)", color: "var(--footer-fg)", borderTop: "1px solid var(--footer-border)" }}
    >
      <span className="text-[12px] font-semibold">Sources and details</span>
      <div className="flex items-center gap-1.5">
        <CTraderLogoMark className="w-4 h-4" />
        <span className="text-[12px] font-semibold">Open API</span>
      </div>
    </div>
  )
}

function CTraderLogoMark({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <defs>
        <radialGradient id="ctgr" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#FF8A8A" />
          <stop offset="100%" stopColor="#D11E1E" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill="url(#ctgr)" />
      <path d="M8 8 Q 12 4 16 8 L 14 10 Q 12 8 10 10 Z" fill="#fff" />
      <path d="M8 16 Q 12 20 16 16 L 14 14 Q 12 16 10 14 Z" fill="#fff" />
    </svg>
  )
}

// ============================================================
// LOGIN SCREEN
// ============================================================
function LoginScreen({ onLogin }: { onLogin: () => void }) {
  return (
    <main className="min-h-screen flex flex-col bg-[var(--background)]">
      <div className="flex-1 flex flex-col items-center px-6 pt-16 pb-6">
        <div className="w-20 h-20 mb-4">
          <CTraderAppIcon />
        </div>
        <h1 className="text-[28px] font-bold text-white tracking-tight">cTrader</h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-0.5">Open source example</p>

        <p className="text-white text-sm text-center mt-8">
          To experience all the features<br />offered by this app please:
        </p>

        <button
          onClick={onLogin}
          className="w-full max-w-sm mt-5 py-3.5 rounded-md bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-semibold text-sm transition-colors"
        >
          Log in with your cTrader account
        </button>

        <div className="w-full max-w-sm mt-10">
          <p className="text-white text-sm font-semibold text-center">Don&apos;t have an account yet?</p>
          <p className="text-[var(--muted-foreground)] text-xs text-center mt-1">
            Choose any broker from our &apos;Featured Brokers&apos; list!
          </p>

          <div className="mt-4 space-y-2">
            {BROKERS.map((b) => (
              <a
                key={b.name}
                href={b.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center px-4 py-3 rounded-md bg-[var(--card)] border border-[var(--border)] hover:border-[var(--primary-accent)] transition-colors"
              >
                <span className="flex-1 text-white text-sm font-medium">Continue with {b.name}</span>
                <span
                  className="h-6 px-2 rounded text-[11px] font-bold text-white flex items-center"
                  style={{ background: b.color }}
                >
                  {b.name}
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 py-3 flex items-center gap-3 shrink-0" style={{ background: "var(--footer-bg)" }}>
        <CTraderLogoMark className="w-7 h-7" />
        <div className="flex-1 leading-tight">
          <p className="text-[13px] font-bold" style={{ color: "var(--footer-fg)" }}>Can you create a better app?</p>
          <p className="text-[11px]" style={{ color: "var(--footer-fg)" }}>Reuse our code to save time!</p>
        </div>
      </div>
    </main>
  )
}

function CTraderAppIcon() {
  return (
    <svg viewBox="0 0 80 80" className="w-full h-full">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3B3E8C" />
          <stop offset="100%" stopColor="#1E2153" />
        </linearGradient>
        <radialGradient id="cog" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FF6060" />
          <stop offset="100%" stopColor="#B31818" />
        </radialGradient>
      </defs>
      <rect x="2" y="2" width="76" height="76" rx="16" fill="url(#bg)" />
      {[16, 30, 44].map((y, i) => (
        <g key={i}>
          <path d={`M12 ${y} l3 3 l6 -6`} stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <rect x={24} y={y - 2} width="22" height="3" rx="1.5" fill="#fff" opacity="0.95" />
        </g>
      ))}
      <circle cx="55" cy="52" r="17" fill="url(#cog)" />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i * Math.PI) / 4
        const x = 55 + Math.cos(a) * 20
        const y = 52 + Math.sin(a) * 20
        return <rect key={i} x={x - 2.2} y={y - 2.2} width="4.4" height="4.4" fill="url(#cog)" transform={`rotate(${(i * 45)} ${x} ${y})`} />
      })}
      <path d="M51 52 q4 -5 8 0 q-4 5 -8 0 Z" fill="#fff" />
      <circle cx="55" cy="52" r="2" fill="#B31818" />
    </svg>
  )
}

// ============================================================
// LOADER SCREEN
// ============================================================
function LoaderScreen() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)] px-6">
      <div className="w-24 h-24 mb-5">
        <CTraderAppIcon />
      </div>
      <h1 className="text-[42px] font-bold text-white leading-none tracking-tight">Broker</h1>
      <p className="text-white text-[17px] font-semibold mt-1">Open API Trader</p>
      <Spinner className="size-6 text-[var(--primary-accent)] mt-12" />
    </main>
  )
}

// ============================================================
// MENU DRAWER
// ============================================================
function MenuDrawer({
  userName, positions, orders, onClose, onNavigate, onLogout,
}: {
  userName: string
  positions: OAPosition[]
  orders: OAOrder[]
  onClose: () => void
  onNavigate: (s: Screen) => void
  onLogout: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="w-[78%] max-w-[320px] bg-[var(--card)] flex flex-col h-full shadow-2xl">
        <div className="h-11 flex items-center px-4 border-b border-[var(--border)]">
          <span className="flex-1 text-center text-white font-semibold text-[15px]">Menu</span>
          <button onClick={onClose} className="text-white">
            <XIcon className="size-5" />
          </button>
        </div>

        <div className="px-5 pt-5 pb-3">
          <p className="text-white text-[15px] font-semibold">Hello, {userName}</p>
        </div>

        <nav className="flex-1 px-2">
          <DrawerItem label="Markets" onClick={() => onNavigate("markets")} />
          <DrawerItem label="My account" onClick={() => onNavigate("account")} />
          <DrawerItem
            label="My activity"
            onClick={() => onNavigate("activity")}
            badges={[
              positions.length > 0 ? { n: positions.length, color: "var(--color-buy)" } : null,
              orders.length > 0 ? { n: orders.length, color: "var(--destructive)" } : null,
            ]}
          />
          <DrawerItem label="Manage account" onClick={() => onNavigate("account")} />
        </nav>

        <div className="border-t border-[var(--border)] py-1 px-2">
          <DrawerItem label="Log out" onClick={onLogout} />
          <DrawerItemLink label="Sources and details" href="https://github.com/spotware/Open-API-Example-mobile-trader" icon={<GithubIcon className="size-4" />} />
          <DrawerItemLink label="Open API support" href="https://t.me/ctrader_open_api_support" icon={<SendIcon className="size-4" />} />
          <DrawerItemLink label="Special thanks" href="#" />
        </div>
      </div>
      <div className="flex-1 bg-black/60" onClick={onClose} />
    </div>
  )
}

function DrawerItem({
  label, onClick, badges,
}: {
  label: string
  onClick?: () => void
  badges?: ({ n: number; color: string } | null)[]
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center px-3 py-3 rounded hover:bg-[var(--surface-2)] transition-colors"
    >
      <span className="flex-1 text-left text-white text-[15px]">{label}</span>
      {badges && (
        <span className="flex items-center gap-1 mr-2">
          {badges.filter(Boolean).map((b, i) => (
            <span
              key={i}
              className="min-w-5 h-5 px-1 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
              style={{ background: b!.color }}
            >
              {b!.n}
            </span>
          ))}
        </span>
      )}
      <ChevronRightIcon className="size-4 text-[var(--muted-foreground)]" />
    </button>
  )
}

function DrawerItemLink({ label, href, icon }: { label: string; href: string; icon?: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="w-full flex items-center px-3 py-3 rounded hover:bg-[var(--surface-2)] transition-colors"
    >
      <span className="flex-1 text-left text-white text-[15px]">{label}</span>
      {icon && <span className="text-[var(--muted-foreground)]">{icon}</span>}
    </a>
  )
}

// ============================================================
// MARKETS SCREEN
// ============================================================
function classifySymbol(name: string): string {
  const n = name.toUpperCase()
  if (n.includes("XAU") || n.includes("XAG") || n.includes("XPT") || n.includes("XPD") || n.includes("GOLD") || n.includes("SILVER")) return "Metals"
  if (n.includes("US30") || n.includes("US500") || n.includes("US100") || n.includes("SPX") || n.includes("NAS") || n.includes("DAX") || n.includes("FTSE") || n.includes("NIK") || n.includes("AUS") || n.includes("INDEX") || n.match(/^[A-Z]{2,4}\d{2,3}$/)) return "Indices"
  if (n.includes("BTC") || n.includes("ETH") || n.includes("LTC") || n.includes("XRP") || n.includes("DOGE") || n.includes("SOL") || n.includes("ADA") || n.includes("DOT")) return "Crypto"
  if (n.includes("BRENT") || n.includes("WTI") || n.includes("CRUDE") || n.includes("NGAS") || n.includes("OIL")) return "Energy"
  if (n.includes(".US") || n.includes(".EU") || n.includes(".UK")) return "Stocks"
  return "Forex"
}

function MarketsScreen({
  symbols, quotes, positions, symbolDetails, symbolSearch, setSymbolSearch,
  formatPrice, onOpenDeal, onClosePosition,
}: {
  symbols: OALightSymbol[]
  quotes: Map<number, { bid?: number; ask?: number; timestamp: number }>
  positions: OAPosition[]
  symbolDetails: Map<number, OASymbol>
  symbolSearch: string
  setSymbolSearch: (v: string) => void
  formatPrice: (price: number | undefined, symbolId: number) => string
  formatVolume: (vol: number) => string
  getSymbolName: (id: number) => string
  onOpenDeal: (symbol: OALightSymbol) => void
  onClosePosition: (positionId: number, volume: number) => void
}) {
  const [activeCategory, setActiveCategory] = useState("Favorites")
  const [favorites, setFavorites] = useState<Set<number>>(() => {
    if (typeof window === "undefined") return new Set()
    try { return new Set(JSON.parse(localStorage.getItem("ctr_favs") || "[]") as number[]) } catch { return new Set() }
  })
  const toggleFav = (id: number) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      localStorage.setItem("ctr_favs", JSON.stringify([...next]))
      return next
    })
  }

  const grouped = useMemo(() => {
    const groups = new Map<string, OALightSymbol[]>()
    symbols.forEach((s) => {
      const cat = classifySymbol(s.symbolName)
      if (!groups.has(cat)) groups.set(cat, [])
      groups.get(cat)!.push(s)
    })
    return groups
  }, [symbols])

  const categories = useMemo(() => {
    const preferredOrder = ["Forex", "Metals", "Indices", "Energy", "Crypto", "Stocks"]
    const dynamicCats = Array.from(grouped.keys())
    const sorted = dynamicCats.sort((a, b) => {
      const ia = preferredOrder.indexOf(a)
      const ib = preferredOrder.indexOf(b)
      if (ia === -1 && ib === -1) return a.localeCompare(b)
      if (ia === -1) return 1
      if (ib === -1) return -1
      return ia - ib
    })
    return ["Favorites", ...sorted]
  }, [grouped])

  const visibleSymbols = useMemo(() => {
    if (activeCategory === "Favorites") return symbols.filter((s) => favorites.has(s.symbolId))
    return grouped.get(activeCategory) || []
  }, [activeCategory, symbols, grouped, favorites])

  const [pnlExpanded, setPnlExpanded] = useState(false)

  const totalPnL = useMemo(() => {
    let sum = 0
    for (const pos of positions) {
      const q = quotes.get(pos.tradeData.symbolId)
      const d = symbolDetails.get(pos.tradeData.symbolId)
      if (!q || !d) continue
      const isBuy = pos.tradeData.tradeSide === TRADE_SIDE.BUY
      const current = isBuy ? q.bid : q.ask
      if (!current) continue
      const scale = Math.pow(10, d.digits ?? 5)
      const raw = (pos as unknown as { price?: number; executionPrice?: number; openPrice?: number }).price
        ?? (pos as unknown as { executionPrice?: number }).executionPrice
        ?? (pos as unknown as { openPrice?: number }).openPrice
      const entry = raw == null ? null : raw > 100 ? raw / scale : raw
      if (entry == null || entry < 0.001) continue
      const units = pos.tradeData.volume / 100
      sum += (isBuy ? current / scale - entry : entry - current / scale) * units
    }
    return sum
  }, [positions, quotes, symbolDetails])

  return (
    <div
      className="relative flex flex-col h-full"
      style={{ background: "var(--mkt-bg)", fontFamily: "'Arimo', system-ui, sans-serif" }}
    >
      {/* Search */}
      {symbolSearch !== "" || symbols.length > 30 ? (
        <div className="px-3 py-2 shrink-0">
          <div className="relative">
            <SearchIcon
              className="absolute left-3 top-1/2 -translate-y-1/2 size-4"
              style={{ color: "var(--mkt-text-secondary)" }}
            />
            <input
              placeholder="Search symbols..."
              value={symbolSearch}
              onChange={(e) => setSymbolSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-[2px] text-sm outline-none"
              style={{
                background: "var(--mkt-divider)",
                border: "1px solid var(--mkt-stroke)",
                color: "var(--mkt-text)",
              }}
            />
          </div>
        </div>
      ) : null}

      {/* Category tabs — row 1 (36 px) */}
      <div
        className="flex items-stretch shrink-0 overflow-x-auto hide-scrollbar"
        style={{ background: "var(--mkt-divider)", height: 36 }}
      >
        {categories.map((cat) => {
          const active = activeCategory === cat
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="whitespace-nowrap flex items-center"
              style={{
                padding: "4px 24px",
                background: active ? "var(--mkt-divider-2)" : "transparent",
                borderBottom: active ? "1px solid var(--mkt-text-secondary)" : "1px solid transparent",
                color: active ? "var(--mkt-text)" : "var(--mkt-text-secondary)",
                fontWeight: active ? 700 : 400,
                fontSize: 16,
                lineHeight: "22px",
              }}
            >
              {cat}
            </button>
          )
        })}
      </div>

      {/* Sub-tabs — row 2 (32 px) */}
      <div
        className="flex items-center shrink-0"
        style={{
          height: 32,
          padding: "0 20px",
          borderBottom: "1px solid var(--mkt-divider-2)",
        }}
      >
        <span style={{
          color: "var(--mkt-text-secondary)",
          fontWeight: 700,
          fontSize: 14,
          lineHeight: "22px",
        }}>
          Majors
        </span>
      </div>

      {/* Instrument list */}
      <div className="flex-1 overflow-y-auto min-h-0 thin-scrollbar">
        {visibleSymbols.length === 0 && activeCategory === "Favorites" && (
          <p
            className="text-center text-sm py-10 px-8 leading-relaxed"
            style={{ color: "var(--mkt-text-secondary)" }}
          >
            You still don&apos;t have any symbols in your &quot;favorites&quot; list.
            Tap a star icon on any symbol to add it to &quot;favorites&quot;.
          </p>
        )}

        {visibleSymbols.map((symbol, idx) => {
          const quote = quotes.get(symbol.symbolId)
          const details = symbolDetails.get(symbol.symbolId)
          const symbolPositions = positions.filter((p) => p.tradeData.symbolId === symbol.symbolId)
          const fav = favorites.has(symbol.symbolId)
          const disabled = !symbol.enabled
          const seed = symbol.symbolId
          const pctChange = ((seed * 9301 + 49297) % 2333) / 100 - 11
          const absChange = pctChange * 0.0001

          const positionProps = symbolPositions.map((pos) => {
            const isBuy = pos.tradeData.tradeSide === TRADE_SIDE.BUY
            const current = isBuy ? quote?.bid : quote?.ask
            const scale = Math.pow(10, details?.digits ?? 5)
            const raw = (pos as unknown as { price?: number; executionPrice?: number; openPrice?: number }).price
              ?? (pos as unknown as { executionPrice?: number }).executionPrice
              ?? (pos as unknown as { openPrice?: number }).openPrice
            const entry = raw == null ? null : raw > 100 ? raw / scale : raw
            const curScaled = current ? current / scale : null
            const units = pos.tradeData.volume / 100
            const pnl = (entry != null && entry > 0.001 && curScaled != null)
              ? (isBuy ? curScaled - entry : entry - curScaled) * units
              : null
            return {
              id: pos.positionId,
              side: isBuy ? ("Buy" as const) : ("Sell" as const),
              volume: units,
              pnl,
              entry,
              digits: details?.digits ?? 5,
              onEdit: () => onOpenDeal(symbol),
              onClose: () => onClosePosition(pos.positionId, pos.tradeData.volume),
            }
          })

          return (
            <InstrumentCard
              key={symbol.symbolId}
              name={symbol.symbolName}
              category={classifySymbol(symbol.symbolName)}
              disabled={disabled}
              fav={fav}
              pctChange={pctChange}
              absChange={absChange}
              sellPx={formatPrice(quote?.bid, symbol.symbolId)}
              buyPx={formatPrice(quote?.ask, symbol.symbolId)}
              onToggleFav={() => toggleFav(symbol.symbolId)}
              onBuy={() => onOpenDeal(symbol)}
              onSell={() => onOpenDeal(symbol)}
              positions={positionProps}
            />
          )
        })}

        {visibleSymbols.length === 0 && activeCategory !== "Favorites" && (
          <p
            className="text-center text-sm py-12"
            style={{ color: "var(--mkt-text-secondary)" }}
          >
            {symbols.length === 0 ? "Loading symbols..." : "No symbols in this category"}
          </p>
        )}
      </div>

      {/* Floating PnL badge (spec §10) */}
      {positions.length > 0 && (
        <button
          onClick={() => setPnlExpanded((v) => !v)}
          className="absolute flex items-center text-white"
          style={{
            bottom: 16,
            left: pnlExpanded ? 0 : -126,
            width: 165,
            height: 40,
            padding: "8px 8px 8px 16px",
            gap: 12,
            background: "var(--mkt-negative)",
            boxShadow: "0 -2px 12px 2px rgba(72,76,109,0.2)",
            borderRadius: "0 2px 2px 0",
            transition: "left 220ms ease",
            fontWeight: 550,
            fontSize: 14,
            lineHeight: "22px",
          }}
          aria-label="Total PnL"
        >
          <span className="whitespace-nowrap flex-1 text-left">
            PnL: {totalPnL >= 0 ? "+" : ""}{totalPnL.toFixed(2)}$
          </span>
          <ChevronRightIcon
            className="size-4 shrink-0"
            style={{
              transform: pnlExpanded ? "rotate(90deg)" : "rotate(-90deg)",
              transition: "transform 220ms",
            }}
          />
        </button>
      )}
    </div>
  )
}

// Instrument card per spec §7
function InstrumentCard({
  name, category, disabled, fav, pctChange, absChange, sellPx, buyPx,
  onToggleFav, onBuy, onSell, positions, highlighted,
}: {
  name: string
  category: string
  disabled: boolean
  fav: boolean
  pctChange: number
  absChange: number
  sellPx: string
  buyPx: string
  onToggleFav: () => void
  onBuy: () => void
  onSell: () => void
  positions: {
    id: number
    side: "Buy" | "Sell"
    volume: number
    pnl: number | null
    entry: number | null
    digits: number
    onEdit: () => void
    onClose: () => void
  }[]
  highlighted?: "buy" | "sell"
}) {
  const tText = disabled ? "var(--mkt-text-disabled)" : "var(--mkt-text)"
  const tSub = disabled ? "var(--mkt-text-disabled)" : "var(--mkt-text-secondary)"
  const tStroke = disabled ? "var(--mkt-text-disabled)" : "var(--mkt-stroke)"
  const pctPositive = pctChange >= 0
  const pctColor = disabled
    ? "var(--mkt-text-disabled)"
    : pctPositive
    ? "var(--mkt-positive)"
    : "var(--mkt-negative)"
  const bottomBorder = disabled ? "var(--mkt-stroke-muted)" : "var(--mkt-divider-2)"

  return (
    <div
      className="w-full"
      style={{
        padding: "16px 16px 0",
        borderBottom: `1px solid ${bottomBorder}`,
      }}
    >
      {/* Header row — 48 px */}
      <div className="flex items-center justify-between" style={{ height: 48 }}>
        <div className="flex items-center" style={{ gap: 16 }}>
          <PairFlag name={name} size={48} disabled={disabled} />
          <div className="flex flex-col" style={{ gap: 4 }}>
            <span style={{ color: tText, fontSize: 16, lineHeight: "22px", fontWeight: 700 }}>
              {name}
            </span>
            <span style={{ color: tSub, fontSize: 14, lineHeight: "22px", fontWeight: 400 }}>
              {category}
            </span>
          </div>
        </div>
        <div className="flex items-center" style={{ gap: 16 }}>
          <div className="flex flex-col items-end" style={{ gap: 4 }}>
            <span style={{ color: pctColor, fontSize: 16, lineHeight: "22px", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              {pctPositive ? "+" : ""}{pctChange.toFixed(2)}%
            </span>
            <span style={{ color: pctColor, fontSize: 14, lineHeight: "22px", fontWeight: 400, fontVariantNumeric: "tabular-nums" }}>
              {absChange >= 0 ? "+" : ""}{absChange.toFixed(5)}
            </span>
          </div>
          <button
            onClick={onToggleFav}
            className="flex items-center justify-center"
            style={{ width: 24, height: 24 }}
            aria-label="favorite"
          >
            <StarIcon
              className="size-4"
              style={{
                color: disabled
                  ? "var(--mkt-text-disabled)"
                  : fav ? "var(--mkt-text)" : "var(--mkt-text-disabled)",
                fill: fav && !disabled ? "var(--mkt-text)" : "transparent",
              }}
            />
          </button>
        </div>
      </div>

      {/* Action row — 40 px */}
      <div className="flex" style={{ height: 40, gap: 16, marginTop: 12, marginBottom: positions.length ? 0 : 12 }}>
        <ActionButton
          label="Sell"
          price={sellPx}
          stroke={tStroke}
          labelColor={tText}
          priceColor={disabled ? "var(--mkt-text-disabled)" : "var(--mkt-positive)"}
          disabled={disabled}
          onClick={onSell}
          filled={highlighted === "sell"}
        />
        <ActionButton
          label="Buy"
          price={buyPx}
          stroke={tStroke}
          labelColor={tText}
          priceColor={disabled ? "var(--mkt-text-disabled)" : "var(--mkt-negative)"}
          disabled={disabled}
          onClick={onBuy}
          filled={highlighted === "buy"}
        />
        <button
          className="flex items-center justify-center"
          style={{
            width: 24, height: 40, borderRadius: 2,
            background: disabled ? "var(--mkt-stroke-muted)" : "var(--mkt-divider)",
          }}
          aria-label="info"
        >
          <span
            style={{
              width: 16, height: 16, borderRadius: "50%",
              border: "1px solid #fff",
              color: "#fff",
              fontSize: 10,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontStyle: "italic", lineHeight: 1,
            }}
          >
            i
          </span>
        </button>
      </div>

      {/* Expanded position rows */}
      {positions.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {positions.map((p) => (
            <OpenPositionRow key={p.id} name={name} disabled={disabled} pos={p} />
          ))}
        </div>
      )}
    </div>
  )
}

function ActionButton({
  label, price, stroke, labelColor, priceColor, disabled, onClick, filled,
}: {
  label: string
  price: string
  stroke: string
  labelColor: string
  priceColor: string
  disabled: boolean
  onClick: () => void
  filled?: boolean
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className="flex flex-col items-center justify-center"
      style={{
        flex: 1, height: 40, borderRadius: 2,
        border: `1px solid ${stroke}`,
        cursor: disabled ? "not-allowed" : "pointer",
        background: filled ? "var(--mkt-divider)" : "transparent",
      }}
    >
      <span style={{ color: labelColor, fontSize: 14, lineHeight: "16px", fontWeight: 400 }}>
        {label}
      </span>
      <span style={{
        color: priceColor, fontSize: 14, lineHeight: "16px", fontWeight: 700,
        fontVariantNumeric: "tabular-nums",
      }}>
        {price}
      </span>
    </button>
  )
}

function OpenPositionRow({
  name, disabled, pos,
}: {
  name: string
  disabled: boolean
  pos: {
    id: number
    side: "Buy" | "Sell"
    volume: number
    pnl: number | null
    entry: number | null
    digits: number
    onEdit: () => void
    onClose: () => void
  }
}) {
  const tSub = disabled ? "var(--mkt-text-disabled)" : "var(--mkt-text-secondary)"
  const topBorder = disabled ? "var(--mkt-text-secondary)" : "var(--mkt-divider)"

  const rightText = pos.pnl != null
    ? `${pos.pnl >= 0 ? "+" : ""}${pos.pnl.toFixed(2)}$`
    : pos.entry != null
    ? `@ ${pos.entry.toFixed(pos.digits)}`
    : "—"

  const rightColor = disabled
    ? "var(--mkt-text-disabled)"
    : pos.pnl != null
    ? (pos.pnl >= 0 ? "var(--mkt-positive)" : "var(--mkt-negative)")
    : "var(--mkt-text-secondary)"

  return (
    <div
      className="flex items-center"
      style={{
        height: 32,
        borderTop: `1px solid ${topBorder}`,
        marginLeft: -16, marginRight: -16,
        paddingLeft: 16, paddingRight: 16,
        gap: 8,
      }}
    >
      <div style={{ width: 32, display: "flex", alignItems: "center" }}>
        <PairFlag name={name} size={27} disabled={disabled} />
      </div>
      <div
        style={{
          width: 40, fontSize: 14, lineHeight: "22px",
          color: tSub, fontWeight: 700,
        }}
      >
        {pos.side}
      </div>
      <div
        className="flex-1"
        style={{
          fontSize: 14, lineHeight: "22px",
          color: tSub, fontWeight: 550,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {pos.volume.toLocaleString()}
      </div>
      <div
        style={{
          fontSize: 14, lineHeight: "22px",
          color: rightColor, fontWeight: 400,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {rightText}
      </div>
      <div className="flex items-center shrink-0" style={{ gap: 12, marginLeft: 4 }}>
        <button
          onClick={(e) => { e.stopPropagation(); if (!disabled) pos.onEdit() }}
          disabled={disabled}
          aria-label="edit"
          className="flex items-center justify-center"
          style={{ width: 24, height: 24, color: tSub }}
        >
          <PencilIcon className="size-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); if (!disabled) pos.onClose() }}
          disabled={disabled}
          aria-label="close"
          className="flex items-center justify-center"
          style={{ width: 24, height: 24, color: tSub }}
        >
          <XIcon className="size-4" />
        </button>
      </div>
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
  const [popup, setPopup] = useState<{ type: "success" | "error" | "confirm"; title: string; message: string; details?: Record<string, string> } | null>(null)
  const [slEnabled, setSlEnabled] = useState(false)
  const [tpEnabled, setTpEnabled] = useState(false)
  const [trailingEnabled, setTrailingEnabled] = useState(false)
  const [pendingEnabled, setPendingEnabled] = useState(false)

  const quote = ct.quotes.get(symbol.symbolId)
  const details = ct.symbolDetails.get(symbol.symbolId)
  const digits = details?.digits ?? 5
  const pip = Math.pow(10, -(digits - 1)) // EURUSD → 0.0001, USDJPY → 0.01
  const rateStep = pip                     // one pip per +/- press

  const minVol = details?.minVolume ? details.minVolume / 100 : 1000
  const maxVol = details?.maxVolume ? details.maxVolume / 100 : 10000000
  const stepVol = details?.stepVolume ? details.stepVolume / 100 : 1000

  const [volume, setVolume] = useState(() => {
    if (typeof window === "undefined") return minVol
    const saved = localStorage.getItem(`lastVol_${symbol.symbolId}`)
    if (saved) {
      const v = Number(saved)
      if (v >= minVol && v <= maxVol) return v
    }
    return minVol
  })

  useEffect(() => {
    localStorage.setItem(`lastVol_${symbol.symbolId}`, String(volume))
  }, [volume, symbol.symbolId])

  const bid = quote?.bid ? quote.bid / 100000 : 0
  const ask = quote?.ask ? quote.ask / 100000 : 0
  const refPrice = side === "BUY" ? ask : bid

  // Pending-order rate + expiration (hours)
  const [pendingRate, setPendingRate] = useState<number>(() => refPrice || 0)
  const [expiryHours, setExpiryHours] = useState<number>(24)
  const [tpRate, setTpRate] = useState<number>(() => refPrice || 0)
  const [slRate, setSlRate] = useState<number>(() => refPrice || 0)

  // Seed defaults when a toggle flips ON (use a sensible distance from market)
  useEffect(() => {
    if (pendingEnabled && refPrice && (pendingRate === 0 || Math.abs(pendingRate - refPrice) > refPrice * 0.1)) {
      setPendingRate(refPrice)
    }
  }, [pendingEnabled, refPrice])

  useEffect(() => {
    if (tpEnabled && refPrice && (tpRate === 0 || Math.abs(tpRate - refPrice) > refPrice * 0.1)) {
      const distance = pip * 20 // 20 pips
      setTpRate(side === "BUY" ? refPrice + distance : refPrice - distance)
    }
  }, [tpEnabled, refPrice, side])

  useEffect(() => {
    if (slEnabled && refPrice && (slRate === 0 || Math.abs(slRate - refPrice) > refPrice * 0.1)) {
      const distance = pip * 20
      setSlRate(side === "BUY" ? refPrice - distance : refPrice + distance)
    }
  }, [slEnabled, refPrice, side])

  // Trailing stop requires SL to be on
  useEffect(() => {
    if (!slEnabled && trailingEnabled) setTrailingEnabled(false)
  }, [slEnabled, trailingEnabled])

  const expectedMargin = volume * 0.01
  const expectedLoss = slEnabled && slRate && refPrice
    ? (side === "BUY" ? (refPrice - slRate) * volume : (slRate - refPrice) * volume)
    : 0
  const expectedProfit = tpEnabled && tpRate && refPrice
    ? (side === "BUY" ? (tpRate - refPrice) * volume : (refPrice - tpRate) * volume)
    : 0

  const roundToDigits = (v: number) => Number(v.toFixed(digits))
  const round2 = (v: number) => Number(v.toFixed(2))

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const volumeInCents = volume * 100
      const tradeSide = side === "BUY" ? TRADE_SIDE.BUY : TRADE_SIDE.SELL

      // Decide order type
      let orderType: number = ORDER_TYPE.MARKET
      if (pendingEnabled && pendingRate > 0) {
        // LIMIT: BUY below market or SELL above market. STOP: the opposite.
        if (side === "BUY") orderType = pendingRate < ask ? ORDER_TYPE.LIMIT : ORDER_TYPE.STOP
        else orderType = pendingRate > bid ? ORDER_TYPE.LIMIT : ORDER_TYPE.STOP
      }

      const params: Parameters<typeof ct.placeOrder>[0] = {
        symbolId: symbol.symbolId,
        tradeSide,
        volume: volumeInCents,
        orderType,
      }
      if (pendingEnabled && pendingRate > 0) {
        if (orderType === ORDER_TYPE.LIMIT) params.limitPrice = pendingRate
        else params.stopPrice = pendingRate
        params.expirationTimestamp = Date.now() + Math.max(1, expiryHours) * 3600 * 1000
        params.timeInForce = 1 // GOOD_TILL_DATE
      }
      if (slEnabled && slRate > 0) {
        params.stopLoss = slRate
        if (trailingEnabled) params.trailingStopLoss = true
      }
      if (tpEnabled && tpRate > 0) {
        params.takeProfit = tpRate
      }

      const res = await ct.placeOrder(params)

      if (res.payloadType === 2132 || res.payloadType === 2142) {
        const desc = (res.description as string) || (res.errorCode as string) || "Unknown error"
        setPopup({ type: "error", title: "An error occurred", message: desc })
      } else {
        const execTypeRaw = res.executionType
        const isFilled = execTypeRaw === 3 || execTypeRaw === 11 || String(execTypeRaw).includes("FILL")
        const order = res.order as Record<string, unknown> | undefined
        const position = res.position as Record<string, unknown> | undefined
        const orderId = order?.orderId ?? ""
        const posId = position?.positionId ?? ""

        setPopup({
          type: "success",
          title: isFilled ? "Position opened" : "Pending order was created",
          message: `${side} ${symbol.symbolName} ${isFilled ? "position was opened" : "pending order was created"}`,
          details: {
            Amount: volume.toLocaleString(),
            Price: pendingEnabled
              ? pendingRate.toFixed(digits)
              : side === "BUY" ? ask.toFixed(digits) : bid.toFixed(digits),
            ...(slEnabled ? { "Stop loss": slRate.toFixed(digits) } : {}),
            ...(tpEnabled ? { "Take profit": tpRate.toFixed(digits) } : {}),
            ...(pendingEnabled ? { "Expires in": `${expiryHours}h` } : {}),
            ...(orderId ? { "Order ID": String(orderId) } : {}),
            ...(posId ? { "Position ID": String(posId) } : {}),
          },
        })
        localStorage.setItem(`lastVol_${symbol.symbolId}`, String(volume))
      }
    } catch (err) {
      setPopup({ type: "error", title: "An error occurred", message: err instanceof Error ? err.message : "Order failed" })
    } finally {
      setSubmitting(false)
    }
  }

  const seed = symbol.symbolId
  const pctChange = ((seed * 9301 + 49297) % 2333) / 100 - 11
  const absChange = pctChange * 0.0001

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: "var(--mkt-bg)", fontFamily: "'Arimo', system-ui, sans-serif" }}
    >
      {/* Top nav */}
      <div
        className="h-11 flex items-center px-4 shrink-0"
        style={{ borderBottom: "1px solid var(--mkt-divider-2)" }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1 -ml-1 p-1"
          style={{ color: "var(--mkt-text-secondary)" }}
        >
          <ChevronLeftIcon className="size-5" style={{ color: "var(--mkt-accent-light)" }} />
          <span className="text-[14px] font-bold">Back</span>
        </button>
        <span
          className="flex-1 text-center text-[16px] font-bold"
          style={{ color: "var(--mkt-text)" }}
        >
          {side === "BUY" ? "Buy" : "Sell"} {symbol.symbolName}
        </span>
        <div className="w-12" />
      </div>

      <div className="flex-1 overflow-y-auto thin-scrollbar">
        {/* Instrument card (active, non-expanded, highlighted on committed side) */}
        <InstrumentCard
          name={symbol.symbolName}
          category={classifySymbol(symbol.symbolName)}
          disabled={false}
          fav={false}
          pctChange={pctChange}
          absChange={absChange}
          sellPx={formatPrice(quote?.bid, symbol.symbolId)}
          buyPx={formatPrice(quote?.ask, symbol.symbolId)}
          onToggleFav={() => {}}
          onBuy={() => setSide("BUY")}
          onSell={() => setSide("SELL")}
          positions={[]}
          highlighted={side === "BUY" ? "buy" : "sell"}
        />

        {/* Volume stepper block */}
        <VolumeStepper
          label="Volume"
          value={volume}
          step={stepVol}
          min={minVol}
          max={maxVol}
          onChange={setVolume}
          format={(v) => v.toLocaleString()}
          helperText={`Expected margin ${expectedMargin.toFixed(2)}$`}
        />

        {/* Param rows */}
        <ParamRow
          label={`${side === "BUY" ? "Buy" : "Sell"} when rate is`}
          toggled={pendingEnabled}
          onToggle={setPendingEnabled}
        >
          {pendingEnabled && (
            <>
              <ValueStepper
                value={pendingRate}
                step={rateStep}
                onChange={(v) => setPendingRate(roundToDigits(v))}
                format={(v) => v.toFixed(digits)}
              />
              <div
                className="flex items-center justify-center"
                style={{ gap: 8, marginTop: 8, color: "var(--mkt-text-secondary)", fontSize: 14 }}
              >
                <span>Expires in</span>
                <button
                  className="flex items-center justify-center"
                  style={{ width: 28, height: 28, borderRadius: 2, border: "1px solid var(--mkt-stroke)", color: "var(--mkt-text-secondary)" }}
                  onClick={() => setExpiryHours((h) => Math.max(1, h - 1))}
                >
                  <MinusIcon className="size-3" />
                </button>
                <span
                  className="tabular-nums font-bold"
                  style={{ color: "var(--mkt-accent-light)", minWidth: 40, textAlign: "center" }}
                >
                  {expiryHours}h
                </span>
                <button
                  className="flex items-center justify-center"
                  style={{ width: 28, height: 28, borderRadius: 2, border: "1px solid var(--mkt-stroke)", color: "var(--mkt-text-secondary)" }}
                  onClick={() => setExpiryHours((h) => h + 1)}
                >
                  <PlusIcon className="size-3" />
                </button>
              </div>
            </>
          )}
        </ParamRow>

        <ParamRow label="Take profit" toggled={tpEnabled} onToggle={setTpEnabled}>
          {tpEnabled && (
            <>
              <ValueStepper
                value={tpRate}
                step={rateStep}
                onChange={(v) => setTpRate(roundToDigits(v))}
                format={(v) => v.toFixed(digits)}
              />
              <div
                className="text-center"
                style={{ color: "var(--mkt-text-secondary)", fontSize: 14, lineHeight: "22px", marginTop: 8 }}
              >
                Expected profit {expectedProfit >= 0 ? "+" : ""}{round2(expectedProfit)}$
              </div>
            </>
          )}
        </ParamRow>

        <ParamRow label="Stop loss" toggled={slEnabled} onToggle={setSlEnabled}>
          {slEnabled && (
            <>
              <ValueStepper
                value={slRate}
                step={rateStep}
                onChange={(v) => setSlRate(roundToDigits(v))}
                format={(v) => v.toFixed(digits)}
              />
              <div
                className="text-center"
                style={{ color: "var(--mkt-text-secondary)", fontSize: 14, lineHeight: "22px", marginTop: 8 }}
              >
                Expected loss {round2(-Math.abs(expectedLoss))}$
              </div>
            </>
          )}
        </ParamRow>

        <ParamRow
          label="Trailing stop"
          toggled={trailingEnabled}
          onToggle={setTrailingEnabled}
          dim={!slEnabled}
        />
      </div>

      {/* Primary CTA */}
      <div className="shrink-0" style={{ padding: "12px 16px 16px" }}>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full flex items-center justify-center"
          style={{
            height: 48,
            borderRadius: 2,
            background: "var(--mkt-accent)",
            border: "1px solid var(--mkt-accent)",
            color: "#fff",
            fontSize: 20,
            fontWeight: 700,
            lineHeight: "22px",
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? <Spinner className="size-5" /> : (side === "BUY" ? "Buy" : "Sell")}
        </button>
      </div>

      <DarkFooter />

      {popup && (
        <ExecutionPopup
          type={popup.type}
          title={popup.title}
          message={popup.message}
          details={popup.details}
          onClose={() => {
            setPopup(null)
            if (popup.type === "success") onBack()
          }}
        />
      )}
    </div>
  )
}

function VolumeStepper({
  label, value, step, min, max, onChange, format, helperText,
}: {
  label: string
  value: number
  step: number
  min: number
  max: number
  onChange: (v: number) => void
  format: (v: number) => string
  helperText: string
}) {
  const dec = () => onChange(Math.max(min, Math.round((value - step) / step) * step))
  const inc = () => onChange(Math.min(max, Math.round((value + step) / step) * step))
  return (
    <div style={{ padding: "16px 16px 0", borderBottom: "1px solid var(--mkt-divider-2)" }}>
      <div className="flex flex-col items-center" style={{ gap: 4 }}>
        <span style={{ color: "var(--mkt-text)", fontSize: 14, lineHeight: "22px", fontWeight: 550 }}>
          {label}
        </span>
        <div className="flex items-center" style={{ gap: 12 }}>
          <StepperButton onClick={dec}>
            <MinusIcon className="size-4" />
          </StepperButton>
          <div
            className="flex items-center justify-center"
            style={{
              width: 112, height: 36, borderRadius: 2,
              border: "1px solid var(--mkt-stroke)",
              color: "var(--mkt-accent-light)",
              fontSize: 16, fontWeight: 700, lineHeight: "22px",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {format(value)}
          </div>
          <StepperButton onClick={inc}>
            <PlusIcon className="size-4" />
          </StepperButton>
        </div>
      </div>
      <div
        className="text-center"
        style={{
          color: "var(--mkt-text-secondary)",
          fontSize: 14, lineHeight: "22px",
          padding: "8px 0 16px",
        }}
      >
        {helperText}
      </div>
    </div>
  )
}

function ValueStepper({
  value, step, onChange, format,
}: {
  value: number
  step: number
  onChange: (v: number) => void
  format: (v: number) => string
}) {
  return (
    <div className="flex items-center justify-center" style={{ gap: 16, marginTop: 8 }}>
      <StepperButton onClick={() => onChange(value - step)}>
        <MinusIcon className="size-4" />
      </StepperButton>
      <div
        className="flex items-center justify-center"
        style={{
          width: 112, height: 36, borderRadius: 2,
          border: "1px solid var(--mkt-stroke)",
          color: "var(--mkt-accent-light)",
          fontSize: 16, fontWeight: 700, lineHeight: "22px",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {format(value)}
      </div>
      <StepperButton onClick={() => onChange(value + step)}>
        <PlusIcon className="size-4" />
      </StepperButton>
    </div>
  )
}

function StepperButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center"
      style={{
        width: 36, height: 36, borderRadius: 2,
        border: "1px solid var(--mkt-stroke)",
        color: "var(--mkt-text-secondary)",
        fontSize: 20, fontWeight: 700,
        background: "transparent",
      }}
    >
      {children}
    </button>
  )
}

function ParamRow({
  label, toggled, onToggle, children, dim,
}: {
  label: string
  toggled: boolean
  onToggle: (v: boolean) => void
  children?: React.ReactNode
  dim?: boolean
}) {
  return (
    <div style={{ borderBottom: "1px solid var(--mkt-divider-2)" }}>
      <div
        className="flex items-center justify-between"
        style={{ height: 48, padding: "0 16px" }}
      >
        <span style={{
          color: dim ? "var(--mkt-text-disabled)" : "var(--mkt-text)",
          fontSize: 16, lineHeight: "22px", fontWeight: 700,
        }}>
          {label}
        </span>
        <SpecToggle on={toggled} onChange={onToggle} disabled={dim} />
      </div>
      {toggled && children && (
        <div style={{ padding: "0 16px 16px" }}>
          {children}
        </div>
      )}
    </div>
  )
}

function SpecToggle({
  on, onChange, disabled,
}: {
  on: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={() => { if (!disabled) onChange(!on) }}
      disabled={disabled}
      aria-pressed={on}
      className="relative"
      style={{
        width: 36, height: 20,
        borderRadius: 10,
        border: `1px solid ${disabled ? "var(--mkt-text-disabled)" : on ? "var(--mkt-accent-light)" : "var(--mkt-divider)"}`,
        background: disabled ? "var(--mkt-divider)" : on ? "var(--mkt-accent-light)" : "var(--mkt-divider)",
        opacity: disabled ? 0.5 : 1,
        transition: "background 160ms, border-color 160ms",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: on ? 18 : 2,
          width: 14, height: 14,
          borderRadius: 7,
          background: "#fff",
          boxShadow: on ? "-1px 0 2px rgba(26,30,64,0.2)" : "1px 0 2px rgba(116,118,132,0.2)",
          transition: "left 160ms",
        }}
      />
    </button>
  )
}

function DarkFooter() {
  return (
    <div
      className="h-12 flex items-center justify-between shrink-0"
      style={{ background: "var(--mkt-banner-dark)", padding: "0 16px" }}
    >
      <span style={{
        color: "#fff",
        fontSize: 16, fontWeight: 700, lineHeight: "22px",
        fontFamily: "'Open Sans', 'Arimo', system-ui, sans-serif",
      }}>
        Sources and details
      </span>
      <div className="flex items-center" style={{ gap: 12 }}>
        <CTraderLogoMark className="w-5 h-5" />
        <span style={{
          color: "var(--mkt-banner-gray)",
          fontSize: 16, fontWeight: 600, lineHeight: "22px",
          fontFamily: "'Open Sans', 'Arimo', system-ui, sans-serif",
        }}>
          Open API
        </span>
      </div>
    </div>
  )
}

// ============================================================
// ACCOUNT SCREEN
// ============================================================
function AccountScreen({
  trader, depositAssetName, isLive, accounts, selectedAccountId, onSelectAccount,
  positions, formatMoney, moneyDigits, userName,
}: {
  trader: ReturnType<typeof useCTrader>["trader"]
  depositAssetName: string
  isLive: boolean
  accounts: ReturnType<typeof useCTrader>["accounts"]
  selectedAccountId: number | null
  onSelectAccount: (id: number) => void
  positions: OAPosition[]
  formatMoney: (amount: number, digits?: number) => string
  moneyDigits: number
  userName: string
}) {
  const [darkTheme, setDarkTheme] = useState(true)
  const [showOnMarkets, setShowOnMarkets] = useState(true)
  const [simultaneousTrading, setSimultaneousTrading] = useState(false)
  const [accountDropdown, setAccountDropdown] = useState(false)

  if (!trader) return <p className="text-center text-[var(--muted-foreground)] py-8">Loading...</p>

  const asset = depositAssetName || "USD"
  const balance = Number(formatMoney(trader.balance, moneyDigits))
  const equity = balance
  const unrealizedPnL = -2.1945

  const currentAcct = accounts.find((a) => a.ctidTraderAccountId === selectedAccountId)

  return (
    <div className="px-4 py-4 space-y-5">
      <p className="text-white text-[15px] font-semibold">Hello, {userName}</p>

      {/* Account selector */}
      <div className="flex items-center gap-3">
        <span className="text-white text-sm">Account</span>
        <div className="flex-1 relative">
          <button
            onClick={() => setAccountDropdown((v) => !v)}
            className="w-full px-3 h-10 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-white text-sm flex items-center justify-between"
          >
            <span>
              {currentAcct ? `${currentAcct.traderLogin} — ${isLive ? "Live" : "Demo"}` : "—"}
            </span>
            <ChevronDownIcon className="size-4 text-[var(--muted-foreground)]" />
          </button>
          {accountDropdown && (
            <div className="absolute top-full mt-1 left-0 right-0 rounded-md bg-[var(--surface-2)] border border-[var(--border)] z-10 shadow-xl">
              {accounts.map((a) => (
                <button
                  key={a.ctidTraderAccountId}
                  onClick={() => { onSelectAccount(a.ctidTraderAccountId); setAccountDropdown(false) }}
                  className="w-full px-3 py-2 text-left text-white text-sm hover:bg-[var(--primary)]/30 flex items-center justify-between"
                >
                  <span>{a.traderLogin} — {a.isLive ? "Live" : "Demo"}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                    {a.isLive ? "Live" : "Demo"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-[var(--border)]" />

      {/* Metrics */}
      <div className="space-y-3">
        <MetricRow label="Balance:" value={`${balance.toLocaleString()} ${asset}`} />
        <MetricRow label="Equity:" value={`${equity.toLocaleString()} ${asset}`} />
        <MetricRow label="Margin:" value={`0.00 ${asset}`} />
        <MetricRow label="Free Margin:" value={`${balance.toLocaleString()} ${asset}`} />
        <MetricRow label="Margin Level:" value={`—`} />
        <MetricRow label="Unr Net P&L:" value={`${unrealizedPnL.toFixed(2)} ${asset}`} valueColor="var(--color-sell)" />
      </div>

      <div className="border-t border-[var(--border)]" />

      {/* Settings */}
      <div className="space-y-4">
        <ToggleRow label="Dark theme" enabled={darkTheme} onToggle={() => setDarkTheme(!darkTheme)} />
        <ToggleRow
          label="Show open positions/limit orders in the Market screens"
          enabled={showOnMarkets}
          onToggle={() => setShowOnMarkets(!showOnMarkets)}
        />
        <ToggleRow
          label="Allow simultaneous trading on multiple accounts"
          enabled={simultaneousTrading}
          onToggle={() => setSimultaneousTrading(!simultaneousTrading)}
        />
      </div>

      <div className="border-t border-[var(--border)]" />

      <a
        href="https://t.me/ctrader_open_api_support"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center py-2"
      >
        <span className="flex-1 text-white text-sm">Open API support</span>
        <SendIcon className="size-4 text-[var(--muted-foreground)]" />
      </a>
    </div>
  )
}

// ============================================================
// ACTIVITY SCREEN
// ============================================================
type OADeal = {
  dealId: number
  orderId: number
  positionId: number
  volume: number
  filledVolume: number
  symbolId: number
  createTimestamp: number
  executionTimestamp: number
  executionPrice?: number
  tradeSide: number
  dealStatus: number
  commission?: number
  closePositionDetail?: {
    entryPrice: number
    grossProfit: number
    swap: number
    commission: number
    balance?: number
    closedVolume: number
  }
}

function ActivityScreen({
  positions, orders, quotes, symbolDetails, getSymbolName,
  formatVolume, onClosePosition, cancelOrder, getDealList,
  activityTab, setActivityTab, expandedPosition, setExpandedPosition,
  onEditSymbol,
}: {
  positions: OAPosition[]
  orders: OAOrder[]
  quotes: Map<number, { bid?: number; ask?: number; timestamp: number }>
  symbolDetails: Map<number, OASymbol>
  getSymbolName: (id: number) => string
  formatVolume: (vol: number) => string
  onClosePosition: (positionId: number, volume: number) => void
  cancelOrder: (orderId: number) => Promise<unknown>
  getDealList: (fromMs: number, toMs: number, maxRows?: number) => Promise<{ deal?: OADeal[] } & Record<string, unknown>>
  activityTab: ActivityTab
  setActivityTab: (t: ActivityTab) => void
  expandedPosition: number | null
  setExpandedPosition: (id: number | null) => void
  onEditSymbol: (symbolId: number) => void
}) {
  const [closedDeals, setClosedDeals] = useState<OADeal[]>([])
  const [closedLoading, setClosedLoading] = useState(false)
  const [closedLoaded, setClosedLoaded] = useState(false)
  const [expandedDealId, setExpandedDealId] = useState<number | null>(null)

  useEffect(() => {
    if (activityTab !== "closed" || closedLoaded || closedLoading) return
    setClosedLoading(true)
    const to = Date.now()
    const from = to - 30 * 24 * 60 * 60 * 1000 // last 30 days
    getDealList(from, to, 200)
      .then((res) => {
        const deals = (res.deal as OADeal[]) || []
        // Show closing deals (ones that closed a position) — includes full PnL details
        const closing = deals.filter((d) => d.closePositionDetail)
        closing.sort((a, b) => b.executionTimestamp - a.executionTimestamp)
        setClosedDeals(closing)
        setClosedLoaded(true)
      })
      .catch(() => { /* silent — show empty state */ })
      .finally(() => setClosedLoading(false))
  }, [activityTab, closedLoaded, closedLoading, getDealList])

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: "var(--mkt-bg)", fontFamily: "'Arimo', system-ui, sans-serif" }}
    >
      {/* Segmented tabs */}
      <div
        className="flex shrink-0"
        style={{ height: 36, background: "var(--mkt-divider)" }}
      >
        {([
          { key: "positions" as const, label: "Positions" },
          { key: "orders" as const, label: "Orders" },
          { key: "closed" as const, label: "Closed" },
        ]).map(({ key, label }) => {
          const active = activityTab === key
          return (
            <button
              key={key}
              onClick={() => setActivityTab(key)}
              className="flex items-center justify-center"
              style={{
                flex: 1,
                background: active ? "var(--mkt-divider-2)" : "transparent",
                borderBottom: active ? "1px solid var(--mkt-text)" : "1px solid transparent",
                color: active ? "var(--mkt-text)" : "var(--mkt-text-secondary)",
                fontWeight: active ? 700 : 400,
                fontSize: 16, lineHeight: "22px",
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-y-auto thin-scrollbar">
        {activityTab === "positions" && (
          <PositionsList
            positions={positions}
            quotes={quotes}
            symbolDetails={symbolDetails}
            getSymbolName={getSymbolName}
            formatVolume={formatVolume}
            expandedId={expandedPosition}
            onToggleExpand={(id) => setExpandedPosition(expandedPosition === id ? null : id)}
            onClose={onClosePosition}
            onEdit={(pos) => onEditSymbol(pos.tradeData.symbolId)}
          />
        )}

        {activityTab === "orders" && (
          <OrdersList
            orders={orders}
            symbolDetails={symbolDetails}
            getSymbolName={getSymbolName}
            formatVolume={formatVolume}
            expandedId={expandedPosition}
            onToggleExpand={(id) => setExpandedPosition(expandedPosition === id ? null : id)}
            onCancel={cancelOrder}
            onEdit={(ord) => onEditSymbol(ord.tradeData.symbolId)}
          />
        )}

        {activityTab === "closed" && (
          <ClosedList
            deals={closedDeals}
            loading={closedLoading}
            symbolDetails={symbolDetails}
            getSymbolName={getSymbolName}
            formatVolume={formatVolume}
            expandedId={expandedDealId}
            onToggleExpand={(id) => setExpandedDealId(expandedDealId === id ? null : id)}
          />
        )}
      </div>

      <DarkFooter />
    </div>
  )
}

function DealRow({
  name, side, volume, right, rightColor, expanded, onToggle, children, bottomBorder = true,
}: {
  name: string
  side: "Buy" | "Sell"
  volume: number
  right: React.ReactNode
  rightColor: string
  expanded: boolean
  onToggle: () => void
  children?: React.ReactNode
  bottomBorder?: boolean
}) {
  const sideColor = expanded ? "var(--mkt-text)" : "var(--mkt-text-secondary)"
  return (
    <div style={{ borderBottom: bottomBorder && !expanded ? "1px solid var(--mkt-divider)" : "none" }}>
      <button
        onClick={onToggle}
        className="w-full flex items-center"
        style={{ height: 32, padding: "0 16px", gap: 10 }}
      >
        <div style={{ width: 32, display: "flex", alignItems: "center", flexShrink: 0 }}>
          <PairFlag name={name} size={27} />
        </div>
        <div
          style={{
            width: 40, fontSize: 14, lineHeight: "22px",
            color: sideColor, fontWeight: 700, textAlign: "left",
          }}
        >
          {side}
        </div>
        <div
          className="flex-1 text-left"
          style={{
            fontSize: 14, lineHeight: "22px",
            color: sideColor, fontWeight: 550,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {volume.toLocaleString()}
        </div>
        <div
          className="text-right"
          style={{
            fontSize: 14, lineHeight: "22px",
            color: rightColor,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {right}
        </div>
        <div
          className="flex items-center justify-center"
          style={{ width: 24, height: 24, color: "var(--mkt-text)", flexShrink: 0 }}
        >
          {expanded
            ? <ChevronUpIcon className="size-4" />
            : <ChevronDownIcon className="size-4" />}
        </div>
      </button>
      {expanded && children && (
        <div style={{ padding: "12px 16px 16px", borderBottom: "1px solid var(--mkt-divider)" }}>
          {children}
        </div>
      )}
    </div>
  )
}

function DetailLine({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between" style={{
      fontSize: 14, lineHeight: "22px", color: "var(--mkt-text-secondary)", fontWeight: 550,
      fontVariantNumeric: "tabular-nums",
    }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

function DetailActions({
  primary, secondary, onPrimary, onSecondary, primaryIcon, secondaryIcon,
}: {
  primary: string
  secondary: string
  onPrimary: () => void
  onSecondary: () => void
  primaryIcon: React.ReactNode
  secondaryIcon: React.ReactNode
}) {
  return (
    <div className="flex" style={{ gap: 16, marginTop: 12 }}>
      <button
        onClick={onPrimary}
        className="flex items-center justify-center"
        style={{
          flex: 1, height: 32, borderRadius: 2,
          background: "var(--mkt-accent)", color: "#fff",
          fontSize: 14, fontWeight: 700, lineHeight: "22px",
          gap: 4,
        }}
      >
        <span>{primary}</span>
        {primaryIcon}
      </button>
      <button
        onClick={onSecondary}
        className="flex items-center justify-center"
        style={{
          flex: 1, height: 32, borderRadius: 2,
          border: "1px solid var(--mkt-divider-2)",
          color: "var(--mkt-text)",
          fontSize: 14, fontWeight: 700, lineHeight: "22px",
          background: "transparent", gap: 4,
        }}
      >
        <span>{secondary}</span>
        {secondaryIcon}
      </button>
    </div>
  )
}

function PositionsList({
  positions, quotes, symbolDetails, getSymbolName, formatVolume,
  expandedId, onToggleExpand, onClose, onEdit,
}: {
  positions: OAPosition[]
  quotes: Map<number, { bid?: number; ask?: number; timestamp: number }>
  symbolDetails: Map<number, OASymbol>
  getSymbolName: (id: number) => string
  formatVolume: (vol: number) => string
  expandedId: number | null
  onToggleExpand: (id: number) => void
  onClose: (positionId: number, volume: number) => void
  onEdit: (pos: OAPosition) => void
}) {
  if (positions.length === 0) {
    return (
      <p className="text-center text-sm py-16 px-6" style={{ color: "var(--mkt-text-secondary)" }}>
        No active positions in this account at this moment
      </p>
    )
  }
  return (
    <div>
      {positions.map((pos) => {
        const isBuy = pos.tradeData.tradeSide === TRADE_SIDE.BUY
        const name = getSymbolName(pos.tradeData.symbolId)
        const quote = quotes.get(pos.tradeData.symbolId)
        const d = symbolDetails.get(pos.tradeData.symbolId)
        const digits = d?.digits ?? 5
        const scale = Math.pow(10, digits)
        const raw = (pos as unknown as { price?: number; executionPrice?: number; openPrice?: number }).price
          ?? (pos as unknown as { executionPrice?: number }).executionPrice
          ?? (pos as unknown as { openPrice?: number }).openPrice
        const entry = raw == null ? null : raw > 100 ? raw / scale : raw
        const currentRaw = isBuy ? quote?.bid : quote?.ask
        const current = currentRaw ? currentRaw / scale : null
        const units = pos.tradeData.volume / 100
        const gross = entry != null && entry > 0.001 && current != null
          ? (isBuy ? current - entry : entry - current) * units
          : null
        const commission = (pos.commission ?? 0) / Math.pow(10, pos.moneyDigits ?? 2)
        const swap = (pos.swap ?? 0) / Math.pow(10, pos.moneyDigits ?? 2)
        const net = gross != null ? gross - commission + swap : null
        const expanded = expandedId === pos.positionId
        const pnlColor = (gross ?? 0) >= 0 ? "var(--mkt-positive)" : "var(--mkt-negative)"

        return (
          <DealRow
            key={pos.positionId}
            name={name}
            side={isBuy ? "Buy" : "Sell"}
            volume={units}
            right={gross != null ? `${gross >= 0 ? "+" : ""}${gross.toFixed(2)}$` : "—"}
            rightColor={gross != null ? pnlColor : "var(--mkt-text-secondary)"}
            expanded={expanded}
            onToggle={() => onToggleExpand(pos.positionId)}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <DetailLine label="Position ID:" value={`ID${pos.positionId}`} />
              <DetailLine label="Amount:" value={formatVolume(pos.tradeData.volume)} />
              {gross != null && (
                <DetailLine label="Gross PnL:" value={`${gross.toFixed(2)}$`} />
              )}
              {net != null && (
                <DetailLine label="Net PnL:" value={`${net.toFixed(2)}$`} />
              )}
              <DetailLine label="Commission:" value={`${commission.toFixed(2)}$`} />
              <DetailLine label="Swap:" value={`${swap.toFixed(2)}$`} />
              {entry != null && <DetailLine label="Open rate:" value={entry.toFixed(digits)} />}
              <DetailLine label="Open time:" value={new Date(pos.tradeData.openTimestamp).toLocaleString()} />
              {pos.stopLoss && <DetailLine label="Stop loss:" value={(pos.stopLoss / scale).toFixed(digits)} />}
              {pos.takeProfit && <DetailLine label="Take profit:" value={(pos.takeProfit / scale).toFixed(digits)} />}
            </div>
            <DetailActions
              primary="Edit"
              secondary="Close"
              onPrimary={() => onEdit(pos)}
              onSecondary={() => onClose(pos.positionId, pos.tradeData.volume)}
              primaryIcon={<PencilIcon className="size-4" />}
              secondaryIcon={<XIcon className="size-4" />}
            />
          </DealRow>
        )
      })}
    </div>
  )
}

function OrdersList({
  orders, symbolDetails, getSymbolName, formatVolume,
  expandedId, onToggleExpand, onCancel, onEdit,
}: {
  orders: OAOrder[]
  symbolDetails: Map<number, OASymbol>
  getSymbolName: (id: number) => string
  formatVolume: (vol: number) => string
  expandedId: number | null
  onToggleExpand: (id: number) => void
  onCancel: (orderId: number) => Promise<unknown>
  onEdit: (ord: OAOrder) => void
}) {
  if (orders.length === 0) {
    return (
      <p className="text-center text-sm py-16 px-6" style={{ color: "var(--mkt-text-secondary)" }}>
        No pending orders in this account at this moment
      </p>
    )
  }
  const typeName = (t: number) => t === 2 ? "Limit" : t === 3 ? "Stop" : t === 4 ? "Stop Limit" : "Market"
  return (
    <div>
      {orders.map((ord) => {
        const isBuy = ord.tradeData.tradeSide === TRADE_SIDE.BUY
        const name = getSymbolName(ord.tradeData.symbolId)
        const d = symbolDetails.get(ord.tradeData.symbolId)
        const digits = d?.digits ?? 5
        const scale = Math.pow(10, digits)
        const rate = ord.limitPrice ?? ord.stopPrice
        const rateDisp = rate ? (rate / scale).toFixed(digits) : "Market"
        const units = ord.tradeData.volume / 100
        const expanded = expandedId === ord.orderId

        return (
          <DealRow
            key={ord.orderId}
            name={name}
            side={isBuy ? "Buy" : "Sell"}
            volume={units}
            right={`@ ${rateDisp}`}
            rightColor="var(--mkt-text-secondary)"
            expanded={expanded}
            onToggle={() => onToggleExpand(ord.orderId)}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <DetailLine label="Order ID:" value={`ID${ord.orderId}`} />
              <DetailLine label="Type:" value={typeName(ord.orderType)} />
              <DetailLine label="Side:" value={isBuy ? "Buy" : "Sell"} />
              <DetailLine label="Amount:" value={formatVolume(ord.tradeData.volume)} />
              <DetailLine label="Requested rate:" value={rateDisp} />
              {ord.stopLoss && <DetailLine label="Stop loss:" value={(ord.stopLoss / scale).toFixed(digits)} />}
              {ord.takeProfit && <DetailLine label="Take profit:" value={(ord.takeProfit / scale).toFixed(digits)} />}
              {ord.expirationTimestamp && (
                <DetailLine label="Expires:" value={new Date(ord.expirationTimestamp).toLocaleString()} />
              )}
            </div>
            <DetailActions
              primary="Edit"
              secondary="Cancel"
              onPrimary={() => onEdit(ord)}
              onSecondary={() => onCancel(ord.orderId).catch(() => {})}
              primaryIcon={<PencilIcon className="size-4" />}
              secondaryIcon={<XIcon className="size-4" />}
            />
          </DealRow>
        )
      })}
    </div>
  )
}

function ClosedList({
  deals, loading, symbolDetails, getSymbolName, formatVolume,
  expandedId, onToggleExpand,
}: {
  deals: OADeal[]
  loading: boolean
  symbolDetails: Map<number, OASymbol>
  getSymbolName: (id: number) => string
  formatVolume: (vol: number) => string
  expandedId: number | null
  onToggleExpand: (id: number) => void
}) {
  if (loading && deals.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="size-6" style={{ color: "var(--mkt-accent-light)" }} />
      </div>
    )
  }
  if (deals.length === 0) {
    return (
      <p className="text-center text-sm py-16 px-6" style={{ color: "var(--mkt-text-secondary)" }}>
        No recent trading activity was found in the last 30 days.
      </p>
    )
  }
  return (
    <div>
      {deals.map((d) => {
        const isBuy = d.tradeSide === TRADE_SIDE.BUY
        const name = getSymbolName(d.symbolId)
        const sym = symbolDetails.get(d.symbolId)
        const digits = sym?.digits ?? 5
        const scale = Math.pow(10, digits)
        const close = d.executionPrice ?? 0
        const entry = d.closePositionDetail?.entryPrice ?? 0
        const gross = (d.closePositionDetail?.grossProfit ?? 0) / 100 // moneyDigits=2 for most
        const swap = (d.closePositionDetail?.swap ?? 0) / 100
        const commission = (d.closePositionDetail?.commission ?? 0) / 100
        const net = gross - commission + swap
        const units = d.filledVolume / 100
        const expanded = expandedId === d.dealId
        const pnlColor = gross >= 0 ? "var(--mkt-positive)" : "var(--mkt-negative)"

        // For a closing deal, the side that was closed is opposite to d.tradeSide
        const closedSide = isBuy ? "Sell" : "Buy"

        return (
          <DealRow
            key={d.dealId}
            name={name}
            side={closedSide as "Buy" | "Sell"}
            volume={units}
            right={`${gross >= 0 ? "+" : ""}${gross.toFixed(2)}$`}
            rightColor={pnlColor}
            expanded={expanded}
            onToggle={() => onToggleExpand(d.dealId)}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <DetailLine label="Position ID:" value={`ID${d.positionId}`} />
              <DetailLine label="Amount:" value={formatVolume(d.filledVolume)} />
              <DetailLine label="Gross PnL:" value={`${gross.toFixed(2)}$`} />
              <DetailLine label="Net PnL:" value={`${net.toFixed(2)}$`} />
              <DetailLine label="Commission:" value={`${commission.toFixed(2)}$`} />
              <DetailLine label="Swap:" value={`${swap.toFixed(2)}$`} />
              {entry > 0 && <DetailLine label="Open rate:" value={(entry / scale).toFixed(digits)} />}
              {close > 0 && <DetailLine label="Close rate:" value={(close / scale).toFixed(digits)} />}
              <DetailLine label="Close time:" value={new Date(d.executionTimestamp).toLocaleString()} />
            </div>
          </DealRow>
        )
      })}
    </div>
  )
}

// ============================================================
// TOOLTIP OVERLAY (first session)
// ============================================================
function TooltipOverlay({ step, onDismiss }: { step: 1 | 2 | 3 | 0; onDismiss: () => void }) {
  if (step === 0) return null
  const texts = {
    1: "Swipe right to left for quicker navigation between screens",
    2: "Rotate phone to get full screen chart with menu",
    3: "Swipe from the left edge to right for quicker access to app's menu",
  } as const
  return (
    <div className="absolute inset-0 z-40 tooltip-overlay flex flex-col items-center justify-center px-10 text-center">
      <button onClick={onDismiss} className="absolute top-3 right-3 text-white p-2">
        <XIcon className="size-5" />
      </button>
      <div className="w-20 h-20 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mb-5">
        {step === 1 && <span className="text-3xl">👆</span>}
        {step === 2 && <span className="text-3xl">📱</span>}
        {step === 3 && <span className="text-3xl">👉</span>}
      </div>
      <p className="text-white text-[15px] font-semibold max-w-[260px] leading-relaxed">
        {texts[step]}
      </p>
      <button onClick={onDismiss} className="text-[var(--muted-foreground)] text-xs mt-8">
        Don&apos;t show me again
      </button>
    </div>
  )
}

// ============================================================
// DIALOGS
// ============================================================
function ConfirmDialog({
  title, body, onYes, onNo,
}: {
  title: string
  body: string
  onYes: () => void
  onNo: () => void
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-8">
      <div className="bg-[var(--card)] rounded-xl w-full max-w-sm p-6 space-y-4 shadow-2xl border border-[var(--border)]">
        <h3 className="text-white font-bold text-center text-base">{title}</h3>
        <p className="text-white text-sm text-center leading-relaxed">{body}</p>
        <div className="flex gap-2 pt-2">
          <button
            onClick={onNo}
            className="flex-1 py-2.5 rounded-md bg-[var(--surface-2)] text-white font-medium text-sm"
          >
            No
          </button>
          <button
            onClick={onYes}
            className="flex-1 py-2.5 rounded-md bg-[var(--primary)] text-white font-medium text-sm"
          >
            Yes
          </button>
        </div>
      </div>
    </div>
  )
}

function ExecutionPopup({
  type, title, message, details, onClose,
}: {
  type: "success" | "error" | "confirm"
  title: string
  message: string
  details?: Record<string, string>
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-8">
      <div className="bg-[var(--card)] rounded-xl w-full max-w-sm p-6 space-y-4 shadow-2xl border border-[var(--border)]">
        <h3 className="text-white font-bold text-center text-base">{title}</h3>
        <p className="text-white text-sm text-center leading-relaxed">{message}</p>
        {details && (
          <>
            <div className="border-t border-[var(--border)]" />
            <div className="space-y-2">
              {Object.entries(details).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span className="text-[var(--muted-foreground)]">{k}</span>
                  <span className="text-white font-semibold tabular-nums">{v}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-[var(--border)]" />
          </>
        )}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-md bg-[var(--primary)] text-white font-semibold text-sm"
        >
          {type === "error" ? "Ok" : "Ok"}
        </button>
      </div>
    </div>
  )
}

// ============================================================
// HELPER COMPONENTS
// ============================================================
function TabButton({ label, active, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 text-[13px] font-semibold transition-colors whitespace-nowrap relative ${
        active ? "text-white" : "text-[var(--muted-foreground)]"
      }`}
    >
      {label}
      {active && (
        <span className="absolute bottom-0 left-3 right-3 h-[3px] bg-[var(--primary-accent)]" />
      )}
    </button>
  )
}

function ToggleRow({ label, enabled, onToggle }: { label: string; enabled: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-white text-sm flex-1">{label}</span>
      <button
        onClick={onToggle}
        className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${
          enabled ? "bg-[var(--primary)]" : "bg-[var(--surface-2)]"
        }`}
      >
        <div
          className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform shadow"
          style={{ transform: enabled ? "translateX(22px)" : "translateX(2px)" }}
        />
      </button>
    </div>
  )
}

function MetricRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white text-sm">{label}</span>
      <span className="text-sm font-mono tabular-nums font-semibold" style={{ color: valueColor || "#fff" }}>
        {value}
      </span>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <span className="text-white tabular-nums">{value}</span>
    </div>
  )
}
