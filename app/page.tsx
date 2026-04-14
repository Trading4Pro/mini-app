"use client"

import { useEffect, useState, useMemo, useCallback, useRef, TouchEvent } from "react"
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
  const [chartSymbolId, setChartSymbolId] = useState<number | null>(null)
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

          <div className={`flex-1 ${screen === "markets" ? "flex flex-col overflow-hidden" : "overflow-y-auto thin-scrollbar"}`}>
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
                activityTab={activityTab}
                setActivityTab={setActivityTab}
                expandedPosition={expandedPosition}
                setExpandedPosition={setExpandedPosition}
              />
            )}
          </div>

          <Footer />
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

// Currency code → colour + short label for custom flag badge
const CCY_STYLE: Record<string, { bg: string; fg: string; stripe?: string }> = {
  USD: { bg: "#0A3161", fg: "#fff", stripe: "#B22234" },
  EUR: { bg: "#003399", fg: "#FFCC00" },
  GBP: { bg: "#012169", fg: "#fff", stripe: "#C8102E" },
  JPY: { bg: "#fff", fg: "#BC002D", stripe: "#BC002D" },
  CHF: { bg: "#D52B1E", fg: "#fff" },
  AUD: { bg: "#012169", fg: "#fff", stripe: "#E4002B" },
  CAD: { bg: "#D52B1E", fg: "#fff" },
  NZD: { bg: "#012169", fg: "#fff" },
  SGD: { bg: "#ED2939", fg: "#fff" },
  HKD: { bg: "#DE2910", fg: "#fff" },
  SEK: { bg: "#006AA7", fg: "#FECC00" },
  NOK: { bg: "#BA0C2F", fg: "#fff" },
  DKK: { bg: "#C60C30", fg: "#fff" },
  MXN: { bg: "#006847", fg: "#fff", stripe: "#CE1126" },
  ZAR: { bg: "#007749", fg: "#FFB81C" },
  PLN: { bg: "#fff", fg: "#DC143C", stripe: "#DC143C" },
  TRY: { bg: "#E30A17", fg: "#fff" },
  CNH: { bg: "#DE2910", fg: "#FFDE00" },
  RUB: { bg: "#fff", fg: "#1C3578", stripe: "#D52B1E" },
  BRL: { bg: "#009739", fg: "#FEDD00" },
  XAU: { bg: "#FFC107", fg: "#3A2A00" },
  XAG: { bg: "#BFC6CC", fg: "#2C2C2C" },
  XPT: { bg: "#8D8D8D", fg: "#fff" },
  XPD: { bg: "#5A5A5A", fg: "#fff" },
  BTC: { bg: "#F7931A", fg: "#fff" },
  ETH: { bg: "#627EEA", fg: "#fff" },
  LTC: { bg: "#345D9D", fg: "#fff" },
  XRP: { bg: "#000", fg: "#fff" },
  DOGE: { bg: "#C3A634", fg: "#fff" },
  SOL: { bg: "#9945FF", fg: "#fff" },
}
function currencyPairFromName(name: string): [string, string | null] {
  const up = name.toUpperCase().replace(/[^A-Z]/g, "")
  if (up.length >= 6) return [up.slice(0, 3), up.slice(3, 6)]
  if (up.length >= 3) return [up.slice(0, 3), null]
  return [up, null]
}
function CurrencyBadge({ code, size = 20 }: { code: string; size?: number }) {
  const style = CCY_STYLE[code] || { bg: "#404358", fg: "#fff" }
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-bold leading-none select-none"
      style={{
        width: size,
        height: size,
        background: style.stripe
          ? `linear-gradient(180deg, ${style.bg} 0%, ${style.bg} 50%, ${style.stripe} 50%, ${style.stripe} 100%)`
          : style.bg,
        color: style.fg,
        fontSize: Math.round(size * 0.42),
        letterSpacing: "-0.02em",
      }}
    >
      {code.slice(0, 3)}
    </span>
  )
}
function PairBadge({ name, size = 20 }: { name: string; size?: number }) {
  const [a, b] = currencyPairFromName(name)
  if (!b) return <CurrencyBadge code={a} size={size} />
  return (
    <span className="inline-flex items-center" style={{ width: size + 10 }}>
      <CurrencyBadge code={a} size={size} />
      <span style={{ marginLeft: -8, zIndex: 1 }}>
        <CurrencyBadge code={b} size={size} />
      </span>
    </span>
  )
}

function MarketsScreen({
  symbols, quotes, positions, symbolDetails, symbolSearch, setSymbolSearch,
  formatPrice, formatVolume, getSymbolName, onOpenDeal, onClosePosition,
  chartSymbolId, setChartSymbolId, getTrendbars,
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
  chartSymbolId: number | null
  setChartSymbolId: (id: number | null) => void
  getTrendbars: ReturnType<typeof useCTrader>["getTrendbars"]
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

  const activeChartId = visibleSymbols.length > 0 ? visibleSymbols[0].symbolId : null
  const activeChartSymbol = visibleSymbols.length > 0 ? visibleSymbols[0] : null
  const activeChartDetails = activeChartId ? symbolDetails.get(activeChartId) : null

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      {symbolSearch !== "" || symbols.length > 30 ? (
        <div className="px-3 py-2 shrink-0">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--muted-foreground)]" />
            <input
              placeholder="Search symbols..."
              value={symbolSearch}
              onChange={(e) => setSymbolSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-white text-sm placeholder:text-[var(--muted-foreground)] outline-none focus:border-[var(--primary-accent)]"
            />
          </div>
        </div>
      ) : null}

      {/* Category tabs */}
      <div className="flex gap-0 border-b border-[var(--border)] shrink-0 overflow-x-auto hide-scrollbar">
        {categories.map((cat) => (
          <TabButton key={cat} label={cat} active={activeCategory === cat} onClick={() => setActiveCategory(cat)} />
        ))}
      </div>

      {/* Symbol list */}
      <div className="flex-1 overflow-y-auto min-h-0 thin-scrollbar">
        {visibleSymbols.length === 0 && activeCategory === "Favorites" && (
          <p className="text-center text-[var(--muted-foreground)] text-xs py-10 px-8 leading-relaxed">
            You still don&apos;t have any symbols in your &quot;favorites&quot; list.
            Tap a star icon on any symbol to add it to &quot;favorites&quot;.
          </p>
        )}

        {visibleSymbols.map((symbol) => {
          const quote = quotes.get(symbol.symbolId)
          const details = symbolDetails.get(symbol.symbolId)
          const symbolPositions = positions.filter((p) => p.tradeData.symbolId === symbol.symbolId)
          const bid = quote?.bid ? quote.bid / 100000 : undefined
          const ask = quote?.ask ? quote.ask / 100000 : undefined
          const fav = favorites.has(symbol.symbolId)
          const seed = symbol.symbolId
          const pctChange = ((seed * 9301 + 49297) % 2333) / 100 - 11
          const pctColor = pctChange >= 0 ? "var(--color-buy)" : "var(--color-sell)"

          return (
            <div key={symbol.symbolId} className="border-b border-[var(--border)]">
              <div className="px-3 py-2.5">
                <div className="flex items-center gap-2 mb-2">
                  <PairBadge name={symbol.symbolName} size={22} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-[15px] font-semibold truncate">{symbol.symbolName}</span>
                      <span className="text-xs font-semibold" style={{ color: pctColor }}>
                        {pctChange >= 0 ? "+" : ""}{pctChange.toFixed(2)}%
                      </span>
                    </div>
                    <p className="text-[var(--muted-foreground)] text-[11px]">{symbol.description || classifySymbol(symbol.symbolName)}</p>
                  </div>
                  <span className="text-[var(--muted-foreground)] text-xs tabular-nums" style={{ color: pctColor }}>
                    {bid ? bid.toFixed(details?.digits ?? 5) : "—"}
                  </span>
                  <button onClick={() => toggleFav(symbol.symbolId)} className="p-0.5">
                    <StarIcon className={`size-4 ${fav ? "fill-[#FFC107] text-[#FFC107]" : "text-[var(--muted-foreground)]"}`} />
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => onOpenDeal(symbol)}
                    className="flex-1 py-2 rounded border text-center transition-colors"
                    style={{ background: "var(--color-sell-soft)", borderColor: "rgba(239,97,97,0.4)" }}
                  >
                    <span className="text-white text-[10px] font-semibold uppercase tracking-wider block">Sell</span>
                    <span className="text-white text-[13px] font-mono font-semibold tabular-nums">{formatPrice(quote?.bid, symbol.symbolId)}</span>
                  </button>
                  <button
                    onClick={() => onOpenDeal(symbol)}
                    className="flex-1 py-2 rounded border text-center transition-colors"
                    style={{ background: "var(--color-buy-soft)", borderColor: "rgba(4,159,48,0.4)" }}
                  >
                    <span className="text-white text-[10px] font-semibold uppercase tracking-wider block">Buy</span>
                    <span className="text-white text-[13px] font-mono font-semibold tabular-nums">{formatPrice(quote?.ask, symbol.symbolId)}</span>
                  </button>
                  <button className="w-8 flex items-center justify-center text-[var(--muted-foreground)]">
                    <InfoIcon className="size-4" />
                  </button>
                </div>

                {symbolPositions.map((pos) => {
                  const isBuy = pos.tradeData.tradeSide === TRADE_SIDE.BUY
                  const currentPrice = isBuy ? quote?.bid : quote?.ask
                  const scale = Math.pow(10, details?.digits ?? 5)
                  const rawPrice = (pos as unknown as { price?: number; executionPrice?: number; openPrice?: number }).price
                    ?? (pos as unknown as { executionPrice?: number }).executionPrice
                    ?? (pos as unknown as { openPrice?: number }).openPrice
                  const entry = rawPrice == null ? null
                    : rawPrice > 100 ? rawPrice / scale : rawPrice
                  const current = currentPrice ? currentPrice / scale : null
                  const units = pos.tradeData.volume / 100
                  // Only compute PnL when we have a valid entry (>0.001) AND current price
                  const pnlMoney =
                    entry !== null && entry > 0.001 && current !== null
                      ? (isBuy ? current - entry : entry - current) * units
                      : null
                  return (
                    <div key={pos.positionId} className="flex items-center gap-2 mt-2 pt-1.5 border-t border-[var(--border)]">
                      <span
                        className="px-1.5 py-px rounded text-[10px] font-bold text-white uppercase tracking-wider"
                        style={{ background: isBuy ? "var(--color-buy)" : "var(--color-sell)" }}
                      >
                        {isBuy ? "Buy" : "Sell"}
                      </span>
                      <span className="text-white text-xs tabular-nums">
                        {units.toLocaleString()}
                      </span>
                      {pnlMoney !== null && (
                        <span
                          className="ml-auto font-mono text-xs font-semibold tabular-nums"
                          style={{ color: pnlMoney >= 0 ? "var(--color-buy)" : "var(--color-sell)" }}
                        >
                          {pnlMoney >= 0 ? "+" : ""}{pnlMoney.toFixed(2)} $
                        </span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); onOpenDeal(symbol) }}
                        className="p-1 text-[var(--muted-foreground)]"
                      >
                        <PencilIcon className="size-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onClosePosition(pos.positionId, pos.tradeData.volume) }}
                        className="p-1 text-[var(--muted-foreground)]"
                      >
                        <XIcon className="size-3" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
        {visibleSymbols.length === 0 && activeCategory !== "Favorites" && (
          <p className="text-center text-[var(--muted-foreground)] text-sm py-12">
            {symbols.length === 0 ? "Loading symbols..." : "No symbols in this category"}
          </p>
        )}
      </div>

      {/* Chart - sticky */}
      {activeChartSymbol && activeChartId && (
        <TradingChart
          symbolId={activeChartId}
          symbolName={activeChartSymbol.symbolName}
          digits={activeChartDetails?.digits ?? 5}
          getTrendbars={getTrendbars}
          height={180}
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
  const [popup, setPopup] = useState<{ type: "success" | "error" | "confirm"; title: string; message: string; details?: Record<string, string> } | null>(null)
  const [slEnabled, setSlEnabled] = useState(false)
  const [tpEnabled, setTpEnabled] = useState(false)
  const [trailingEnabled, setTrailingEnabled] = useState(false)
  const [pendingEnabled, setPendingEnabled] = useState(false)
  const [slRate, setSlRate] = useState("")
  const [tpRate, setTpRate] = useState("")

  const quote = ct.quotes.get(symbol.symbolId)
  const details = ct.symbolDetails.get(symbol.symbolId)
  const digits = details?.digits ?? 5

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

  const bidPrice = formatPrice(quote?.bid, symbol.symbolId)
  const askPrice = formatPrice(quote?.ask, symbol.symbolId)
  const bid = quote?.bid ? quote.bid / 100000 : 0
  const ask = quote?.ask ? quote.ask / 100000 : 0
  const expectedMargin = volume * 0.01 // placeholder until ExpectedMarginReq wired

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
            Price: side === "BUY" ? askPrice : bidPrice,
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

  return (
    <div className="flex flex-col h-full bg-[var(--background)]">
      <div className="h-11 flex items-center px-4 border-b border-[var(--border)] shrink-0">
        <button onClick={onBack} className="flex items-center gap-1 text-white -ml-1 p-1">
          <ChevronLeftIcon className="size-5" />
          <span className="text-sm">Back</span>
        </button>
        <span className="flex-1 text-center font-semibold text-[15px] text-white">
          {side === "BUY" ? "Buy" : "Sell"} {symbol.symbolName}
        </span>
        <div className="w-12" />
      </div>

      <div className="flex-1 overflow-y-auto thin-scrollbar">
        {/* Symbol row */}
        <div className="px-4 py-3 flex items-center gap-3 border-b border-[var(--border)]">
          <PairBadge name={symbol.symbolName} size={28} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold">{symbol.symbolName}</span>
            </div>
            <p className="text-[var(--muted-foreground)] text-[11px]">{symbol.description || "Forex"}</p>
          </div>
          <div className="text-right">
            <span className="text-[var(--color-buy)] text-xs font-semibold">+11.23%</span>
            <p className="text-[var(--muted-foreground)] text-[11px] tabular-nums">{bid.toFixed(digits)}</p>
          </div>
          <StarIcon className="size-4 text-[var(--muted-foreground)]" />
        </div>

        {/* Sell / Buy toggle */}
        <div className="px-4 pt-4 flex gap-2">
          <button
            className={`flex-1 py-2.5 rounded border text-center transition-colors ${
              side === "SELL" ? "text-white" : "text-white"
            }`}
            style={{
              background: side === "SELL" ? "var(--primary)" : "var(--color-sell-soft)",
              borderColor: side === "SELL" ? "var(--primary)" : "rgba(239,97,97,0.4)",
            }}
            onClick={() => setSide("SELL")}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider block">Sell</span>
            <span className="text-sm font-mono font-semibold tabular-nums">{bidPrice}</span>
          </button>
          <button
            className={`flex-1 py-2.5 rounded border text-center transition-colors ${
              side === "BUY" ? "text-white" : "text-white"
            }`}
            style={{
              background: side === "BUY" ? "var(--primary)" : "var(--color-buy-soft)",
              borderColor: side === "BUY" ? "var(--primary)" : "rgba(4,159,48,0.4)",
            }}
            onClick={() => setSide("BUY")}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider block">Buy</span>
            <span className="text-sm font-mono font-semibold tabular-nums">{askPrice}</span>
          </button>
          <button className="w-8 flex items-center justify-center text-[var(--muted-foreground)]">
            <InfoIcon className="size-4" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-3">
          {/* Volume */}
          <div className="text-center">
            <p className="text-[var(--muted-foreground)] text-xs mb-1">Barrels</p>
            <div className="flex gap-2">
              <button
                className="w-11 h-11 rounded-md bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-white"
                onClick={() => setVolume((v) => Math.max(minVol, Math.round((v - stepVol) / stepVol) * stepVol))}
              >
                <MinusIcon className="size-4" />
              </button>
              <input
                type="number"
                value={volume}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (!v || v < minVol) { setVolume(minVol); return }
                  if (v > maxVol) { setVolume(maxVol); return }
                  setVolume(Math.round(v / stepVol) * stepVol)
                }}
                className="flex-1 h-11 text-center rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--primary-accent)] font-mono text-base font-semibold outline-none"
              />
              <button
                className="w-11 h-11 rounded-md bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-white"
                onClick={() => setVolume((v) => Math.min(maxVol, Math.round((v + stepVol) / stepVol) * stepVol))}
              >
                <PlusIcon className="size-4" />
              </button>
            </div>
            <p className="text-[var(--muted-foreground)] text-[11px] mt-2">
              Expected margin {expectedMargin.toFixed(2)}$
            </p>
          </div>

          <div className="border-t border-[var(--border)]" />

          {/* Pending rate */}
          <ToggleRow label={`${side === "BUY" ? "Buy" : "Sell"} when rate is`} enabled={pendingEnabled} onToggle={() => setPendingEnabled(!pendingEnabled)} />

          <div className="border-t border-[var(--border)]" />

          {/* Take Profit */}
          <ToggleRow label="Take profit" enabled={tpEnabled} onToggle={() => setTpEnabled(!tpEnabled)} />
          {tpEnabled && (
            <div className="flex gap-2 items-center">
              <button className="w-11 h-11 rounded-md bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-white">
                <MinusIcon className="size-4" />
              </button>
              <input
                value={tpRate}
                onChange={(e) => setTpRate(e.target.value)}
                placeholder={(ask * 1.002).toFixed(digits)}
                className="flex-1 h-11 text-center rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--primary-accent)] font-mono text-base font-semibold outline-none"
              />
              <button className="w-11 h-11 rounded-md bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-white">
                <PlusIcon className="size-4" />
              </button>
            </div>
          )}

          <div className="border-t border-[var(--border)]" />

          {/* Stop Loss */}
          <ToggleRow label="Stop loss" enabled={slEnabled} onToggle={() => setSlEnabled(!slEnabled)} />
          {slEnabled && (
            <>
              <div className="flex gap-2 items-center">
                <button className="w-11 h-11 rounded-md bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-white">
                  <MinusIcon className="size-4" />
                </button>
                <input
                  value={slRate}
                  onChange={(e) => setSlRate(e.target.value)}
                  placeholder={(bid * 0.998).toFixed(digits)}
                  className="flex-1 h-11 text-center rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--primary-accent)] font-mono text-base font-semibold outline-none"
                />
                <button className="w-11 h-11 rounded-md bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-white">
                  <PlusIcon className="size-4" />
                </button>
              </div>
              <p className="text-[var(--muted-foreground)] text-[11px] text-center">Expected loss -34.56$</p>
            </>
          )}

          <div className="border-t border-[var(--border)]" />

          {/* Trailing Stop */}
          <ToggleRow label="Trailing stop" enabled={trailingEnabled} onToggle={() => setTrailingEnabled(!trailingEnabled)} />
        </div>
      </div>

      {/* Submit button */}
      <div className="p-4 shrink-0">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3.5 rounded-md bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-semibold text-sm disabled:opacity-50 transition-colors"
        >
          {submitting ? <Spinner className="size-5 mx-auto" /> : side === "BUY" ? "Buy" : "Sell"}
        </button>
      </div>

      <Footer />

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
function ActivityScreen({
  positions, orders, quotes, symbolDetails, getSymbolName,
  formatVolume, onClosePosition, cancelOrder,
  activityTab, setActivityTab, expandedPosition, setExpandedPosition,
}: {
  positions: OAPosition[]
  orders: OAOrder[]
  quotes: Map<number, { bid?: number; ask?: number; timestamp: number }>
  symbolDetails: Map<number, OASymbol>
  getSymbolName: (id: number) => string
  formatVolume: (vol: number) => string
  onClosePosition: (positionId: number, volume: number) => void
  cancelOrder: (orderId: number) => Promise<unknown>
  activityTab: ActivityTab
  setActivityTab: (t: ActivityTab) => void
  expandedPosition: number | null
  setExpandedPosition: (id: number | null) => void
}) {
  return (
    <div className="flex flex-col min-h-full">
      {/* Tabs */}
      <div className="flex border-b border-[var(--border)] shrink-0">
        {(["positions", "orders", "closed"] as const).map((tab) => (
          <button
            key={tab}
            className={`flex-1 py-3 text-[13px] font-semibold transition-colors relative ${
              activityTab === tab ? "text-white" : "text-[var(--muted-foreground)]"
            }`}
            onClick={() => setActivityTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {activityTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[var(--primary-accent)]" />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1">
        {activityTab === "positions" && (
          <div>
            {positions.map((pos) => {
              const isBuy = pos.tradeData.tradeSide === TRADE_SIDE.BUY
              const symName = getSymbolName(pos.tradeData.symbolId)
              const quote = quotes.get(pos.tradeData.symbolId)
              const details = symbolDetails.get(pos.tradeData.symbolId)
              const currentPrice = isBuy ? quote?.bid : quote?.ask
              const digits = details?.digits ?? 5
              const scale = Math.pow(10, digits)
              const rawPrice = (pos as unknown as { price?: number; executionPrice?: number; openPrice?: number }).price
                ?? (pos as unknown as { executionPrice?: number }).executionPrice
                ?? (pos as unknown as { openPrice?: number }).openPrice
              const entry = rawPrice == null ? null
                : rawPrice > 100 ? rawPrice / scale : rawPrice
              const current = currentPrice ? currentPrice / scale : null
              const units = pos.tradeData.volume / 100
              // Only compute PnL when we have valid entry AND current — avoid bogus values
              const pnlMoney =
                entry !== null && entry > 0.001 && current !== null
                  ? (isBuy ? current - entry : entry - current) * units
                  : null
              const expanded = expandedPosition === pos.positionId

              return (
                <div key={pos.positionId} className="border-b border-[var(--border)]">
                  <button
                    className="w-full px-3 py-3 flex items-center gap-2 text-left"
                    onClick={() => setExpandedPosition(expanded ? null : pos.positionId)}
                  >
                    <PairBadge name={symName} size={18} />
                    <span className="text-white text-[13px] font-semibold">{symName}</span>
                    <span
                      className="px-1.5 py-px rounded text-[10px] font-bold uppercase tracking-wider"
                      style={{
                        background: isBuy ? "var(--primary-accent)" : "var(--color-sell-soft)",
                        color: "#fff",
                      }}
                    >
                      {isBuy ? "Buy" : "Sell"}
                    </span>
                    <span className="text-white text-[13px] tabular-nums">
                      {units.toLocaleString()}
                    </span>
                    <span
                      className="ml-auto text-[13px] font-mono font-semibold tabular-nums"
                      style={{ color: pnlMoney !== null && pnlMoney >= 0 ? "var(--color-buy)" : "var(--color-sell)" }}
                    >
                      {pnlMoney !== null ? `${pnlMoney >= 0 ? "+" : ""}${pnlMoney.toFixed(2)} $` : "—"}
                    </span>
                    {expanded ? (
                      <ChevronUpIcon className="size-4 text-[var(--muted-foreground)]" />
                    ) : (
                      <ChevronDownIcon className="size-4 text-[var(--muted-foreground)]" />
                    )}
                  </button>

                  {expanded && (
                    <div className="px-3 pb-3 space-y-1.5">
                      <DetailRow label="Position ID" value={String(pos.positionId)} />
                      <DetailRow label="Amount" value={formatVolume(pos.tradeData.volume)} />
                      <DetailRow label="Open price" value={entry !== null ? entry.toFixed(digits) : "—"} />
                      {current && <DetailRow label="Current rate" value={current.toFixed(digits)} />}
                      {pos.stopLoss && <DetailRow label="Stop Loss" value={(pos.stopLoss / 100000).toFixed(digits)} />}
                      {pos.takeProfit && <DetailRow label="Take Profit" value={(pos.takeProfit / 100000).toFixed(digits)} />}
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => onClosePosition(pos.positionId, pos.tradeData.volume)}
                          className="flex-1 py-2 rounded-md bg-[var(--destructive)] text-white text-sm font-medium"
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
              <p className="text-center text-[var(--muted-foreground)] text-sm py-16 px-6">
                No active positions in this account at this moment
              </p>
            )}
          </div>
        )}

        {activityTab === "orders" && (
          <div>
            {orders.map((ord) => {
              const isBuy = ord.tradeData.tradeSide === TRADE_SIDE.BUY
              const symName = getSymbolName(ord.tradeData.symbolId)
              const details = symbolDetails.get(ord.tradeData.symbolId)
              const digits = details?.digits ?? 5
              const price = ord.limitPrice ?? ord.stopPrice ?? 0

              return (
                <div key={ord.orderId} className="border-b border-[var(--border)] px-3 py-3 flex items-center gap-2">
                  <PairBadge name={symName} size={18} />
                  <span className="text-white text-[13px] font-semibold">{symName}</span>
                  <span
                    className="px-1.5 py-px rounded text-[10px] font-bold uppercase tracking-wider text-white"
                    style={{ background: isBuy ? "var(--primary-accent)" : "var(--color-sell)" }}
                  >
                    {isBuy ? "Buy" : "Sell"}
                  </span>
                  <span className="text-white text-[13px] tabular-nums">
                    {formatVolume(ord.tradeData.volume)}
                  </span>
                  <span className="ml-auto text-[var(--muted-foreground)] text-xs tabular-nums">
                    @ {price > 0 ? (price / 100000).toFixed(digits) : "Market"}
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
              <p className="text-center text-[var(--muted-foreground)] text-sm py-16 px-6">
                No pending orders in this account at this moment
              </p>
            )}
          </div>
        )}

        {activityTab === "closed" && (
          <p className="text-center text-[var(--muted-foreground)] text-sm py-16 px-6">
            No recent trading activity was found. Tap on &quot;Load More&quot; to get trading history for longer period.
          </p>
        )}
      </div>

      {(activityTab === "positions" || activityTab === "orders") && positions.length + orders.length > 0 && (
        <div className="px-4 pb-3">
          <button className="w-full py-2.5 rounded-md bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-sm font-semibold transition-colors">
            Show more
          </button>
        </div>
      )}
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
