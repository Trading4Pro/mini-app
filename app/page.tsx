"use client"

import { useEffect, useState, useMemo } from "react"
import Script from "next/script"
import { useCTrader } from "@/hooks/use-ctrader"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TRADE_SIDE, ORDER_TYPE } from "@/types/ctrader"
import type { OALightSymbol, OASymbol } from "@/types/ctrader"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  LogOutIcon,
  XIcon,
  SearchIcon,
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
  const [isLive, setIsLive] = useState(false)
  const [symbolSearch, setSymbolSearch] = useState("")
  const [orderDialog, setOrderDialog] = useState<{
    symbol: OALightSymbol
    details?: OASymbol
  } | null>(null)
  const [orderSide, setOrderSide] = useState<"BUY" | "SELL">("BUY")
  const [orderVolume, setOrderVolume] = useState("0.01")
  const [orderSubmitting, setOrderSubmitting] = useState(false)

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

  // ---- Login Screen ----
  if (!accessToken) {
    return (
      <>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground">
          <div className="text-center space-y-6 max-w-sm">
            <h1 className="text-2xl font-bold">cTrader Mini App</h1>
            {tgUser && (
              <p className="text-muted-foreground">
                Hello, {tgUser.first_name || tgUser.username}!
              </p>
            )}
            <p className="text-muted-foreground text-sm">
              Connect your cTrader account to start trading.
            </p>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant={isLive ? "outline" : "default"}
                  size="sm"
                  onClick={() => setIsLive(false)}
                >
                  Demo
                </Button>
                <Button
                  variant={isLive ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsLive(true)}
                >
                  Live
                </Button>
              </div>
              <Button onClick={login} size="lg" className="w-full">
                Connect cTrader Account
              </Button>
            </div>
          </div>
        </main>
      </>
    )
  }

  // ---- Connecting Screen ----
  if (status === "connecting" || status === "authenticating") {
    return (
      <>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground">
          <div className="flex flex-col items-center gap-3">
            <Spinner className="h-8 w-8" />
            <p className="text-muted-foreground">
              {status === "connecting" ? "Connecting to cTrader..." : "Authenticating..."}
            </p>
          </div>
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
          <div className="text-center space-y-4">
            <p className="text-destructive font-medium">Connection failed</p>
            <p className="text-muted-foreground text-sm">{error}</p>
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
        <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground">
          <div className="w-full max-w-sm space-y-4">
            <h2 className="text-xl font-bold text-center">Select Account</h2>
            <div className="space-y-2">
              {accounts.map((acc) => (
                <Card
                  key={acc.ctidTraderAccountId}
                  className="cursor-pointer hover:border-primary/50 transition-colors py-3"
                  onClick={() => selectAccount(acc.ctidTraderAccountId)}
                >
                  <CardContent className="py-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">
                          {acc.traderLogin}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ID: {acc.ctidTraderAccountId}
                        </p>
                      </div>
                      <Badge variant={acc.isLive ? "default" : "secondary"}>
                        {acc.isLive ? "Live" : "Demo"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="w-full" onClick={logout}>
              <LogOutIcon className="size-4" />
              Disconnect
            </Button>
          </div>
        </main>
      </>
    )
  }

  // ---- Main Trading Interface ----
  const moneyDigits = trader?.moneyDigits ?? 2

  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <main className="min-h-screen flex flex-col bg-background text-foreground">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold">cTrader</h1>
            <Badge variant="outline" className="text-xs">
              {isLive ? "Live" : "Demo"}
            </Badge>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={logout}>
            <LogOutIcon className="size-4" />
          </Button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="px-3 py-2 bg-destructive/10 text-destructive text-xs flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => {}} className="ml-2">
              <XIcon className="size-3" />
            </button>
          </div>
        )}

        {/* Account Info */}
        {trader && (
          <div className="grid grid-cols-3 gap-2 p-3">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Balance</p>
              <p className="text-sm font-semibold">
                {formatMoney(trader.balance, moneyDigits)} {depositAssetName}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Leverage</p>
              <p className="text-sm font-semibold">
                1:{trader.leverageInCents / 100}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Positions</p>
              <p className="text-sm font-semibold">{positions.length}</p>
            </div>
          </div>
        )}

        <Separator />

        {/* Main Content Tabs */}
        <Tabs defaultValue="symbols" className="flex-1 flex flex-col">
          <TabsList className="w-full rounded-none h-10">
            <TabsTrigger value="symbols" className="flex-1">Symbols</TabsTrigger>
            <TabsTrigger value="positions" className="flex-1">
              Positions {positions.length > 0 && `(${positions.length})`}
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex-1">
              Orders {orders.length > 0 && `(${orders.length})`}
            </TabsTrigger>
          </TabsList>

          {/* Symbols Tab */}
          <TabsContent value="symbols" className="flex-1 flex flex-col m-0">
            <div className="p-2">
              <div className="relative">
                <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search symbols..."
                  value={symbolSearch}
                  onChange={(e) => setSymbolSearch(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="divide-y">
                {filteredSymbols.map((symbol) => {
                  const quote = quotes.get(symbol.symbolId)
                  return (
                    <button
                      key={symbol.symbolId}
                      className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-accent/50 transition-colors text-left"
                      onClick={() =>
                        setOrderDialog({
                          symbol,
                          details: symbolDetails.get(symbol.symbolId),
                        })
                      }
                    >
                      <div>
                        <p className="text-sm font-medium">{symbol.symbolName}</p>
                        {symbol.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-[160px]">
                            {symbol.description}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono tabular-nums text-blue-500">
                          {formatPrice(quote?.bid, symbol.symbolId)}
                        </p>
                        <p className="text-sm font-mono tabular-nums text-red-500">
                          {formatPrice(quote?.ask, symbol.symbolId)}
                        </p>
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
          </TabsContent>

          {/* Positions Tab */}
          <TabsContent value="positions" className="flex-1 m-0">
            <ScrollArea className="h-full">
              <div className="divide-y">
                {positions.map((pos) => {
                  const quote = quotes.get(pos.tradeData.symbolId)
                  const isBuy = pos.tradeData.tradeSide === TRADE_SIDE.BUY
                  const currentPrice = isBuy ? quote?.bid : quote?.ask
                  const details = symbolDetails.get(pos.tradeData.symbolId)
                  const digits = details?.digits ?? 5
                  const priceDivisor = 100000
                  const entryPrice = pos.price / priceDivisor
                  const current = currentPrice ? currentPrice / priceDivisor : null
                  const pnlPips = current
                    ? isBuy
                      ? (current - entryPrice) * Math.pow(10, details?.pipPosition ?? 4)
                      : (entryPrice - current) * Math.pow(10, details?.pipPosition ?? 4)
                    : null

                  return (
                    <div key={pos.positionId} className="px-3 py-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isBuy ? (
                            <ArrowUpIcon className="size-4 text-green-500" />
                          ) : (
                            <ArrowDownIcon className="size-4 text-red-500" />
                          )}
                          <div>
                            <p className="text-sm font-medium">
                              {getSymbolName(pos.tradeData.symbolId)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {isBuy ? "Buy" : "Sell"}{" "}
                              {formatVolume(pos.tradeData.volume, pos.tradeData.symbolId)} lots @ {entryPrice.toFixed(digits)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {pnlPips !== null && (
                            <span
                              className={`text-sm font-mono tabular-nums ${
                                pnlPips >= 0 ? "text-green-500" : "text-red-500"
                              }`}
                            >
                              {pnlPips >= 0 ? "+" : ""}
                              {pnlPips.toFixed(1)} pips
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="icon-sm"
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
                  <p className="text-center text-muted-foreground text-sm py-8">
                    No open positions
                  </p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="flex-1 m-0">
            <ScrollArea className="h-full">
              <div className="divide-y">
                {orders.map((ord) => {
                  const isBuy = ord.tradeData.tradeSide === TRADE_SIDE.BUY
                  const details = symbolDetails.get(ord.tradeData.symbolId)
                  const digits = details?.digits ?? 5
                  const price = ord.limitPrice ?? ord.stopPrice ?? 0

                  return (
                    <div key={ord.orderId} className="px-3 py-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isBuy ? (
                            <ArrowUpIcon className="size-4 text-green-500" />
                          ) : (
                            <ArrowDownIcon className="size-4 text-red-500" />
                          )}
                          <div>
                            <p className="text-sm font-medium">
                              {getSymbolName(ord.tradeData.symbolId)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {isBuy ? "Buy" : "Sell"}{" "}
                              {formatVolume(ord.tradeData.volume, ord.tradeData.symbolId)} lots
                              {price > 0 && ` @ ${(price / 100000).toFixed(digits)}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {ord.orderType === 2 ? "Limit" : ord.orderType === 3 ? "Stop" : "Market"}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => cancelOrder(ord.orderId)}
                          >
                            <XIcon className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {orders.length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-8">
                    No pending orders
                  </p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Order Dialog */}
        <Dialog open={!!orderDialog} onOpenChange={(open) => !open && setOrderDialog(null)}>
          <DialogContent className="max-w-[calc(100%-2rem)]">
            <DialogHeader>
              <DialogTitle>{orderDialog?.symbol.symbolName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Bid/Ask display */}
              {orderDialog && (
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-2 rounded-md bg-muted">
                    <p className="text-xs text-muted-foreground">Bid</p>
                    <p className="text-lg font-mono tabular-nums text-blue-500">
                      {formatPrice(
                        quotes.get(orderDialog.symbol.symbolId)?.bid,
                        orderDialog.symbol.symbolId
                      )}
                    </p>
                  </div>
                  <div className="p-2 rounded-md bg-muted">
                    <p className="text-xs text-muted-foreground">Ask</p>
                    <p className="text-lg font-mono tabular-nums text-red-500">
                      {formatPrice(
                        quotes.get(orderDialog.symbol.symbolId)?.ask,
                        orderDialog.symbol.symbolId
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Side selector */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={orderSide === "BUY" ? "default" : "outline"}
                  className={orderSide === "BUY" ? "bg-green-600 hover:bg-green-700" : ""}
                  onClick={() => setOrderSide("BUY")}
                >
                  Buy
                </Button>
                <Button
                  variant={orderSide === "SELL" ? "default" : "outline"}
                  className={orderSide === "SELL" ? "bg-red-600 hover:bg-red-700" : ""}
                  onClick={() => setOrderSide("SELL")}
                >
                  Sell
                </Button>
              </div>

              {/* Volume */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Volume (lots)
                </label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setOrderVolume((v) => Math.max(0.01, parseFloat(v) - 0.01).toFixed(2))
                    }
                  >
                    -
                  </Button>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={orderVolume}
                    onChange={(e) => setOrderVolume(e.target.value)}
                    className="text-center font-mono"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setOrderVolume((v) => (parseFloat(v) + 0.01).toFixed(2))
                    }
                  >
                    +
                  </Button>
                </div>
                {/* Quick volume buttons */}
                <div className="flex gap-1 mt-2">
                  {["0.01", "0.05", "0.10", "0.50", "1.00"].map((v) => (
                    <Button
                      key={v}
                      variant="ghost"
                      size="sm"
                      className="flex-1 text-xs h-7"
                      onClick={() => setOrderVolume(v)}
                    >
                      {v}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                className={`w-full ${
                  orderSide === "BUY"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
                onClick={handlePlaceOrder}
                disabled={orderSubmitting}
              >
                {orderSubmitting ? (
                  <Spinner className="size-4" />
                ) : (
                  `${orderSide} ${orderVolume} lots`
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </>
  )
}
