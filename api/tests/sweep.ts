import { app } from "~/app"
import { specOf } from "~/shared/openapi/registry"

import { req, type SignedIn } from "./helpers"

const PREFIX = "/api/v1"

export type Route = { method: string; path: string; access: "public" | "user" }

/** Every v1 route the contract lists (those with `spec()`), read from the router so a new route joins the sweeps by itself. */
export function v1Routes(): Route[] {
  const seen = new Set<string>()
  const routes: Route[] = []
  for (const r of app.routes) {
    const route = specOf(r.handler)
    const key = `${r.method} ${r.path}`
    if (!route || !r.path.startsWith(PREFIX) || seen.has(key)) continue
    seen.add(key)
    routes.push({
      method: r.method,
      path: r.path.slice(PREFIX.length),
      access: route.access,
    })
  }
  return routes
}

export const keyOf = (r: Route) => `${r.method} ${r.path}`

/** `/threads/:id/messages` with `{ id: "t-1" }`; a parameter left out becomes `x`. */
export function fill(path: string, ids: Record<string, string> = {}) {
  return path.replace(/:(\w+)/g, (_, name: string) =>
    encodeURIComponent(ids[name] ?? "x")
  )
}

/** The route as a browser sends it: the cookie and Origin of `as` (none for a visitor), an empty JSON body on writes. */
export function hit(
  r: Route,
  {
    as,
    ids,
    body = {},
  }: { as?: SignedIn; ids?: Record<string, string>; body?: object } = {}
) {
  const write = r.method !== "GET"
  return req(fill(r.path, ids), {
    method: r.method,
    headers: {
      ...(as && { cookie: as.cookie, origin: as.origin }),
      ...(write && { "content-type": "application/json" }),
    },
    body: write ? JSON.stringify(body) : undefined,
  })
}

/** The same call with only a bearer token, as an app sends it. */
export function hitWithBearer(r: Route, token: string) {
  const write = r.method !== "GET"
  return req(fill(r.path), {
    method: r.method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(write && { "content-type": "application/json" }),
    },
    body: write ? "{}" : undefined,
  })
}
