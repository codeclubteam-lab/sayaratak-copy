import { createContext, use, useEffect, useState, type ReactNode } from "react"
import { useRouter } from "@tanstack/react-router"

import { motionAllowed, pageTransition } from "./motion"

export type Prefs = { dataSaver: boolean; listingView: "grid" | "row" }

const PrefsContext = createContext<Prefs>({
  dataSaver: false,
  listingView: "grid",
})
const SetPrefsContext = createContext<(patch: Partial<Prefs>) => void>(() => {
  throw new Error("PrefsProvider is required")
})

// Read from cookies in the root loader, so server and client render the same.
export function PrefsProvider({
  prefs,
  children,
}: {
  prefs: Prefs
  children: ReactNode
}) {
  const [current, setCurrent] = useState(prefs)
  const router = useRouter()
  // Data saver and reduced motion switch hover preload and view transitions off, and back on, without a reload. `motionAllowed()` reads the <html> attribute, so it is set first.
  useEffect(() => {
    document.documentElement.toggleAttribute(
      "data-data-saver",
      current.dataSaver
    )
    const apply = () =>
      router.update({
        context: router.options.context,
        defaultPreload: current.dataSaver ? false : "intent",
        defaultViewTransition: motionAllowed() ? pageTransition : false,
      })
    apply()
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
    reduced.addEventListener("change", apply)
    return () => reduced.removeEventListener("change", apply)
  }, [current.dataSaver, router])
  const update = (patch: Partial<Prefs>) => {
    for (const [key, value] of Object.entries(patch)) {
      const name = key === "dataSaver" ? "data_saver" : "listing_view"
      const stored = typeof value === "boolean" ? (value ? "1" : "0") : value
      document.cookie = `${name}=${stored}; Path=/; Max-Age=31536000; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`
    }
    setCurrent((previous) => ({ ...previous, ...patch }))
  }
  return (
    <PrefsContext value={current}>
      <SetPrefsContext value={update}>{children}</SetPrefsContext>
    </PrefsContext>
  )
}

export const usePrefs = () => use(PrefsContext)
export const useSetPrefs = () => use(SetPrefsContext)
