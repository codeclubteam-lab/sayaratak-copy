import process from "node:process"

import { expect, test } from "@playwright/test"
import type {
  APIRequestContext,
  BrowserContext,
  Page,
  PlaywrightWorkerArgs,
} from "@playwright/test"
import { extraDefaults } from "@sayaratak/shared/schemas/listing-fields"

import {
  apiBase,
  resetDb,
  resetLimits,
  roleCookies,
  signInHeader,
} from "./auth"
import type { DemoRole } from "./auth"

// Edge data (14.6): odd but valid data shows without breaking the page. Runs on the empty-seeded postgres-test,
// then restores the full seed in `afterAll`. A dealership without a cover is not possible (`coverUrl` is required).
test.describe.configure({ mode: "serial" })

// A 1 x 1 PNG.
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
  "base64"
)

type Created = {
  bare: string
  gallery: string
  dealer: string
  thread: string
  mechanic: string
}
let made: Created

const as = async (
  playwright: Pick<PlaywrightWorkerArgs["playwright"], "request">,
  role: DemoRole,
  origin: string
) =>
  playwright.request.newContext({
    baseURL: apiBase,
    extraHTTPHeaders: {
      origin,
      cookie: await signInHeader(role, origin),
    },
  })

const json = async <T>(res: Awaited<ReturnType<APIRequestContext["get"]>>) => {
  expect(
    res.ok(),
    `${res.url()} ${res.status()} ${res.ok() ? "" : await res.text()}`
  ).toBe(true)
  return (await res.json()) as T
}

test.beforeAll(async ({ playwright, baseURL }) => {
  test.setTimeout(120_000)
  const origin = baseURL ?? "http://localhost:3100"
  if (process.env.STATES_EMPTY !== "1") await resetDb("empty")
  const dealer = await as(playwright, "dealer", origin)
  const admin = await as(playwright, "admin", origin)
  const user = await as(playwright, "user", origin)
  const mechanic = await as(playwright, "mechanic", origin)

  // No photos and phone hidden: kept as a draft (photosStepSchema requires 3 photos on submit) and viewed as admin.
  const bare = await json<{ id: string; slug: string }>(
    await dealer.post("/api/v1/listings", {
      data: {
        title: "Edge listing without photos",
        price: 250_000,
        cityId: "khartoum",
        media: [],
        contact: {
          phone: "+249955667788",
          whatsapp: null,
          showPhone: false,
          methods: ["chat"],
        },
        submit: false,
      },
    })
  )

  // Twenty photos on a submitted listing with full details.
  const media: Array<unknown> = []
  for (let i = 0; i < 20; i++)
    media.push(
      await json(
        await dealer.post("/api/v1/uploads", {
          multipart: {
            file: { name: `p${i}.png`, mimeType: "image/png", buffer: png },
          },
        })
      )
    )
  const gallery = await json<{ id: string; slug: string; moderation: string }>(
    await dealer.post("/api/v1/listings", {
      data: {
        ...extraDefaults,
        kind: "vehicle",
        vehicleType: "car",
        intent: "sale",
        title: "Edge listing with twenty photos",
        description:
          "Edge listing with twenty photos and phone visible for gallery layout check.",
        price: 250_000,
        negotiable: false,
        rentPeriod: null,
        condition: "used",
        makeId: "toyota",
        modelId: "toyota-corolla",
        makeOther: null,
        modelOther: null,
        year: 2015,
        mileageKm: 100_000,
        fuel: "petrol",
        transmission: "automatic",
        color: "white",
        engineCc: null,
        payloadTons: null,
        partNumber: null,
        partCategoryId: null,
        compatibleTypes: [],
        media,
        cityId: "khartoum",
        districtId: "khartoum-amarat",
        location: null,
        contact: {
          phone: "+249955667788",
          whatsapp: null,
          showPhone: true,
          methods: ["call", "chat"],
        },
        submit: true,
      },
    })
  )
  if (gallery.moderation === "pending")
    await json(await admin.post(`/api/v1/admin/listings/${gallery.id}/approve`))

  // A thread of 100 messages (messages limiter is 30/min, so clear between batches).
  const thread = await json<{ id: string }>(
    await user.post("/api/v1/threads", {
      data: { subjectType: "listing", subjectId: gallery.id, body: "Hello 0" },
    })
  )
  for (let i = 1; i < 100; i++) {
    if (i % 25 === 0) await resetLimits()
    await json(
      await user.post(`/api/v1/threads/${thread.id}/messages`, {
        data: { body: `Message ${i}` },
      })
    )
  }

  // A rating with no text.
  const biz = await json<{ id: string; slug: string }>(
    await dealer.get("/api/v1/me/business")
  )
  await json(
    await user.post("/api/v1/reviews", {
      data: { targetType: "dealership", targetId: biz.id, rating: 4 },
    })
  )

  // A mechanic with no portfolio.
  const mech = await json<{ slug: string }>(
    await mechanic.get("/api/v1/me/business")
  )
  const items = await json<Array<{ id: string }>>(
    await mechanic.get("/api/v1/me/portfolio")
  )
  for (const item of items)
    await json(await mechanic.delete(`/api/v1/me/portfolio/${item.id}`))

  await Promise.all([
    dealer.dispose(),
    admin.dispose(),
    user.dispose(),
    mechanic.dispose(),
  ])
  made = {
    bare: bare.slug,
    gallery: gallery.slug,
    dealer: biz.slug,
    thread: thread.id,
    mechanic: mech.slug,
  }
})

test.afterAll(async () => {
  await resetDb("reset")
})

// Runs in the page: visible text that leaks a broken value, page wider than the viewport.
const inspect = (width: number) => {
  const leaks: Array<string> = []
  const leak = /\bNaN\b|\bundefined\b|\[object Object\]|^[a-z_]+(\.[a-z_]+)+$/
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.trim() ?? ""
    const parent = node.parentElement
    if (!text || !parent?.checkVisibility()) continue
    if (parent.closest("script, style, noscript")) continue
    if (leak.test(text)) leaks.push(text)
  }
  return {
    leaks,
    overflow: document.documentElement.scrollWidth - width,
  }
}

for (const locale of ["ar", "en"] as const)
  for (const width of [390, 1280] as const) {
    const visit = async (
      page: Page,
      path: string,
      context?: BrowserContext
    ) => {
      const errors: Array<string> = []
      page.on("pageerror", (e) => errors.push(e.message))
      await page.setViewportSize({ width, height: 900 })
      void context
      await page.goto(`/${locale}${path}`, { waitUntil: "networkidle" })
      await expect(
        page.getByRole("heading", { level: 1 }).first()
      ).toBeVisible()
      const found = await page.evaluate(inspect, width)
      expect(errors, "thrown errors").toEqual([])
      expect(found.leaks, "leaked text").toEqual([])
      expect(found.overflow, "horizontal overflow").toBeLessThanOrEqual(0)
      return found
    }

    test(`listing with no photos and no phone ${locale} @${width}`, async ({
      page,
      context,
      baseURL,
    }) => {
      await context.addCookies(await roleCookies("admin", baseURL!))
      await visit(page, `/listing/${made.bare}`)
      // The seller hid the number, so no link to it (the footer has the site's own).
      await expect(page.locator("a[href='tel:+249955667788']")).toHaveCount(0)
      await expect(page.getByText("955667788")).toHaveCount(0)
    })

    test(`listing with 20 photos ${locale} @${width}`, async ({ page }) => {
      await visit(page, `/listing/${made.gallery}`)
      await expect(page.getByText(/\b20\b|٢٠/).first()).toBeVisible()
    })

    test(`dealership with a rating and no review text ${locale} @${width}`, async ({
      page,
    }) => {
      await visit(page, `/dealerships/${made.dealer}`)
    })

    test(`mechanic with no portfolio ${locale} @${width}`, async ({ page }) => {
      await visit(page, `/mechanics/${made.mechanic}`)
    })

    test(`thread with 100 messages ${locale} @${width}`, async ({
      page,
      context,
      baseURL,
    }) => {
      await context.addCookies(await roleCookies("user", baseURL!))
      const start = Date.now()
      await visit(page, `/account/messages?thread=${made.thread}`)
      expect(Date.now() - start, "opens in under 5 s").toBeLessThan(5000)
      // The newest message is in view without scrolling the page by hand.
      await expect(page.getByRole("log").getByText("Message 99")).toBeVisible()
    })
  }
