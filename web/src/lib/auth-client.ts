import { createAuthClient } from "better-auth/react"
import { emailOTPClient, twoFactorClient } from "better-auth/client/plugins"

import { authError } from "./api/auth-error"

const browserBase = import.meta.env.VITE_API_BASE_URL

// Session reads still go through meQuery, not a second client-side session store.
export const authClient = createAuthClient({
  baseURL: browserBase === "/" ? undefined : browserBase || undefined,
  basePath: "/api/v1/auth",
  plugins: [emailOTPClient(), twoFactorClient()],
  fetchOptions: {
    credentials: "include",
    customFetchImpl: (input, init) => {
      const headers = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined)
      )
      // Capture the rendered route's language per call, never in shared SSR state.
      const locale =
        typeof document === "undefined"
          ? undefined
          : document.documentElement.lang
      if (
        (locale === "ar" || locale === "en") &&
        !headers.has("accept-language")
      )
        headers.set("accept-language", locale)
      return fetch(input, { ...init, headers })
    },
    onError: ({ error, response }) => {
      throw authError(
        { ...error, status: response.status },
        response.headers.get("retry-after")
      )
    },
  },
})
