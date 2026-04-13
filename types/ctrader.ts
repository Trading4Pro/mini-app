export interface CTraderMessage {
  payloadType: number
  clientMsgId?: string
  [key: string]: unknown
}

export interface CtidTraderAccount {
  ctidTraderAccountId: number
  isLive: boolean
  traderLogin: number
  lastClosingDealTimestamp?: number
  lastBalanceUpdateTimestamp?: number
}

export interface OATrader {
  ctidTraderAccountId: number
  balance: number
  balanceVersion: number
  managerBonus: number
  ibBonus: number
  nonWithdrawableBonus: number
  leverageInCents: number
  totalMarginCalculationType: number
  maxLeverage: number
  depositAssetId: number
  registrationTimestamp: number
  moneyDigits: number
}

export interface OAAsset {
  assetId: number
  name: string
  displayName?: string
  digits?: number
}

export interface OALightSymbol {
  symbolId: number
  symbolName: string
  enabled: boolean
  baseAssetId: number
  quoteAssetId: number
  description?: string
}

export interface OASymbol {
  symbolId: number
  digits: number
  pipPosition: number
  maxVolume: number
  minVolume: number
  stepVolume: number
  lotSize: number
  tickSize?: number
  tickValue?: number
  symbolName?: string
}

export interface OAPosition {
  positionId: number
  tradeData: {
    symbolId: number
    volume: number
    tradeSide: number // 1=BUY, 2=SELL
    openTimestamp: number
    label?: string
  }
  positionStatus: number
  swap: number
  price: number
  stopLoss?: number
  takeProfit?: number
  commission: number
  marginRate: number
  mirroringCommission: number
  guaranteedStopLoss: boolean
  moneyDigits: number
}

export interface OAOrder {
  orderId: number
  tradeData: {
    symbolId: number
    volume: number
    tradeSide: number
    label?: string
  }
  orderType: number // 1=MARKET, 2=LIMIT, 3=STOP, 4=STOP_LIMIT
  orderStatus: number
  limitPrice?: number
  stopPrice?: number
  stopLoss?: number
  takeProfit?: number
  expirationTimestamp?: number
}

export interface OASpotEvent {
  payloadType: number
  ctidTraderAccountId: number
  symbolId: number
  bid?: number
  ask?: number
  sessionClose?: number
  timestamp: number
}

export interface OAExecutionEvent {
  payloadType: number
  ctidTraderAccountId: number
  executionType: string // "ORDER_FILLED" | "ORDER_ACCEPTED" | "ORDER_CANCELLED" | etc
  position?: OAPosition
  order?: OAOrder
}

export interface TokenResponse {
  accessToken: string
  tokenType: string
  expiresIn: number
  refreshToken: string
}

export type TradeSide = "BUY" | "SELL"
export type OrderType = "MARKET" | "LIMIT" | "STOP"

export const TRADE_SIDE = { BUY: 1, SELL: 2 } as const
export const ORDER_TYPE = { MARKET: 1, LIMIT: 2, STOP: 3 } as const
