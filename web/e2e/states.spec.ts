import { readFileSync } from "node:fs"

import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"

import { resetLimits, roleCookies } from "./auth"
import { routesFor } from "./routes"
import type { Role } from "./routes"

// The states sweep (14.6): each page family under latency, 500, 404 and offline. Server-rendered routes read
// `test_fail` and `test_latency` cookies via the states SSR proxy, while client API calls are intercepted directly.
const message = (locale: string, file: string, key: string) => {
  const all = JSON.parse(
    readFileSync(`src/messages/${locale}/${file}.json`, "utf8")
  ) as Record<string, string>
  const value = all[key]
  if (value === undefined) throw new Error(`missing ${locale} key ${key}`)
  return value
}
const retry = {
  ar: message("ar", "common", "common.retry"),
  en: message("en", "common", "common.retry"),
}
const offlineText = {
  ar: message("ar", "error", "error.offline"),
  en: message("en", "error", "error.offline"),
}
const locales = ["ar", "en"] as const

type Family = { name: string; role: Role; paths: Array<string> }

const listing = "chevrolet-cruze-2014-single-owner-khartoum-l0000p"
const dashboard = (role: Exclude<Role, "anon">, prefix: string) =>
  routesFor(role).filter((p) => p.startsWith(prefix))

export const families: Array<Family> = [
  { name: "Home", role: "anon", paths: [""] },
  {
    name: "Search",
    role: "anon",
    paths: ["/search", "/parts", "/vehicles/cars/sale"],
  },
  { name: "Listing detail", role: "anon", paths: [`/listing/${listing}`] },
  {
    name: "Directories",
    role: "anon",
    paths: ["/dealerships", "/workshops", "/mechanics"],
  },
  {
    name: "Profiles",
    role: "anon",
    paths: [
      "/dealerships/al-salam-motors",
      "/workshops/nile-workshop",
      "/mechanics/um-5-6",
    ],
  },
  { name: "Map", role: "anon", paths: ["/map"] },
  { name: "Post wizard", role: "user", paths: ["/post"] },
  { name: "Onboarding", role: "user", paths: ["/onboarding"] },
  {
    name: "Account dashboard",
    role: "user",
    paths: dashboard("user", "/account"),
  },
  {
    name: "Dealership dashboard",
    role: "dealer",
    paths: dashboard("dealer", "/dealer"),
  },
  {
    name: "Workshop dashboard",
    role: "workshop",
    paths: dashboard("workshop", "/workshop"),
  },
  {
    name: "Mechanic dashboard",
    role: "mechanic",
    paths: dashboard("mechanic", "/mechanic"),
  },
  {
    name: "Admin dashboard",
    role: "admin",
    paths: dashboard("admin", "/admin"),
  },
]

// Collects what must never happen in any state: a thrown error. React reports the failed server render of a route
// (#520, or a "redacted" message in production) as a recoverable error while the error page still shows, so those are
// noise from the injected failure and not counted.
function watch(page: Page) {
  const errors: Array<string> = []
  page.on("pageerror", (e) => {
    if (e.message.includes("React error #520") || e.message === "redacted")
      return
    errors.push(`pageerror: ${e.message}`)
  })
  return errors
}

const blank = (page: Page) =>
  page.evaluate(() => document.body.innerText.trim().length < 20)

// Keep session checks (`/api/v1/me`) and Better-Auth routes live so dashboards still render behind their guard.
const isDataApi = (origin: string) => {
  const browserOrigin = new URL(origin).origin
  return (u: URL) =>
    u.origin === browserOrigin &&
    u.pathname.startsWith("/api/v1/") &&
    !/^\/api\/v1\/(?:me$|auth\/)/.test(u.pathname)
}

const failApi = (page: Page, status: 500 | 404, origin: string) =>
  page.route(isDataApi(origin), (route) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify({
        code: status === 404 ? "not_found" : "server_error",
      }),
    })
  )

const delayApi = (page: Page, ms: number, origin: string) =>
  page.route(isDataApi(origin), async (route) => {
    await new Promise((resolve) => setTimeout(resolve, ms))
    await route.continue()
  })

for (const family of families) {
  const dashboardFamily = family.paths.some((p) =>
    /^\/(account|dealer|workshop|mechanic|admin|post|onboarding)/.test(p)
  )
  test.describe(family.name, () => {
    test.beforeEach(async ({ context, baseURL }) => {
      await resetLimits()
      if (family.role !== "anon")
        await context.addCookies(await roleCookies(family.role, baseURL!))
    })

    for (const locale of locales)
      for (const path of family.paths) {
        const url = `/${locale}${path}`

        for (const mode of ["500", "404"] as const)
          test(`${mode} ${url}`, async ({ page, baseURL }) => {
            const errors = watch(page)
            await failApi(page, Number(mode) as 500 | 404, baseURL!)
            if (!dashboardFamily)
              await page
                .context()
                .addCookies([{ name: "test_fail", value: mode, url: baseURL }])
            await page.goto(url, { waitUntil: "load" })
            const retryBtn = page.getByRole("button", { name: retry[locale] })
            const heading = page.getByRole("heading", { level: 1 })
            // An error state, or the not-found page, shows within a retry cycle (the query client retries once after 1 s).
            // Pages without a data call (static copy, wizard shells) just stay up.
            await expect(retryBtn.or(heading).first()).toBeVisible({
              timeout: 15_000,
            })
            await page.waitForLoadState("networkidle")
            expect(errors, "thrown errors").toEqual([])
            expect(await blank(page), "page is blank").toBe(false)
            if (mode === "404" || (await retryBtn.count()) === 0) return
            // Retry brings the page back once the failure is gone.
            await page.unrouteAll()
            if (!dashboardFamily)
              await page.context().clearCookies({ name: "test_fail" })
            // The server-rendered button can be clicked a moment before hydration attaches its handler, so click again until it works.
            await expect(async () => {
              if ((await retryBtn.count()) > 0) await retryBtn.first().click()
              await expect(retryBtn).toHaveCount(0, { timeout: 3000 })
            }).toPass({ timeout: 20_000 })
            expect(errors, "errors after retry").toEqual([])
          })

        test(`offline ${url}`, async ({ page, context }) => {
          const errors = watch(page)
          await page.goto(url, { waitUntil: "networkidle" })
          // Lazy route chunks and hydration finish after the network goes quiet; going offline before that is a different test.
          await page.waitForTimeout(1500)
          const banner = page.getByText(offlineText[locale])
          await context.setOffline(true)
          await expect(banner).toBeVisible({ timeout: 10_000 })
          // A client navigation while offline ends in an error state or stays put, never a crash or a blank page.
          const side = page.locator(`aside a[href^='/${locale}/']`).first()
          const link =
            (await side.count()) > 0
              ? side
              : page.locator(`header nav a[href^='/${locale}/']`).first()
          if ((await link.count()) > 0) {
            await link.click().catch(() => undefined)
            await page.waitForTimeout(1500)
          }
          expect(errors, "thrown errors").toEqual([])
          expect(await blank(page), "page is blank").toBe(false)
          await context.setOffline(false)
          await expect(banner).toBeHidden()
        })

        test(`latency 2 s ${url}`, async ({ page, baseURL }) => {
          const errors = watch(page)
          await delayApi(page, 2000, baseURL!)
          if (!dashboardFamily)
            await page
              .context()
              .addCookies([
                { name: "test_latency", value: "2000", url: baseURL },
              ])
          await page.goto(url, { waitUntil: "load" })
          await expect(
            page.getByRole("heading", { level: 1 }).first()
          ).toBeVisible({ timeout: 20_000 })
          await page.waitForLoadState("networkidle", { timeout: 30_000 })
          expect(errors, "thrown errors").toEqual([])
          expect(await blank(page), "page is blank").toBe(false)
        })
      }
  })
}
