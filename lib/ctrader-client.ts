import {
  CTRADER_CLIENT_ID,
  CTRADER_CLIENT_SECRET,
  CTRADER_WS_DEMO,
  CTRADER_WS_LIVE,
  PayloadType,
} from "./ctrader-config"
import type { CTraderMessage } from "@/types/ctrader"

type MessageHandler = (msg: CTraderMessage) => void

export class CTraderClient {
  private ws: WebSocket | null = null
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null
  private msgId = 0
  private pendingRequests = new Map<string, { resolve: (msg: CTraderMessage) => void; reject: (err: Error) => void }>()
  private eventHandlers = new Map<number, Set<MessageHandler>>()
  private _connected = false

  get connected() {
    return this._connected
  }

  connect(isLive: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = isLive ? CTRADER_WS_LIVE : CTRADER_WS_DEMO
      this.ws = new WebSocket(url)

      this.ws.onopen = () => {
        this._connected = true
        this.startHeartbeat()
        resolve()
      }

      this.ws.onerror = (e) => {
        console.error("WebSocket error:", e)
        reject(new Error("WebSocket connection failed"))
      }

      this.ws.onclose = () => {
        this._connected = false
        this.stopHeartbeat()
      }

      this.ws.onmessage = (event) => {
        try {
          const msg: CTraderMessage = JSON.parse(event.data as string)
          console.log("[cTrader] <<", msg.payloadType, msg)
          this.handleMessage(msg)
        } catch (e) {
          console.error("Failed to parse message:", e, event.data)
        }
      }
    })
  }

  disconnect() {
    this.stopHeartbeat()
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this._connected = false
    this.pendingRequests.forEach(({ reject }) => reject(new Error("Disconnected")))
    this.pendingRequests.clear()
  }

  on(payloadType: number, handler: MessageHandler) {
    if (!this.eventHandlers.has(payloadType)) {
      this.eventHandlers.set(payloadType, new Set())
    }
    this.eventHandlers.get(payloadType)!.add(handler)
    return () => {
      this.eventHandlers.get(payloadType)?.delete(handler)
    }
  }

  private handleMessage(raw: CTraderMessage) {
    // Handle heartbeat silently
    if (raw.payloadType === PayloadType.HEARTBEAT) return

    // Flatten: merge payload fields into top level for easier access
    const payload = (raw.payload as Record<string, unknown>) || {}
    const msg: CTraderMessage = { payloadType: raw.payloadType, clientMsgId: raw.clientMsgId, ...payload }

    // Resolve pending request if clientMsgId matches
    if (msg.clientMsgId && this.pendingRequests.has(msg.clientMsgId)) {
      const { resolve } = this.pendingRequests.get(msg.clientMsgId)!
      this.pendingRequests.delete(msg.clientMsgId)
      resolve(msg)
      return
    }

    // Dispatch to event handlers
    const handlers = this.eventHandlers.get(msg.payloadType)
    if (handlers) {
      handlers.forEach((h) => h(msg))
    }
  }

  sendRequest(msg: Omit<CTraderMessage, "clientMsgId">, timeoutMs = 10000): Promise<CTraderMessage> {
    return new Promise((resolve, reject) => {
      const clientMsgId = String(++this.msgId)

      const timer = setTimeout(() => {
        this.pendingRequests.delete(clientMsgId)
        reject(new Error(`Request timeout for payloadType ${msg.payloadType}`))
      }, timeoutMs)

      this.pendingRequests.set(clientMsgId, {
        resolve: (response) => {
          clearTimeout(timer)
          resolve(response)
        },
        reject: (err) => {
          clearTimeout(timer)
          reject(err)
        },
      })

      // JSON protocol: wrap fields in payload object
      const { payloadType, ...fields } = msg
      this.send({ payloadType, clientMsgId, payload: fields } as CTraderMessage)
    })
  }

  private send(msg: CTraderMessage) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not connected")
    }
    console.log("[cTrader] >>", msg.payloadType, msg)
    this.ws.send(JSON.stringify(msg))
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ payloadType: PayloadType.HEARTBEAT })
      }
    }, 10000)
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  // ---- High-level API methods ----

  async authenticateApp(): Promise<CTraderMessage> {
    return this.sendRequest({
      payloadType: PayloadType.OA_APPLICATION_AUTH_REQ,
      clientId: CTRADER_CLIENT_ID,
      clientSecret: CTRADER_CLIENT_SECRET,
    })
  }

  async getAccountsByToken(accessToken: string): Promise<CTraderMessage> {
    return this.sendRequest({
      payloadType: PayloadType.OA_GET_ACCOUNTS_BY_ACCESS_TOKEN_REQ,
      accessToken,
    })
  }

  async authenticateAccount(ctidTraderAccountId: number, accessToken: string): Promise<CTraderMessage> {
    return this.sendRequest({
      payloadType: PayloadType.OA_ACCOUNT_AUTH_REQ,
      ctidTraderAccountId,
      accessToken,
    })
  }

  async getTrader(ctidTraderAccountId: number): Promise<CTraderMessage> {
    return this.sendRequest({
      payloadType: PayloadType.OA_TRADER_REQ,
      ctidTraderAccountId,
    })
  }

  async getAssetList(ctidTraderAccountId: number): Promise<CTraderMessage> {
    return this.sendRequest({
      payloadType: PayloadType.OA_ASSET_LIST_REQ,
      ctidTraderAccountId,
    })
  }

  async getSymbolsList(ctidTraderAccountId: number): Promise<CTraderMessage> {
    return this.sendRequest({
      payloadType: PayloadType.OA_SYMBOLS_LIST_REQ,
      ctidTraderAccountId,
    })
  }

  async getSymbolById(ctidTraderAccountId: number, symbolId: number[]): Promise<CTraderMessage> {
    return this.sendRequest({
      payloadType: PayloadType.OA_SYMBOL_BY_ID_REQ,
      ctidTraderAccountId,
      symbolId,
    })
  }

  async subscribeSpots(ctidTraderAccountId: number, symbolId: number[]): Promise<CTraderMessage> {
    return this.sendRequest({
      payloadType: PayloadType.OA_SUBSCRIBE_SPOTS_REQ,
      ctidTraderAccountId,
      symbolId,
    })
  }

  async unsubscribeSpots(ctidTraderAccountId: number, symbolId: number[]): Promise<CTraderMessage> {
    return this.sendRequest({
      payloadType: PayloadType.OA_UNSUBSCRIBE_SPOTS_REQ,
      ctidTraderAccountId,
      symbolId,
    })
  }

  async getReconcile(ctidTraderAccountId: number): Promise<CTraderMessage> {
    return this.sendRequest({
      payloadType: PayloadType.OA_RECONCILE_REQ,
      ctidTraderAccountId,
    })
  }

  async newOrder(params: {
    ctidTraderAccountId: number
    symbolId: number
    orderType: number
    tradeSide: number
    volume: number // in cents (units * 100)
    limitPrice?: number
    stopPrice?: number
    stopLoss?: number
    takeProfit?: number
    comment?: string
  }): Promise<CTraderMessage> {
    return this.sendRequest({
      payloadType: PayloadType.OA_NEW_ORDER_REQ,
      ...params,
    })
  }

  async closePosition(ctidTraderAccountId: number, positionId: number, volume: number): Promise<CTraderMessage> {
    return this.sendRequest({
      payloadType: PayloadType.OA_CLOSE_POSITION_REQ,
      ctidTraderAccountId,
      positionId,
      volume,
    })
  }

  async cancelOrder(ctidTraderAccountId: number, orderId: number): Promise<CTraderMessage> {
    return this.sendRequest({
      payloadType: PayloadType.OA_CANCEL_ORDER_REQ,
      ctidTraderAccountId,
      orderId,
    })
  }

  async getSymbolCategories(ctidTraderAccountId: number): Promise<CTraderMessage> {
    return this.sendRequest({
      payloadType: PayloadType.OA_SYMBOL_CATEGORY_REQ,
      ctidTraderAccountId,
    })
  }
}
