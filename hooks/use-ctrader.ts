"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CTraderClient } from "@/lib/ctrader-client"
import { CTRADER_AUTH_URL, CTRADER_CLIENT_ID, PayloadType } from "@/lib/ctrader-config"
import type {
  CtidTraderAccount,
  OATrader,
  OALightSymbol,
  OASymbol,
  OAPosition,
  OAOrder,
  CTraderMessage,
} from "@/types/ctrader"

export type ConnectionStatus = "disconnected" | "connecting" | "authenticating" | "connected" | "error"

interface QuoteData {
  bid?: number
  ask?: number
  timestamp: number
}

export function useCTrader() {
  const clientRef = useRef<CTraderClient | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>("disconnected")
  const [error, setError] = useState<string | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLive, setIsLive] = useState(false)

  // Account state
  const [accounts, setAccounts] = useState<CtidTraderAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null)
  const [trader, setTrader] = useState<OATrader | null>(null)
  const [depositAssetName, setDepositAssetName] = useState("USD")

  // Market data
  const [symbols, setSymbols] = useState<OALightSymbol[]>([])
  const [symbolDetails, setSymbolDetails] = useState<Map<number, OASymbol>>(new Map())
  const [quotes, setQuotes] = useState<Map<number, QuoteData>>(new Map())

  // Trading state
  const [positions, setPositions] = useState<OAPosition[]>([])
  const [orders, setOrders] = useState<OAOrder[]>([])

  // Symbol name lookup
  const symbolNameMap = useRef<Map<number, string>>(new Map())

  const getSymbolName = useCallback((symbolId: number) => {
    return symbolNameMap.current.get(symbolId) || `#${symbolId}`
  }, [])

  // Check for stored token or OAuth code on mount
  useEffect(() => {
    const token = localStorage.getItem("ctrader_access_token")
    if (token) {
      setAccessToken(token)
      return
    }

    // Check if we just came back from OAuth with a code in the URL
    const params = new URLSearchParams(window.location.search)
    const code = params.get("code")
    if (code) {
      // Exchange code for token
      const redirectUri = `${window.location.origin}/`
      fetch("/api/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, redirectUri }),
      })
        .then((res) => {
          if (!res.ok) throw new Error("Token exchange failed")
          return res.json()
        })
        .then((data) => {
          const token = data.accessToken || data.access_token
          if (token) {
            localStorage.setItem("ctrader_access_token", token)
            localStorage.setItem("ctrader_refresh_token", data.refreshToken || data.refresh_token || "")
            setAccessToken(token)
          } else {
            setError("No token in response")
          }
          // Clean URL
          window.history.replaceState({}, "", "/")
        })
        .catch((err) => {
          setError("Auth failed: " + err.message)
          window.history.replaceState({}, "", "/")
        })
    }
  }, [])

  const login = useCallback(() => {
    // Redirect to cTrader OAuth — redirect back to main page (not /callback)
    const redirectUri = `${window.location.origin}/`
    const authUrl = `${CTRADER_AUTH_URL}?client_id=${CTRADER_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=trading`
    window.location.href = authUrl
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem("ctrader_access_token")
    localStorage.removeItem("ctrader_refresh_token")
    setAccessToken(null)
    setAccounts([])
    setSelectedAccountId(null)
    setTrader(null)
    setSymbols([])
    setPositions([])
    setOrders([])
    setQuotes(new Map())
    setStatus("disconnected")
    clientRef.current?.disconnect()
    clientRef.current = null
  }, [])

  const connect = useCallback(async (token: string, isLive: boolean) => {
    if (clientRef.current?.connected) return

    const client = new CTraderClient()
    clientRef.current = client

    try {
      setStatus("connecting")
      setError(null)
      await client.connect(isLive)

      setStatus("authenticating")
      // Authenticate app
      const appAuthRes = await client.authenticateApp()
      console.log("[cTrader] App auth response:", appAuthRes)
      if (appAuthRes.payloadType !== PayloadType.OA_APPLICATION_AUTH_RES) {
        const errMsg = (appAuthRes.errorCode as string) || (appAuthRes.description as string) || JSON.stringify(appAuthRes)
        throw new Error(`App auth failed: ${errMsg}`)
      }

      // Get accounts
      const accountsRes = await client.getAccountsByToken(token)
      const ctidAccounts = (accountsRes.ctidTraderAccount as CtidTraderAccount[]) || []
      setAccounts(ctidAccounts)

      setStatus("connected")
      return ctidAccounts
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "Connection failed")
      client.disconnect()
      clientRef.current = null
      throw err
    }
  }, [])

  const selectAccount = useCallback(async (accountId: number) => {
    const client = clientRef.current
    const token = accessToken
    if (!client || !token) return

    // Check if we need to reconnect to the right server (demo vs live)
    const account = accounts.find((a) => a.ctidTraderAccountId === accountId)
    if (account) {
      const needsLive = account.isLive
      if (needsLive !== isLive) {
        // Need to reconnect to the correct server (demo↔live)
        try {
          setStatus("connecting")
          setError(null)
          client.disconnect()
          clientRef.current = null
          setIsLive(needsLive)
          const newClient = new CTraderClient()
          clientRef.current = newClient
          await newClient.connect(needsLive)
          setStatus("authenticating")
          const appAuth = await newClient.authenticateApp()
          if (appAuth.payloadType !== PayloadType.OA_APPLICATION_AUTH_RES) {
            throw new Error("App auth failed on " + (needsLive ? "live" : "demo") + " server")
          }
          setStatus("connected")
        } catch (err) {
          setStatus("error")
          setError(err instanceof Error ? err.message : "Failed to connect to " + (needsLive ? "live" : "demo"))
          return
        }
      }
    }

    const activeClient = clientRef.current!

    try {
      // Authenticate account
      const authRes = await activeClient.authenticateAccount(accountId, token)
      console.log("[cTrader] Account auth result:", authRes)
      if (authRes.payloadType !== PayloadType.OA_ACCOUNT_AUTH_RES) {
        const errMsg = (authRes.description as string) || (authRes.errorCode as string) || JSON.stringify(authRes)
        throw new Error(`Account auth failed: ${errMsg}`)
      }
      setSelectedAccountId(accountId)

      // Get trader info
      const traderRes = await activeClient.getTrader(accountId)
      const traderData = traderRes.trader as OATrader
      setTrader(traderData)

      // Get assets to find deposit currency name
      const assetsRes = await activeClient.getAssetList(accountId)
      const assets = (assetsRes.asset as { assetId: number; name: string }[]) || []
      const depositAsset = assets.find((a) => a.assetId === traderData?.depositAssetId)
      if (depositAsset) setDepositAssetName(depositAsset.name)

      // Get symbols list
      const symbolsRes = await activeClient.getSymbolsList(accountId)
      const symbolList = (symbolsRes.symbol as OALightSymbol[]) || []
      // Only show enabled symbols, limit to first 100
      const enabledSymbols = symbolList.filter((s) => s.enabled).slice(0, 100)
      setSymbols(enabledSymbols)

      // Build symbol name map
      symbolNameMap.current.clear()
      symbolList.forEach((s) => symbolNameMap.current.set(s.symbolId, s.symbolName))

      // Get symbol details (digits, lot size, etc.) for enabled symbols
      if (enabledSymbols.length > 0) {
        const symbolIds = enabledSymbols.map((s) => s.symbolId)
        // Request in batches of 50
        for (let i = 0; i < symbolIds.length; i += 50) {
          const batch = symbolIds.slice(i, i + 50)
          const detailsRes = await activeClient.getSymbolById(accountId, batch)
          const details = (detailsRes.symbol as OASymbol[]) || []
          setSymbolDetails((prev) => {
            const next = new Map(prev)
            details.forEach((d) => next.set(d.symbolId, d))
            return next
          })
        }
      }

      // Get positions and orders (reconcile)
      const reconcileRes = await activeClient.getReconcile(accountId)
      setPositions((reconcileRes.position as OAPosition[]) || [])
      setOrders((reconcileRes.order as OAOrder[]) || [])

      // Subscribe to spot prices for first 20 symbols
      const spotSymbols = enabledSymbols.slice(0, 20).map((s) => s.symbolId)
      if (spotSymbols.length > 0) {
        await activeClient.subscribeSpots(accountId, spotSymbols)
      }

      // Listen for spot events — batch updates to avoid re-render storms during scroll
      let quoteBatch = new Map<number, { bid?: number; ask?: number; timestamp: number }>()
      let quoteFlushTimer: ReturnType<typeof setTimeout> | null = null
      const flushQuotes = () => {
        quoteFlushTimer = null
        if (quoteBatch.size === 0) return
        const batch = quoteBatch
        quoteBatch = new Map()
        setQuotes((prev) => {
          const next = new Map(prev)
          batch.forEach((update, symId) => {
            const existing = next.get(symId) || { timestamp: 0 }
            next.set(symId, {
              bid: update.bid ?? existing.bid,
              ask: update.ask ?? existing.ask,
              timestamp: update.timestamp,
            })
          })
          return next
        })
      }
      activeClient.on(PayloadType.OA_SPOT_EVENT, (msg) => {
        const symId = msg.symbolId as number
        quoteBatch.set(symId, {
          bid: msg.bid as number | undefined,
          ask: msg.ask as number | undefined,
          timestamp: (msg.timestamp as number) || Date.now(),
        })
        if (!quoteFlushTimer) {
          quoteFlushTimer = setTimeout(flushQuotes, 250) // flush every 250ms max
        }
      })

      // Listen for execution events (order fills, position changes)
      // executionType: number enum or string
      // 2=ORDER_ACCEPTED, 3=ORDER_FILLED, 4=ORDER_REPLACED,
      // 5=ORDER_CANCELLED, 6=ORDER_EXPIRED, 7=ORDER_REJECTED,
      // 11=ORDER_PARTIAL_FILL
      // positionStatus: 1=OPEN, 2=CLOSED, 3=CREATED, 4=ERROR
      activeClient.on(PayloadType.OA_EXECUTION_EVENT, (msg: CTraderMessage) => {
        const et = msg.executionType
        const isFilled = et === 3 || et === 11 || et === "ORDER_FILLED" || et === "ORDER_PARTIAL_FILL"
        const isCancelled = et === 5 || et === 6 || et === 7 ||
          et === "ORDER_CANCELLED" || et === "ORDER_EXPIRED" || et === "ORDER_REJECTED"
        const isAccepted = et === 2 || et === "ORDER_ACCEPTED"

        if (msg.position) {
          const pos = msg.position as OAPosition
          // Check if position is closed (status 2) — handles close from any client
          const positionClosed = pos.positionStatus === 2 || pos.positionStatus === "POSITION_STATUS_CLOSED"

          setPositions((prev) => {
            const idx = prev.findIndex((p) => p.positionId === pos.positionId)

            if (positionClosed) {
              // Position was closed (from this client or another) — remove it
              return prev.filter((p) => p.positionId !== pos.positionId)
            }

            if (isFilled) {
              // New position opened or updated
              if (idx >= 0) {
                const next = [...prev]
                next[idx] = pos
                return next
              }
              return [...prev, pos]
            }

            // Update existing position (SL/TP change, partial close, etc.)
            if (idx >= 0) {
              const next = [...prev]
              next[idx] = pos
              return next
            }
            return prev
          })

          // Also update trader (balance) after position close
          if (positionClosed && accountId) {
            activeClient.getTrader(accountId).then((res) => {
              if (res.trader) setTrader(res.trader as OATrader)
            }).catch(() => {})
          }
        }

        if (msg.order) {
          const ord = msg.order as OAOrder
          // Check order status: 1=ACCEPTED, 2=FILLED, 3=REJECTED, 4=EXPIRED, 5=CANCELLED
          const orderDone = isCancelled || isFilled ||
            ord.orderStatus === 2 || ord.orderStatus === 3 ||
            ord.orderStatus === 4 || ord.orderStatus === 5

          setOrders((prev) => {
            const idx = prev.findIndex((o) => o.orderId === ord.orderId)

            if (orderDone) {
              // Order filled/cancelled/expired — remove from pending
              return prev.filter((o) => o.orderId !== ord.orderId)
            }

            if (isAccepted) {
              // New pending order
              if (idx >= 0) {
                const next = [...prev]
                next[idx] = ord
                return next
              }
              return [...prev, ord]
            }

            // Update existing order
            if (idx >= 0) {
              const next = [...prev]
              next[idx] = ord
              return next
            }
            return prev
          })
        }
      })

      // Listen for trader updates (balance changes)
      activeClient.on(PayloadType.OA_TRADER_UPDATE_EVENT, (msg) => {
        if (msg.trader) {
          setTrader(msg.trader as OATrader)
        }
      })

      // Listen for order errors
      activeClient.on(PayloadType.OA_ORDER_ERROR_EVENT, (msg) => {
        setError(`Order error: ${msg.description || msg.errorCode || "Unknown error"}`)
        setTimeout(() => setError(null), 5000)
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load account")
    }
  }, [accessToken, accounts, isLive])

  const placeOrder = useCallback(async (params: {
    symbolId: number
    tradeSide: number
    volume: number
    orderType: number
    limitPrice?: number
    stopPrice?: number
    stopLoss?: number
    takeProfit?: number
    expirationTimestamp?: number
    trailingStopLoss?: boolean
    timeInForce?: number
  }) => {
    const client = clientRef.current
    if (!client || !selectedAccountId) throw new Error("Not connected")

    return client.newOrder({
      ctidTraderAccountId: selectedAccountId,
      ...params,
    })
  }, [selectedAccountId])

  const getDealList = useCallback(async (fromMs: number, toMs: number, maxRows = 100) => {
    const client = clientRef.current
    if (!client || !selectedAccountId) throw new Error("Not connected")
    return client.getDealList({
      ctidTraderAccountId: selectedAccountId,
      fromTimestamp: fromMs,
      toTimestamp: toMs,
      maxRows,
    })
  }, [selectedAccountId])

  const closePosition = useCallback(async (positionId: number, volume: number) => {
    const client = clientRef.current
    if (!client || !selectedAccountId) throw new Error("Not connected")

    return client.closePosition(selectedAccountId, positionId, volume)
  }, [selectedAccountId])

  const cancelOrder = useCallback(async (orderId: number) => {
    const client = clientRef.current
    if (!client || !selectedAccountId) throw new Error("Not connected")

    return client.cancelOrder(selectedAccountId, orderId)
  }, [selectedAccountId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clientRef.current?.disconnect()
    }
  }, [])

  const getTrendbars = useCallback(async (
    symbolId: number,
    period: number,
    fromTimestamp: number,
    toTimestamp: number,
  ) => {
    const client = clientRef.current
    if (!client || !selectedAccountId) throw new Error("Not connected")
    return client.getTrendbars({
      ctidTraderAccountId: selectedAccountId,
      symbolId,
      period,
      fromTimestamp,
      toTimestamp,
    })
  }, [selectedAccountId])

  return {
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
    isLive,
    setIsLive,
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
    getTrendbars,
    getDealList,
  }
}
