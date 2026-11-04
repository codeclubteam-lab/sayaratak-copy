import { Suspense, lazy, useEffect, useState } from "react"

const DevPanel = import.meta.env.DEV
  ? lazy(() => import("./dev-panel").then((m) => ({ default: m.DevPanel })))
  : null

// Development only: Ctrl+Shift+D toggles the panel. Renders nothing on the server and first paint.
export function DevPanelHost() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
  if (!DevPanel || !open) return null
  return (
    <Suspense fallback={null}>
      <DevPanel onClose={() => setOpen(false)} />
    </Suspense>
  )
}
