import { createServerFn } from "@tanstack/react-start"
import {
  getCookie,
  getRequestHeader,
  setCookie,
} from "@tanstack/react-start/server"
import { z } from "zod"

import { localeSchema, type Locale } from "@sayaratak/shared/schemas/locale"
import type { Messages } from "./create"

export const defaultLocale: Locale = "ar"

// Server-only: the JSON is bundled here so the browser only receives the active locale.
const files = import.meta.glob<Record<string, string>>(
  "/src/messages/*/*.json",
  { eager: true, import: "default" }
)

function loadMessages(locale: Locale) {
  const messages: Messages = {}
  for (const [path, json] of Object.entries(files)) {
    const match = path.match(/\/(\w+)\/(\w+)\.json$/)
    if (match?.[1] === locale && match[2]) messages[match[2]] = json
  }
  return messages
}

export const getShellCopy = createServerFn()
  .validator(localeSchema)
  .handler(({ data: locale }) => {
    const common = loadMessages(locale).common
    return {
      title: common?.["nav.home"] ?? "",
      description: common?.["nav.description"] ?? "",
    }
  })

// Translated strings for a route's head(), looked up by key in whichever file holds them.
export const getCopy = createServerFn()
  .validator(z.object({ locale: localeSchema, keys: z.array(z.string()) }))
  .handler(({ data }) => {
    const groups = Object.values(loadMessages(data.locale))
    return data.keys.map(
      (key) => groups.find((messages) => key in messages)?.[key] ?? ""
    )
  })

// Cookie first, then Accept-Language (listed order, q values ignored), then Arabic.
function detectLocale(): Locale {
  const cookie = localeSchema.safeParse(getCookie("locale"))
  if (cookie.success) return cookie.data
  const tags = (getRequestHeader("accept-language") ?? "").split(",")
  for (const tag of tags) {
    const lang = localeSchema.safeParse(tag.trim().slice(0, 2).toLowerCase())
    if (lang.success) return lang.data
  }
  return defaultLocale
}

export const getLocaleFromRequest = createServerFn().handler(() =>
  detectLocale()
)

// Runs once per document: locale (path, then cookie, then header), messages, prefs and the server clock.
export const getRootData = createServerFn()
  .validator(z.object({ pathname: z.string() }))
  .handler(({ data }) => {
    const fromPath = localeSchema.safeParse(data.pathname.split("/")[1])
    const locale = fromPath.success ? fromPath.data : detectLocale()
    if (fromPath.success && getCookie("locale") !== locale) {
      setCookie("locale", locale, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      })
    }
    return {
      locale,
      messages: loadMessages(locale),
      prefs: {
        dataSaver: getCookie("data_saver") === "1",
        listingView:
          getCookie("listing_view") === "row"
            ? ("row" as const)
            : ("grid" as const),
      },
      serverNow: Date.now(),
    }
  })
