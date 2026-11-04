import { createServerFn } from "@tanstack/react-start"
import { getRequestHeader } from "@tanstack/react-start/server"

// Server only: the incoming request's cookie header, so loaders see the signed-in user.
export const getForwardedCookie = createServerFn().handler(() =>
  getRequestHeader("cookie")
)
