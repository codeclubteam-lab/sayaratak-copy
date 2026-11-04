import { vi } from "vitest"

import { handleMock } from "@/mocks/router"

// Routes `/api/*` calls into the mock handlers, so tests never hand-mock fetch. `as` signs requests in as a user id.
export function useMockFetch(as?: string) {
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(
      typeof input === "string" ? input : input.toString(),
      "http://localhost"
    )
    const headers = new Headers(init?.headers)
    const cookies = [as ? `sy_session=${as}` : "", document.cookie]
      .filter(Boolean)
      .join("; ")
    if (cookies) headers.set("cookie", cookies)
    return handleMock(new Request(url, { ...init, headers }))
  })
}
