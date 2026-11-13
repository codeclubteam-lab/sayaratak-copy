import type { Locale } from "./send"

/**
 * Initial account language: the first supported Accept-Language, else Arabic.
 * Request-triggered mail uses requestedLocale before the saved preference.
 */
export function localeOf(request?: Request): Locale {
  return requestedLocale(request) ?? "ar"
}

export function requestedLocale(request?: Request): Locale | undefined {
  const header = request?.headers.get("accept-language") ?? ""
  const first = header
    .split(",")
    .map((part) => part.trim().slice(0, 2).toLowerCase())
    .find((code) => code === "ar" || code === "en")
  return first === "en" || first === "ar" ? first : undefined
}
