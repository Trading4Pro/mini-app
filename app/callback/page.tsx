"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Spinner } from "@/components/ui/spinner"

function CallbackHandler() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [error, setError] = useState("")

  useEffect(() => {
    const code = searchParams.get("code")
    if (!code) {
      setStatus("error")
      setError("No authorization code received")
      return
    }

    const redirectUri = `${window.location.origin}/callback`

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
        localStorage.setItem("ctrader_access_token", data.accessToken)
        localStorage.setItem("ctrader_refresh_token", data.refreshToken || "")
        setStatus("success")
        window.location.href = "/"
      })
      .catch((err) => {
        setStatus("error")
        setError(err.message)
      })
  }, [searchParams])

  if (status === "error") {
    return (
      <div className="text-center space-y-3">
        <p className="text-destructive font-medium">Authentication failed</p>
        <p className="text-muted-foreground text-sm">{error}</p>
        <a href="/" className="text-primary underline text-sm">
          Back to app
        </a>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <Spinner className="h-8 w-8" />
      <p className="text-muted-foreground">Connecting your cTrader account...</p>
    </div>
  )
}

export default function CallbackPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground">
      <Suspense
        fallback={
          <div className="flex flex-col items-center gap-3">
            <Spinner className="h-8 w-8" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        }
      >
        <CallbackHandler />
      </Suspense>
    </main>
  )
}
