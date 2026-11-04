import { createContext, use, useEffect, useState, type ReactNode } from "react"

const NowContext = createContext(0)

// The first client render uses the server's clock, so server and client HTML match.
export function NowProvider({
  serverNow,
  children,
}: {
  serverNow: number
  children: ReactNode
}) {
  const [now, setNow] = useState(serverNow)
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])
  return <NowContext value={now}>{children}</NowContext>
}

// Never call Date.now() while rendering; read the clock here.
export const useNow = () => use(NowContext)
