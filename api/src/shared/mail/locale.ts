import type { Locale } from "./send"

/**
 * The language of a mail when no user row says it (A9): the first of `ar` or
 * `en` in Accept-Language, else Arabic.
 */
export function localeOf(request?: Request): Locale {
  const header = request?.headers.get("accept-language") ?? ""
  const first = header
    .split(",")
    .map((part) => part.trim().slice(0, 2).toLowerCase())
    .find((code) => code === "ar" || code === "en")
  return first === "en" ? "en" : "ar"
}
