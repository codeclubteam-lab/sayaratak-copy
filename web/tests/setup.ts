import { cleanup, configure } from "@testing-library/react"
import { afterEach, beforeEach, vi } from "vitest"
import { resetAuthFake } from "./auth-client-fake"

vi.mock("@/lib/auth-client", () => import("./auth-client-fake"))

const clearApiEnvs = () => {
  vi.stubEnv("API_BASE_URL", "")
  vi.stubEnv("VITE_API_BASE_URL", "")
}

clearApiEnvs()
beforeEach(() => {
  clearApiEnvs()
  resetAuthFake()
})

afterEach(cleanup)

// findBy and waitFor give up after 1 s by default, which a busy machine (40 files at once, a CI runner) overruns.
configure({ asyncUtilTimeout: 5_000 })

process.env.MOCK_LATENCY_MS = "0"

// jsdom has no matchMedia: report "no reduced-motion preference" unless a test overrides it.
if (
  typeof window !== "undefined" &&
  typeof Reflect.get(window, "matchMedia") !== "function"
) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }),
  })
}

// jsdom has no IntersectionObserver: a no-op one, so sticky bars and banners mount. Tests that need entries stub their own.
if (
  typeof window !== "undefined" &&
  typeof Reflect.get(window, "IntersectionObserver") !== "function"
) {
  Object.defineProperty(window, "IntersectionObserver", {
    configurable: true,
    writable: true,
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    },
  })
}

// Same for ResizeObserver (the listing description measures itself).
if (
  typeof window !== "undefined" &&
  typeof Reflect.get(window, "ResizeObserver") !== "function"
) {
  Object.defineProperty(window, "ResizeObserver", {
    configurable: true,
    writable: true,
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  })
}
