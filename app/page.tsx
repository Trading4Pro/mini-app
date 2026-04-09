"use client"

import { useEffect, useState } from "react"
import Script from "next/script"

export default function TelegramMiniApp() {
  const [user, setUser] = useState<{ first_name?: string; username?: string } | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp
      tg.ready()
      tg.expand()
      setUser(tg.initDataUnsafe?.user || null)
      setReady(true)
    }
  }, [])

  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />
      <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Telegram Mini App</h1>
          {ready ? (
            <p className="text-muted-foreground">
              Hello, {user?.first_name || user?.username || "User"}!
            </p>
          ) : (
            <p className="text-muted-foreground">Loading...</p>
          )}
        </div>
      </main>
    </>
  )
}
