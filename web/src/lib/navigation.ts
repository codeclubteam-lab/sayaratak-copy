import type { Locale } from "@sayaratak/shared/schemas/locale"
import type { User } from "@sayaratak/shared/schemas/user"

export const marketplaceLinks = [
  { key: "nav.cars", path: "/vehicles/cars/sale" },
  { key: "nav.trucks", path: "/vehicles/trucks/sale" },
  { key: "nav.motorcycles", path: "/vehicles/motorcycles/sale" },
  { key: "nav.parts", path: "/parts" },
  { key: "nav.rentals", path: "/vehicles/cars/rent" },
]
export const serviceLinks = [
  { key: "nav.dealerships", path: "/dealerships" },
  { key: "nav.workshops", path: "/workshops" },
  { key: "nav.mechanics", path: "/mechanics" },
]

// Keep the rest of the URL byte-for-byte, including repeated search params and the hash.
export function localeHref(path: string, locale: Locale) {
  return `/${locale}${path.replace(/^\/(?:ar|en)(?=[/?#]|$)/, "").replace(/^\/(?=[?#]|$)/, "")}`
}

const dashboardBases = {
  user: "/account",
  dealership: "/dealer",
  workshop: "/workshop",
  mechanic: "/mechanic",
  admin: "/admin",
}
export const dashboardPath = (role?: User["role"]) =>
  dashboardBases[role ?? "user"]

// The blueprint defines no admin inbox; retain the shared account destination.
export function messagesPath(role?: User["role"]) {
  if (role === "dealership") return "/dealer/messages"
  if (role === "workshop") return "/workshop/inquiries"
  if (role === "mechanic") return "/mechanic/inquiries"
  return "/account/messages"
}

export function postPath(role?: User["role"]) {
  if (!role || role === "user") return "/post"
  return role === "dealership" ? "/dealer/inventory/new" : null
}

export function personalHref(path: string, locale: Locale, me: User | null) {
  const destination = localeHref(path, locale)
  return me
    ? destination
    : `${localeHref("/auth/login", locale)}?redirect=${encodeURIComponent(destination)}`
}

// The `redirect` param is only followed when it is a path on this site: one leading slash, no protocol, no `//host`, no whitespace (browsers drop tabs and newlines, so `/\t/host` would become `//host`).
export const safeRedirect = (value?: string) =>
  value && /^\/(?![/\\])\S*$/.test(value) ? value : undefined

// Pages that need a signed-in user: the dashboards, the post wizard and onboarding. Signing out there returns home.
const protectedRoots = [
  ...Object.values(dashboardBases),
  "/post",
  "/onboarding",
]
export const isProtectedPath = (pathname: string) => {
  const path = pathname.replace(/^\/(?:ar|en)(?=\/|$)/, "")
  return protectedRoots.some(
    (root) => path === root || path.startsWith(`${root}/`)
  )
}

export function bannerHref(href: string, locale: Locale) {
  if (href.startsWith("/") && !href.startsWith("//"))
    return localeHref(href, locale)
  try {
    const url = new URL(href)
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : null
  } catch {
    return null
  }
}
