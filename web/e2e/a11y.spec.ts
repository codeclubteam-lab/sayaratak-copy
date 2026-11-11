import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

import { resetLimits, roleCookies } from "./auth"
import { routesFor } from "./routes"
import type { Role } from "./routes"

// axe on every route each role may open, both languages and widths (14.4), plus one h1 and one main landmark per page.
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
          test(`${path} @${width}`, async ({ page }) => {
            await page.setViewportSize({ width, height: 900 })
            await page.goto(path)
            // The map keeps loading tiles, so a quiet network is a best effort.
            await page
              .waitForLoadState("networkidle", { timeout: 10_000 })
              .catch(() => undefined)
            // axe cannot size a target that sits below the fold of a sticky scroll panel (the search filters), so bring the last one into view.
            await page
              .locator("aside details:last-of-type > summary")
              .last()
              .scrollIntoViewIfNeeded({ timeout: 1000 })
              .catch(() => undefined)

            const { violations } = await new AxeBuilder({ page })
              .withTags([
                "wcag2a",
                "wcag2aa",
                "wcag21a",
                "wcag21aa",
                "wcag22aa",
              ])
              .analyze()
            // Map pins overlap by nature where the seed is dense; the map page has a list with the same places.
            const bad = violations
              .filter((v) => v.impact === "serious" || v.impact === "critical")
              .map((v) => ({
                ...v,
                nodes: v.nodes.filter(
                  (n) =>
                    v.id !== "target-size" ||
                    !n.target.join(" ").includes("leaflet-marker-icon")
                ),
              }))
              .filter((v) => v.nodes.length > 0)
            expect(
              bad.map((v) => ({
                id: v.id,
                impact: v.impact,
                nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
              })),
              "axe serious or critical"
            ).toEqual([])

            await expect(page.locator("h1:visible"), "visible h1").toHaveCount(
              1
            )
            await expect(page.locator("main"), "main landmark").toHaveCount(1)
          })
        }
  })
}
