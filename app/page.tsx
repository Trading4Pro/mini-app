"use client"

import { useEffect, useState, useMemo } from "react"
import Script from "next/script"
import { useCTrader } from "@/hooks/use-ctrader"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { TRADE_SIDE, ORDER_TYPE } from "@/types/ctrader"
import type { OALightSymbol, OASymbol } from "@/types/ctrader"
import {
  ArrowUpIcon,
  ArrowDownIcon,
  LogOutIcon,
  XIcon,
  SearchIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UserIcon,
  BarChart3Icon,
  ListIcon,
} from "lucide-react"

export default function TradingApp() {
  const {
    status,
    error,
    accessToken,
    accounts,
    selectedAccountId,
    trader,
    depositAssetName,
    symbols,
    symbolDetails,
    quotes,
    positions,
    orders,
    isLive,
    setIsLive,
    login,
    logout,
    connect,
    selectAccount,
    placeOrder,
    closePosition,
    cancelOrder,
    getSymbolName,
  } = useCTrader()

  const [tgUser, setTgUser] = useState<{ first_name?: string; username?: string } | null>(null)
  const [activeScreen, setActiveScreen] = useState<"account" | "market" | "activity">("market")
  const [symbolSearch, setSymbolSearch] = useState("")
  const [orderDialog, setOrderDialog] = useState<{
    symbol: OALightSymbol
    details?: OASymbol
  } | null>(null)
  const [orderSide, setOrderSide] = useState<"BUY" | "SELL">("BUY")
  const [orderVolume, setOrderVolume] = useState("0.01")
  const [orderSubmitting, setOrderSubmitting] = useState(false)
  const [activityTab, setActivityTab] = useState<"positions" | "orders">("positions")

  // Initialize Telegram WebApp
  useEffect(() => {
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp
      tg.ready()
      tg.expand()
      setTgUser(tg.initDataUnsafe?.user || null)
    }
  }, [])

  // Auto-connect when token is available
  useEffect(() => {
    if (accessToken && status === "disconnected") {
      connect(accessToken, isLive).catch(() => {})
    }
  }, [accessToken, status, isLive, connect])

  const filteredSymbols = useMemo(() => {
    if (!symbolSearch) return symbols
    const q = symbolSearch.toLowerCase()
    return symbols.filter((s) => s.symbolName.toLowerCase().includes(q))
  }, [symbols, symbolSearch])

  const formatPrice = (price: number | undefined, symbolId: number) => {
    if (price === undefined) return "—"
    const details = symbolDetails.get(symbolId)
    const digits = details?.digits ?? 5
    return (price / 100000).toFixed(digits)
  }

  const formatMoney = (amount: number, digits = 2) => {
    return (amount / Math.pow(10, digits)).toFixed(2)
  }

  const formatVolume = (volumeInCents: number, symbolId: number) => {
    const details = symbolDetails.get(symbolId)
    const lotSize = details?.lotSize ?? 100000
    return (volumeInCents / 100 / lotSize).toFixed(2)
  }

  const handlePlaceOrder = async () => {
    if (!orderDialog) return
    setOrderSubmitting(true)
    try {
      const details = symbolDetails.get(orderDialog.symbol.symbolId)
      const lotSize = details?.lotSize ?? 100000
      const volumeInCents = Math.round(parseFloat(orderVolume) * lotSize * 100)

      await placeOrder({
        symbolId: orderDialog.symbol.symbolId,
        tradeSide: orderSide === "BUY" ? TRADE_SIDE.BUY : TRADE_SIDE.SELL,
        volume: volumeInCents,
        orderType: ORDER_TYPE.MARKET,
      })
      setOrderDialog(null)
    } catch (err) {
      console.error("Order failed:", err)
    } finally {
      setOrderSubmitting(false)
    }
  }

  // Calculate total P&L
  const totalPnl = useMemo(() => {
    let total = 0
    positions.forEach((pos) => {
      const quote = quotes.get(pos.tradeData.symbolId)
      const isBuy = pos.tradeData.tradeSide === TRADE_SIDE.BUY
      const currentPrice = isBuy ? quote?.bid : quote?.ask
      if (currentPrice) {
        const details = symbolDetails.get(pos.tradeData.symbolId)
        const pipPos = details?.pipPosition ?? 4
        const entry = pos.price / 100000
        const current = currentPrice / 100000
        const pips = isBuy ? (current - entry) * Math.pow(10, pipPos) : (entry - current) * Math.pow(10, pipPos)
        total += pips
      }
    })
    return total
  }, [positions, quotes, symbolDetails])

  // ---- Login Screen ----
  if (!accessToken) {
    return (
      <>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground">
          <div className="text-center space-y-8 max-w-sm w-full">
            {/* Logo area */}
            <div className="space-y-2">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
                <BarChart3Icon className="size-10 text-primary" />
              </div>
              <h1 className="text-2xl font-bold">cTrader</h1>
              <p className="text-muted-foreground text-sm">
                {tgUser ? `Hello, ${tgUser.first_name || tgUser.username}!` : "Sign in to start trading"}
              </p>
            </div>

            {/* Demo / Live toggle */}
            <div className="flex items-center justify-center gap-1 bg-muted rounded-lg p-1">
              <button
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  !isLive ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                }`}
                onClick={() => setIsLive(false)}
              >
                Demo
              </button>
              <button
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  isLive ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                }`}
                onClick={() => setIsLive(true)}
              >
                Live
              </button>
            </div>

            <Button onClick={login} size="lg" className="w-full h-12 text-base">
              Sign In
            </Button>
          </div>
        </main>
      </>
    )
  }

  // ---- Connecting/Auth Screen ----
  if (status === "connecting" || status === "authenticating") {
    return (
      <>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground">
          <Spinner className="h-8 w-8" />
          <p className="text-muted-foreground mt-3">
            {status === "connecting" ? "Connecting..." : "Authenticating..."}
          </p>
        </main>
      </>
    )
  }

  // ---- Error Screen ----
  if (status === "error") {
    return (
      <>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground">
          <div className="text-center space-y-4 max-w-sm">
            <p className="text-destructive font-medium">Connection failed</p>
            <p className="text-muted-foreground text-sm break-words">{error}</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => connect(accessToken!, isLive)}>
                Retry
              </Button>
              <Button variant="ghost" onClick={logout}>
                Logout
              </Button>
            </div>
          </div>
        </main>
      </>
    )
  }

  // ---- Account Selection ----
  if (!selectedAccountId && accounts.length > 0) {
    return (
      <>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <main className="min-h-screen flex flex-col bg-background text-foreground">
          <div className="p-4 border-b">
            <h2 className="text-lg font-bold">Select Account</h2>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-2">
              {accounts.map((acc) => (
                <button
                  key={acc.ctidTraderAccountId}
                  className="w-full p-4 rounded-xl border hover:border-primary/50 transition-colors text-left bg-card"
                  onClick={() => selectAccount(acc.ctidTraderAccountId)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">Account {acc.traderLogin}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        ID: {acc.ctidTraderAccountId}
                      </p>
                    </div>
                    <Badge
                      variant={acc.isLive ? "default" : "secondary"}
                      className={acc.isLive ? "bg-green-600" : ""}
                    >
                      {acc.isLive ? "Live" : "Demo"}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
          <div className="p-3 border-t">
            <Button variant="ghost" size="sm" className="w-full" onClick={logout}>
              <LogOutIcon className="size-4" />
              Disconnect
            </Button>
          </div>
        </main>
      </>
    )
  }

  // ---- Main Trading Interface (3-screen layout) ----
  const moneyDigits = trader?.moneyDigits ?? 2

  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <main className="min-h-screen flex flex-col bg-background text-foreground">
        {/* Error banner */}
        {error && (
          <div className="px-3 py-2 bg-destructive/10 text-destructive text-xs">
            {error}
          </div>
        )}

        {/* Screen content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* ===== ACCOUNT SCREEN ===== */}
          {activeScreen === "account" && (
            <div className="flex-1 flex flex-col">
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="text-lg font-bold">Account</h2>
                <Button variant="ghost" size="icon-sm" onClick={logout}>
                  <LogOutIcon className="size-4" />
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  {/* Account badge */}
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <UserIcon className="size-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Account {trader?.ctidTraderAccountId}</p>
                      <Badge variant={isLive ? "default" : "secondary"} className={`text-xs ${isLive ? "bg-green-600" : ""}`}>
                        {isLive ? "Live" : "Demo"}
                      </Badge>
                    </div>
                  </div>

                  <Separator />

                  {/* Account metrics */}
                  {trader && (
                    <div className="space-y-3">
                      <AccountRow label="Balance" value={`${formatMoney(trader.balance, moneyDigits)} ${depositAssetName}`} />
                      <AccountRow label="Leverage" value={`1:${trader.leverageInCents / 100}`} />
                      <AccountRow label="Bonus" value={formatMoney(trader.managerBonus + trader.ibBonus, moneyDigits)} />
                      <Separator />
                      <AccountRow
                        label="Unrealized P&L"
                        value={`${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(1)} pips`}
                        valueColor={totalPnl >= 0 ? "text-green-500" : "text-red-500"}
                      />
                      <AccountRow label="Open Positions" value={String(positions.length)} />
                      <AccountRow label="Pending Orders" value={String(orders.length)} />
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* ===== MARKET SCREEN ===== */}
          {activeScreen === "market" && (
            <div className="flex-1 flex flex-col">
              {/* Search */}
              <div className="p-3 border-b">
                <div className="relative">
                  <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search symbols..."
                    value={symbolSearch}
                    onChange={(e) => setSymbolSearch(e.target.value)}
                    className="pl-8 h-9 text-sm"
                  />
                </div>
              </div>

              {/* Floating P&L overlay */}
              {positions.length > 0 && (
                <div className="px-3 py-1.5 border-b bg-muted/50 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {positions.length} position{positions.length !== 1 ? "s" : ""}
                  </span>
                  <span className={`text-xs font-semibold font-mono ${totalPnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(1)} pips
                  </span>
                </div>
              )}

              {/* Symbol list */}
              <ScrollArea className="flex-1">
                <div className="divide-y">
                  {filteredSymbols.map((symbol) => {
                    const quote = quotes.get(symbol.symbolId)
                    const hasPosition = positions.some((p) => p.tradeData.symbolId === symbol.symbolId)
                    return (
                      <button
                        key={symbol.symbolId}
                        className="w-full px-3 py-3 flex items-center justify-between hover:bg-accent/50 transition-colors text-left"
                        onClick={() =>
                          setOrderDialog({
                            symbol,
                            details: symbolDetails.get(symbol.symbolId),
                          })
                        }
                      >
                        <div className="flex items-center gap-2">
                          {hasPosition && (
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          )}
                          <div>
                            <p className="text-sm font-medium">{symbol.symbolName}</p>
                            {symbol.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[140px]">
                                {symbol.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Bid</p>
                            <p className="text-sm font-mono tabular-nums text-blue-500">
                              {formatPrice(quote?.bid, symbol.symbolId)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Ask</p>
                            <p className="text-sm font-mono tabular-nums text-red-500">
                              {formatPrice(quote?.ask, symbol.symbolId)}
                            </p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                  {filteredSymbols.length === 0 && (
                    <p className="text-center text-muted-foreground text-sm py-8">
                      {symbols.length === 0 ? "Loading symbols..." : "No symbols found"}
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* ===== ACTIVITY SCREEN ===== */}
          {activeScreen === "activity" && (
            <div className="flex-1 flex flex-col">
              {/* Tabs */}
              <div className="flex border-b">
                <button
                  className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activityTab === "positions"
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground"
                  }`}
                  onClick={() => setActivityTab("positions")}
                >
                  Positions ({positions.length})
                </button>
                <button
                  className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activityTab === "orders"
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground"
                  }`}
                  onClick={() => setActivityTab("orders")}
                >
                  Orders ({orders.length})
                </button>
              </div>

              <ScrollArea className="flex-1">
                {activityTab === "positions" && (
                  <div className="divide-y">
                    {positions.map((pos) => {
                      const quote = quotes.get(pos.tradeData.symbolId)
                      const isBuy = pos.tradeData.tradeSide === TRADE_SIDE.BUY
                      const currentPrice = isBuy ? quote?.bid : quote?.ask
                      const details = symbolDetails.get(pos.tradeData.symbolId)
                      const digits = details?.digits ?? 5
                      const pipPos = details?.pipPosition ?? 4
                      const entryPrice = pos.price / 100000
                      const current = currentPrice ? currentPrice / 100000 : null
                      const pnlPips = current
                        ? isBuy
                          ? (current - entryPrice) * Math.pow(10, pipPos)
                          : (entryPrice - current) * Math.pow(10, pipPos)
                        : null

                      return (
                        <div key={pos.positionId} className="px-3 py-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <Badge
                                className={`text-xs px-1.5 py-0.5 ${
                                  isBuy
                                    ? "bg-green-600 text-white border-green-600"
                                    : "bg-red-600 text-white border-red-600"
                                }`}
                              >
                                {isBuy ? "BUY" : "SELL"}
                              </Badge>
                              <div>
                                <p className="text-sm font-medium">
                                  {getSymbolName(pos.tradeData.symbolId)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatVolume(pos.tradeData.volume, pos.tradeData.symbolId)} lots @ {entryPrice.toFixed(digits)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {pnlPips !== null && (
                                <span
                                  className={`text-sm font-mono font-semibold tabular-nums ${
                                    pnlPips >= 0 ? "text-green-500" : "text-red-500"
                                  }`}
                                >
                                  {pnlPips >= 0 ? "+" : ""}{pnlPips.toFixed(1)}
                                </span>
                              )}
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() => closePosition(pos.positionId, pos.tradeData.volume)}
                              >
                                <XIcon className="size-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {positions.length === 0 && (
                      <p className="text-center text-muted-foreground text-sm py-12">
                        No open positions
                      </p>
                    )}
                  </div>
                )}

                {activityTab === "orders" && (
                  <div className="divide-y">
                    {orders.map((ord) => {
                      const isBuy = ord.tradeData.tradeSide === TRADE_SIDE.BUY
                      const details = symbolDetails.get(ord.tradeData.symbolId)
                      const digits = details?.digits ?? 5
                      const price = ord.limitPrice ?? ord.stopPrice ?? 0
                      const typeLabel = ord.orderType === 2 ? "Limit" : ord.orderType === 3 ? "Stop" : "Market"

                      return (
                        <div key={ord.orderId} className="px-3 py-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <Badge
                                className={`text-xs px-1.5 py-0.5 ${
                                  isBuy
                                    ? "bg-green-600 text-white border-green-600"
                                    : "bg-red-600 text-white border-red-600"
                                }`}
                              >
                                {isBuy ? "BUY" : "SELL"}
                              </Badge>
                              <div>
                                <p className="text-sm font-medium">
                                  {getSymbolName(ord.tradeData.symbolId)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {typeLabel} {formatVolume(ord.tradeData.volume, ord.tradeData.symbolId)} lots
                                  {price > 0 && ` @ ${(price / 100000).toFixed(digits)}`}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => cancelOrder(ord.orderId)}
                            >
                              <XIcon className="size-4" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                    {orders.length === 0 && (
                      <p className="text-center text-muted-foreground text-sm py-12">
                        No pending orders
                      </p>
                    )}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </div>

        {/* Bottom Navigation Bar */}
        <div className="border-t bg-card">
          <div className="flex">
            <NavButton
              icon={<UserIcon className="size-5" />}
              label="Account"
              active={activeScreen === "account"}
              onClick={() => setActiveScreen("account")}
            />
            <NavButton
              icon={<BarChart3Icon className="size-5" />}
              label="Market"
              active={activeScreen === "market"}
              onClick={() => setActiveScreen("market")}
            />
            <NavButton
              icon={<ListIcon className="size-5" />}
              label="Activity"
              active={activeScreen === "activity"}
              onClick={() => setActiveScreen("activity")}
              badge={positions.length > 0 ? positions.length : undefined}
            />
          </div>
        </div>

        {/* Order Dialog */}
        <Dialog open={!!orderDialog} onOpenChange={(open) => !open && setOrderDialog(null)}>
          <DialogContent className="max-w-[calc(100%-2rem)]">
            <DialogHeader>
              <DialogTitle className="text-center">{orderDialog?.symbol.symbolName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Bid/Ask display */}
              {orderDialog && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-lg bg-muted text-center">
                    <p className="text-xs text-muted-foreground mb-1">Bid</p>
                    <p className="text-xl font-mono tabular-nums font-bold text-blue-500">
                      {formatPrice(
                        quotes.get(orderDialog.symbol.symbolId)?.bid,
                        orderDialog.symbol.symbolId
                      )}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted text-center">
                    <p className="text-xs text-muted-foreground mb-1">Ask</p>
                    <p className="text-xl font-mono tabular-nums font-bold text-red-500">
                      {formatPrice(
                        quotes.get(orderDialog.symbol.symbolId)?.ask,
                        orderDialog.symbol.symbolId
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Buy / Sell toggle */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  className={`py-3 rounded-lg text-sm font-bold transition-colors ${
                    orderSide === "BUY"
                      ? "bg-green-600 text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                  onClick={() => setOrderSide("BUY")}
                >
                  BUY
                </button>
                <button
                  className={`py-3 rounded-lg text-sm font-bold transition-colors ${
                    orderSide === "SELL"
                      ? "bg-red-600 text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                  onClick={() => setOrderSide("SELL")}
                >
                  SELL
                </button>
              </div>

              {/* Volume */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">
                  Trading Amount (lots)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-lg font-bold hover:bg-accent transition-colors"
                    onClick={() =>
                      setOrderVolume((v) => Math.max(0.01, parseFloat(v) - 0.01).toFixed(2))
                    }
                  >
                    −
                  </button>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={orderVolume}
                    onChange={(e) => setOrderVolume(e.target.value)}
                    className="text-center text-lg font-mono font-bold h-10"
                  />
                  <button
                    className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-lg font-bold hover:bg-accent transition-colors"
                    onClick={() =>
                      setOrderVolume((v) => (parseFloat(v) + 0.01).toFixed(2))
                    }
                  >
                    +
                  </button>
                </div>
                <div className="flex gap-1 mt-2">
                  {["0.01", "0.05", "0.10", "0.50", "1.00"].map((v) => (
                    <button
                      key={v}
                      className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        orderVolume === v
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-accent"
                      }`}
                      onClick={() => setOrderVolume(v)}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="mt-2">
              <button
                className={`w-full py-3 rounded-lg font-bold text-white text-sm transition-colors disabled:opacity-50 ${
                  orderSide === "BUY"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
                onClick={handlePlaceOrder}
                disabled={orderSubmitting}
              >
                {orderSubmitting ? (
                  <Spinner className="size-5 mx-auto" />
                ) : (
                  `${orderSide} ${orderVolume} lots`
                )}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </>
  )
}

// ---- Helper Components ----

function AccountRow({
  label,
  value,
  valueColor,
}: {
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium font-mono ${valueColor || ""}`}>{value}</span>
    </div>
  )
}

function NavButton({
  icon,
  label,
  active,
  onClick,
  badge,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
  badge?: number
}) {
  return (
    <button
      className={`flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors relative ${
        active ? "text-primary" : "text-muted-foreground"
      }`}
      onClick={onClick}
    >
      <div className="relative">
        {icon}
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
            {badge}
          </span>
        )}
      </div>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  )
}
