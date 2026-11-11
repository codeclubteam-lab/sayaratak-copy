import process from "node:process"

import { expect, test } from "@playwright/test"

import { resetDb, resetLimits, roleCookies } from "./auth"
import { routesFor } from "./routes"
import type { Role } from "./routes"

// Empty data (14.6): runs against `/api/_test/empty` on postgres-test. Every page still renders, shows
// no broken values, and each empty state offers something to do.

test.beforeAll(async () => {
  if (process.env.STATES_EMPTY !== "1") await resetDb("empty")
})

const roles: Array<Role> = [
  "anon",
  "user",
  "dealer",
  "workshop",
  "mechanic",
  "admin",
]

// Empty states that rightly have no button of their own, because there is nothing to do ("Nothing needs your attention",
// notifications, a thread to pick, reviews that customers write, admin queues) or the page's header action sits right above
// ("Post a listing" over the listings tabs, "New banner", "Back up now", "Promote").
const informational =
  /\/(?:account|onboarding|dealer|account\/listings|dealer\/inventory|dealer\/promotions|(?:account|dealer|workshop|mechanic|admin)\/notifications|(?:account|dealer)\/messages|(?:workshop|mechanic)\/inquiries|(?:dealer|workshop|mechanic)\/reviews|workshop|mechanic|admin\/(?:ads|backups|banners|broadcasts|listings|makes|moderation|payments|promotions|reports|reviews|verifications))$/

// Runs in the page: visible text that leaks a broken value, and empty states without a link or button.
const inspect = () => {
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
  const dead = [...document.querySelectorAll("[data-slot=empty]")]
    .filter((e) => !e.querySelector("a[href], button"))
    .map((e) => e.textContent.trim().slice(0, 60))
  const empties = document.querySelectorAll("[data-slot=empty]").length
  return { leaks, dead, empties }
}

for (const role of roles)
  test.describe(`empty data ${role}`, () => {
    test.beforeEach(async ({ context, baseURL }) => {
      await resetLimits()
      if (role !== "anon")
        await context.addCookies(await roleCookies(role, baseURL!))
    })
    for (const locale of ["ar", "en"] as const)
      for (const route of routesFor(role)) {
        const path = `/${locale}${route}`
        test(path, async ({ page }) => {
          const errors: Array<string> = []
          page.on("pageerror", (e) => errors.push(e.message))
          await page.goto(path, { waitUntil: "networkidle" })
          await expect(
            page.getByRole("heading", { level: 1 }).first()
          ).toBeVisible({
            timeout: 15_000,
          })
          await expect(page.locator("[aria-busy=true]")).toHaveCount(0, {
            timeout: 15_000,
          })
          const found = await page.evaluate(inspect)
          expect(errors, "thrown errors").toEqual([])
          expect(found.leaks, "leaked text").toEqual([])
          if (!informational.test(route))
            expect(found.dead, "empty states with no action").toEqual([])
          expect(
            await page.evaluate(() => document.body.innerText.trim().length),
            "page is blank"
          ).toBeGreaterThan(20)
        })
      }
  })
