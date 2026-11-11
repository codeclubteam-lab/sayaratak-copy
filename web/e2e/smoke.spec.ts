import { expect, test } from "@playwright/test"

import { apiBase, resetLimits, roleCookies } from "./auth"
import { routesFor } from "./routes"
import type { Role } from "./routes"

// Every route each role may open, in both languages and at both widths (14.1).
const roles: Array<Role> = [
  "anon",
  "user",
  "dealer",
  "workshop",
  "mechanic",
  "admin",
]
const locales = ["ar", "en"] as const
const widths = [390, 1280] as const
// Blocker B1: the seed's vehicle and business photos are not delivered yet, so their 404s are expected. Drop this once they land.
const missingPhoto = /\/mock\/(?:vehicle|business)-[\w-]+\.webp$/

// Runs in the page: visible text that leaks a broken value, images without width and height, page wider than the viewport.
const inspect = (width: number) => {
  const leaks: Array<string> = []
  const key = /^[a-z_]+(\.[a-z_]+)+$/
  const leak = /\bNaN\b|\bundefined\b|\[object Object\]/
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.trim() ?? ""
    const parent = node.parentElement
    if (!text || !parent || !parent.checkVisibility()) continue
    if (parent.closest("script, style, noscript")) continue
    if (leak.test(text) || key.test(text)) leaks.push(text)
  }
  const images = [...document.querySelectorAll("img")]
    .filter((img) => !img.closest(".leaflet-container"))
    .filter((img) => !img.hasAttribute("width") || !img.hasAttribute("height"))
    .map((img) => img.getAttribute("src") ?? "")
  const overflow = document.documentElement.scrollWidth - width
  return { leaks, images, overflow }
}

for (const role of roles) {
  test.describe(role, () => {
    test.beforeEach(async ({ context, baseURL }) => {
      await resetLimits()
      if (role !== "anon")
        await context.addCookies(await roleCookies(role, baseURL!))
    })

    for (const locale of locales)
      for (const width of widths)
        for (const route of routesFor(role)) {
          const path = `/${locale}${route}`
          test(`${path} @${width}`, async ({ page, baseURL }) => {
            const errors: Array<string> = []
            page.on("console", (m) => {
              if (m.type() === "error" && !missingPhoto.test(m.location().url))
                errors.push(`console: ${m.text()}`)
            })
            page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`))
            page.on("response", (r) => {
              if (
                r.status() >= 400 &&
                (r.url().startsWith(baseURL ?? "") ||
                  r.url().startsWith(apiBase)) &&
                !missingPhoto.test(r.url())
              )
                errors.push(`${r.status()} ${r.url()}`)
            })

            await page.setViewportSize({ width, height: 900 })
            const response = await page.goto(path, { waitUntil: "networkidle" })
            expect(response?.status(), "document status").toBeLessThan(400)
            // A role that may open the page is never bounced to sign in.
            if (!route.startsWith("/auth"))
              expect(new URL(page.url()).pathname).not.toMatch(
                `^/${locale}/auth`
              )

            const found = await page.evaluate(inspect, width)
            expect(errors, "errors").toEqual([])
            expect(found.leaks, "leaked text").toEqual([])
            expect(found.images, "images without dimensions").toEqual([])
            expect(found.overflow, "horizontal overflow").toBeLessThanOrEqual(0)
          })
        }
  })
}
