import { expect, test } from "@playwright/test"
import type {
  APIRequestContext,
  BrowserContext,
  Page,
  PlaywrightWorkerArgs,
} from "@playwright/test"

import { sessions } from "./routes"

// Edge data (14.6): odd but valid data shows without breaking the page. Runs on the empty-data server (port 3101), so
// the data it creates never reaches the other specs. A dealership without a cover is not possible: `coverUrl` is a
// required string in the schema.
const baseURL = "http://localhost:3101"
test.use({ baseURL })
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
}
let made: Created

const as = (
  playwright: Pick<PlaywrightWorkerArgs["playwright"], "request">,
  id: string
) =>
  playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: { cookie: `sy_session=${id}`, "x-mock-latency": "0" },
  })

const json = async <T>(res: Awaited<ReturnType<APIRequestContext["get"]>>) => {
  expect(res.ok(), `${res.url()} ${res.status()}`).toBe(true)
  return (await res.json()) as T
}

test.beforeAll(async ({ playwright }) => {
  test.setTimeout(120_000)
  const dealer = await as(playwright, sessions.dealer)
  const admin = await as(playwright, sessions.admin)
  const user = await as(playwright, sessions.user)
  const mechanic = await as(playwright, sessions.mechanic)
  const draft = async (
    title: string,
    media: Array<unknown>,
    showPhone: boolean
  ) => {
    const row = await json<{ id: string; slug: string }>(
      await dealer.post("/api/listings", {
        data: {
          title,
          price: 250000,
          cityId: "khartoum",
          media,
          contact: {
            phone: "+249955667788",
            whatsapp: null,
            showPhone,
            methods: showPhone ? ["call", "chat"] : ["chat"],
          },
          submit: false,
        },
      })
    )
    await json(
      await admin.patch(`/api/listings/${row.id}`, {
        data: { moderation: "approved" },
      })
    )
    return row
  }
  // No photos, and the phone hidden.
  const bare = await draft("Edge listing without photos", [], false)
  // Twenty photos.
  const media: Array<unknown> = []
  for (let i = 0; i < 20; i++)
    media.push(
      await json(
        await dealer.post("/api/uploads", {
          multipart: {
            file: { name: `p${i}.png`, mimeType: "image/png", buffer: png },
            width: "1",
            height: "1",
          },
        })
      )
    )
  const gallery = await draft("Edge listing with twenty photos", media, true)
  // A thread of 200 messages: 100 sent, and the mock answers each.
  const thread = await json<{ id: string }>(
    await user.post("/api/threads", {
      data: { subjectType: "listing", subjectId: gallery.id, body: "Hello 0" },
    })
  )
  for (let i = 1; i < 100; i++)
    await json(
      await user.post(`/api/threads/${thread.id}/messages`, {
        data: { body: `Message ${i}` },
      })
    )
  // A rating with no text.
  const biz = await json<{ id: string; slug: string }>(
    await dealer.get("/api/me/business")
  )
  await json(
    await user.post("/api/reviews", {
      data: { targetType: "dealership", targetId: biz.id, rating: 4 },
    })
  )
  // A mechanic with no portfolio.
  const items = await json<Array<{ id: string }>>(
    await mechanic.get("/api/me/portfolio")
  )
  for (const item of items)
    await json(await mechanic.delete(`/api/me/portfolio/${item.id}`))
  made = {
    bare: bare.slug,
    gallery: gallery.slug,
    dealer: biz.slug,
    thread: thread.id,
  }
})

test.afterAll(async ({ playwright }) => {
  const reset = await playwright.request.newContext({ baseURL })
  await reset.post("/api/mock/reset")
})

// Runs in the page: visible text that leaks a broken value, images without size, page wider than the viewport.
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

const mechanicSlug = async (
  playwright: Pick<PlaywrightWorkerArgs["playwright"], "request">
) => {
  const mechanic = await as(playwright, sessions.mechanic)
  return (await json<{ slug: string }>(await mechanic.get("/api/me/business")))
    .slug
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
    }) => {
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

    test(`mechanic with no portfolio ${locale} @${width}`, async ({
      page,
      playwright,
    }) => {
      await visit(page, `/mechanics/${await mechanicSlug(playwright)}`)
    })

    test(`thread with 200 messages ${locale} @${width}`, async ({
      page,
      context,
    }) => {
      await context.addCookies([
        { name: "sy_session", value: sessions.user, url: baseURL },
      ])
      const start = Date.now()
      await visit(page, `/account/messages?thread=${made.thread}`)
      expect(Date.now() - start, "opens in under 5 s").toBeLessThan(5000)
      // The newest message is in view without scrolling the page by hand.
      await expect(page.getByText("Message 99").first()).toBeVisible()
    })
  }
