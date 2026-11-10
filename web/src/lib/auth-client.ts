import { createAuthClient } from "better-auth/react"
import { emailOTPClient, twoFactorClient } from "better-auth/client/plugins"

import { authError } from "./api/auth-error"

// Session reads still go through meQuery, not a second client-side session store.
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_BASE_URL || undefined,
  basePath: "/api/v1/auth",
  plugins: [emailOTPClient(), twoFactorClient()],
  fetchOptions: {
    credentials: "include",
    customFetchImpl: (input, init) => fetch(input, init),
    onError: ({ error, response }) => {
      throw authError(
        { ...error, status: response.status },
        response.headers.get("retry-after")
      )
    },
  },
})
