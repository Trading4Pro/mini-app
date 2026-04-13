interface TelegramWebApp {
  ready: () => void
  expand: () => void
  close: () => void
  initDataUnsafe: {
    user?: {
      id: number
      first_name?: string
      last_name?: string
      username?: string
    }
  }
  MainButton: {
    text: string
    show: () => void
    hide: () => void
    onClick: (callback: () => void) => void
  }
}

interface Window {
  Telegram?: {
    WebApp: TelegramWebApp
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T4PChart?: any
}
