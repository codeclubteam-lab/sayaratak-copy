// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"

import { toListingInput } from "@/features/listings/wizard/to-listing-input"
import { wizardDefaults } from "@/features/listings/wizard/wizard-defaults"
import type { Review } from "@sayaratak/shared/schemas/review"
import { db, resetDb } from "@/mocks/db"
import { handleMock } from "@/mocks/router"
import { capPaid } from "@/mocks/search"

type Opts = { as?: string; body?: unknown; form?: FormData }
async function call(method: string, path: string, o: Opts = {}) {
  const headers: Record<string, string> = {}
  if (o.as) headers.cookie = `sy_session=${o.as}`
  if (o.body !== undefined) headers["content-type"] = "application/json"
  const res = await handleMock(
    new Request(`http://localhost/api${path}`, {
      method,
      headers,
      body:
        o.form ?? (o.body !== undefined ? JSON.stringify(o.body) : undefined),
    })
  )
  const raw = await res.clone().arrayBuffer()
  const body = res.headers.get("content-type")?.includes("json")
    ? await res.json()
    : null
  return { status: res.status, body, res, raw }
}
const photo = (id: string) => ({
  id,
  type: "image",
  url: `/mock/${id}-{w}.webp`,
  width: 1280,
  height: 853,
  placeholderColor: "#b8c4c0",
  posterUrl: null,
})
// What the post wizard sends for a car: every field, built by the client's own mapper.
const carValues = {
  ...wizardDefaults,
  kind: "vehicle",
  vehicleType: "car",
  intent: "sale",
  title: "Toyota Corolla 2018",
  description: "Clean car, one owner, full service history.",
  price: 12_000_000,
  makeId: "toyota",
  modelId: "toyota-corolla",
  year: 2018,
  fuel: "petrol",
  transmission: "automatic",
  mileageKm: 90_000,
  media: [..."abc"].map(photo),
  cityId: "khartoum",
  districtId: "khartoum-riyadh",
  phone: "+249912345678",
  methods: ["call", "chat"],
}
const car = toListingInput(carValues)
const file = (name: string, size: number, type = "image/png") =>
  new File([new Uint8Array(size)], name, { type })
const receipt = (itemType: string, itemId: string, extra = {}) => {
  const form = new FormData()
  form.set("itemType", itemType)
  form.set("itemId", itemId)
  form.set("transactionRef", "TX123456")
  form.set("payerName", "Omar Hassan")
  form.set("receipt", file("r.png", 100))
  for (const [k, v] of Object.entries(extra)) form.set(k, String(v))
  return form
}

beforeEach(() => {
  resetDb()
  // The seed's random draws decide how many listings u-1 owns; the tests below post as u-1 and need room under the free limit (3), so it keeps two.
  for (const row of db.listings.filter((l) => l.ownerUserId === "u-1").slice(2))
    row.ownerUserId = "u-omar"
})

describe("auth", () => {
  it("login sets the session cookie, bad password is 401, five misses throttle, a reset by code clears", async () => {
    const ok = await call("POST", "/auth/login", {
      body: { email: "dealer@demo.sy", password: "Demo1234" },
    })
    expect(ok.status).toBe(200)
    expect(ok.res.headers.get("set-cookie")).toContain("sy_session=u-dealer")
    for (let i = 0; i < 5; i++) {
      expect(
        (
          await call("POST", "/auth/login", {
            body: { email: "admin@demo.sy", password: "wrong1234" },
          })
        ).body.code
      ).toBe("invalid_credentials")
    }
    const locked = await call("POST", "/auth/login", {
      body: { email: "admin@demo.sy", password: "Demo1234" },
    })
    expect(locked.status).toBe(429)
    expect(locked.body.retryAfter).toBeGreaterThan(0)
    const sent = await call("POST", "/auth/forgot", {
      body: { email: "admin@demo.sy" },
    })
    const verified = await call("POST", "/auth/forgot/verify", {
      body: { email: "admin@demo.sy", code: sent.body.demoCode },
    })
    await call("POST", "/auth/reset", {
      body: { token: verified.body.token, password: "Newpass123" },
    })
    expect(
      (
        await call("POST", "/auth/login", {
          body: { email: "admin@demo.sy", password: "Newpass123" },
        })
      ).status
    ).toBe(200)
    // The token works once.
    expect(
      (
        await call("POST", "/auth/reset", {
          body: { token: verified.body.token, password: "Other1234" },
        })
      ).body.code
    ).toBe("invalid_token")
  })
  it("forgot answers alike for an unknown email and sends no code", async () => {
    const res = await call("POST", "/auth/forgot", {
      body: { email: "nobody@example.com" },
    })
    expect(res.status).toBe(200)
    expect(res.body.demoCode).toBeUndefined()
  })
  it("signup creates the account only after the emailed code, and refuses a taken email", async () => {
    const body = {
      fullName: "Sara Ali",
      email: "sara@example.com",
      password: "Passw0rd1",
    }
    const sent = await call("POST", "/auth/signup", { body })
    expect(sent.body.demoCode).toMatch(/^\d{6}$/)
    expect(db.users.some((u) => u.email === body.email)).toBe(false)
    const wrong = sent.body.demoCode === "000000" ? "111111" : "000000"
    expect(
      (
        await call("POST", "/auth/signup/verify", {
          body: { email: body.email, code: wrong },
        })
      ).body.code
    ).toBe("otp_invalid")
    const res = await call("POST", "/auth/signup/verify", {
      body: { email: body.email, code: sent.body.demoCode },
    })
    expect(res.status).toBe(201)
    expect(res.body.onboardingDone).toBe(false)
    expect(res.res.headers.get("set-cookie")).toContain("sy_session=")
    expect(db.users.find((u) => u.email === body.email)?.verifiedEmail).toBe(
      true
    )
    expect((await call("POST", "/auth/signup", { body })).body.code).toBe(
      "exists"
    )
  })
  it("a sign-up code is gone after five wrong tries", async () => {
    const email = "five@example.com"
    const sent = await call("POST", "/auth/signup", {
      body: { fullName: "Five Tries", email, password: "Passw0rd1" },
    })
    const wrong = sent.body.demoCode === "000000" ? "111111" : "000000"
    for (let i = 0; i < 5; i++)
      await call("POST", "/auth/signup/verify", {
        body: { email, code: wrong },
      })
    expect(
      (
        await call("POST", "/auth/signup/verify", {
          body: { email, code: sent.body.demoCode },
        })
      ).body.code
    ).toBe("code_expired")
  })
  it("onboarding creates the business record", async () => {
    const done = await call("POST", "/onboarding/complete", {
      as: "u-new",
      body: {
        role: "workshop",
        payload: {
          name: "Test Garage",
          cityId: "kassala",
          phone: "+249912000111",
        },
      },
    })
    expect(done.body).toMatchObject({ role: "workshop", onboardingDone: true })
    expect(db.workshops.some((w) => w.name.en === "Test Garage")).toBe(true)
  })
})

describe("listings", () => {
  it("search filters, ranks paid tiers first, paginates by 24 and returns facets", async () => {
    const res = await call(
      "GET",
      "/listings?intent=sale&type=car&fuel=petrol&sort=relevance"
    )
    expect(res.status).toBe(200)
    expect(res.body.items.length).toBeLessThanOrEqual(24)
    expect(
      res.body.items.every(
        (l: { fuelType?: string; fuel: string; vehicleType: string }) =>
          l.fuel === "petrol" && l.vehicleType === "car"
      )
    ).toBe(true)
    expect(res.body.facets.fuel.length).toBeGreaterThan(1) // fuel facet ignores the fuel filter itself
    expect(res.body.pageSize).toBe(24)
    const cheap = await call(
      "GET",
      "/listings?intent=sale&type=car&sort=price_asc&page=1"
    )
    const prices = cheap.body.items.map((l: { price: number }) => l.price)
    expect(prices).toEqual([...prices].sort((a, b) => a - b))
    const near = await call("GET", "/listings?lat=15.5&lng=32.56&radius=5")
    expect(
      near.body.items.every((l: { cityId: string }) =>
        ["khartoum", "bahri", "omdurman"].includes(l.cityId)
      )
    ).toBe(true)
  })
  it("caps featured listings per page: a first row of up to 4, then at most one leading each row", async () => {
    type Row = {
      promotions: { type: string; startsAt: string; endsAt: string }[]
    }
    const now = Date.now()
    const featured = (l: Row) =>
      l.promotions.some(
        (p) =>
          p.type === "featured" &&
          Date.parse(p.startsAt) <= now &&
          Date.parse(p.endsAt) >= now
      )
    const all = (await call("GET", "/listings?pageSize=500")).body
      .items as Row[]
    expect(all.filter(featured).length).toBeGreaterThan(9)
    const page = (await call("GET", "/listings")).body.items as Row[]
    const at = page.flatMap((l, i) => (featured(l) ? [i] : []))
    expect(at).toEqual([0, 1, 2, 3, 4, 8, 12, 16, 20])
  })
  it("Featured listings take turns: the order holds within an hour and changes between hours", () => {
    const featured = db.listings.filter((l) =>
      l.promotions.some(
        (p) =>
          p.type === "featured" &&
          Date.parse(p.startsAt) <= Date.now() &&
          Date.parse(p.endsAt) >= Date.now()
      )
    )
    expect(featured.length).toBeGreaterThan(9)
    const hour = 3_600_000
    const at = (now: number) => capPaid(featured, now).map((l) => l.id)
    const start = Math.floor(Date.now() / hour) * hour
    expect(at(start)).toEqual(at(start + hour - 1))
    expect(at(start)).not.toEqual(at(start + hour))
    // Over a day, more of them get a turn in the first row than any single hour shows.
    const firstRow = new Set(
      Array.from({ length: 24 }, (_, i) =>
        at(start + i * hour).slice(0, 4)
      ).flat()
    )
    expect(firstRow.size).toBeGreaterThan(8)
  })
  it("lets a featured listing jump the organic ones", async () => {
    const corollas = "/listings?make=toyota&model=toyota-corolla"
    const before = (await call("GET", corollas)).body.items as { id: string }[]
    const oldest = db.listings.find((l) => l.id === before.at(-1)!.id)!
    oldest.promotions.push({
      type: "featured",
      startsAt: new Date(Date.now() - 60_000).toISOString(),
      endsAt: new Date(Date.now() + 86_400_000).toISOString(),
    })
    const after = (await call("GET", corollas)).body.items as { id: string }[]
    expect(after[0]!.id).toBe(oldest.id)
  })
  it("a bump puts the listing back at the top of the newest, with no badge", async () => {
    const newest = "/listings?make=toyota&model=toyota-corolla&sort=newest"
    const before = (await call("GET", newest)).body.items as { id: string }[]
    const oldest = db.listings.find((l) => l.id === before.at(-1)!.id)!
    oldest.bumpedAt = new Date().toISOString()
    const after = (await call("GET", newest)).body.items as {
      id: string
      promotions: unknown[]
    }[]
    expect(after[0]!.id).toBe(oldest.id)
    expect(after[0]!.promotions).toEqual(oldest.promotions)
  })
  it("narrows by the step 7.9 filters: repeated keys are lists, flags are yes-only, features need all", async () => {
    const total = (q: string) =>
      call("GET", `/listings?pageSize=100&${q}`).then((r) => r.body)
    const one = await total("body=sedan")
    const two = await total("body=sedan&body=suv")
    expect(one.items.length).toBeGreaterThan(0)
    expect(two.total).toBeGreaterThan(one.total)
    for (const l of two.items) expect(["sedan", "suv"]).toContain(l.bodyType)
    const owners = await total("firstOwner=true")
    for (const l of owners.items) expect(l.previousOwners).toBe(0)
    const abs = (await total("features=abs")).total
    const absSun = await total("features=abs&features=sunroof")
    expect(absSun.total).toBeLessThanOrEqual(abs)
    for (const l of absSun.items)
      expect(l.features).toEqual(expect.arrayContaining(["abs", "sunroof"]))
    expect(
      (await total("seatsMin=7")).items.every(
        (l: { seats: number }) => l.seats >= 7
      )
    ).toBe(true)
    // the map pins use the same filters
    const pins = await call("GET", "/map?body=sedan&body=suv")
    expect(pins.status).toBe(200)
  })
  it("saves and returns every step 7.9 field, empty ones as null or []", async () => {
    const created = await call("POST", "/listings", {
      as: "u-1",
      body: {
        ...car,
        bodyType: "sedan",
        doors: 4,
        accidentFree: true,
        warranty: "dealer",
        warrantyMonths: 12,
        features: ["abs", "sunroof"],
        licenseValidUntil: "2027-03-15",
      },
    })
    expect(created.status).toBe(200)
    expect(created.body).toMatchObject({
      bodyType: "sedan",
      doors: 4,
      accidentFree: true,
      warranty: "dealer",
      warrantyMonths: 12,
      features: ["abs", "sunroof"],
      licenseValidUntil: "2027-03-15",
      seats: null,
      deposit: null,
      compatibleMakeIds: [],
      partNumber: null,
    })
    const patched = await call("PATCH", `/listings/${created.body.id}`, {
      as: "u-1",
      body: { seats: 5, features: ["abs"] },
    })
    expect(patched.body).toMatchObject({
      seats: 5,
      features: ["abs"],
      doors: 4,
    })
    const bad = await call("PATCH", `/listings/${created.body.id}`, {
      as: "u-1",
      body: { doors: 9 },
    })
    expect(bad.status).toBe(422)
  })
  it("creates a pending listing, enforces the free limit, hides it until approved", async () => {
    const created = await call("POST", "/listings", { as: "u-1", body: car })
    expect(created.status).toBe(200)
    expect(created.body.moderation).toBe("pending")
    expect((await call("GET", `/listings/${created.body.slug}`)).status).toBe(
      404
    )
    expect(
      (await call("GET", `/listings/${created.body.slug}`, { as: "u-1" }))
        .status
    ).toBe(200)
    await call("POST", "/listings", { as: "u-1", body: car })
    await call("POST", "/listings", { as: "u-1", body: car })
    const over = await call("POST", "/listings", { as: "u-1", body: car })
    expect(over.status).toBe(403)
    expect(over.body.code).toBe("limit_reached")
    expect(
      (await call("POST", "/listings", { as: "u-workshop", body: car })).status
    ).toBe(403)
  })
  it("a submitted listing has to pass the wizard's rules: 422 with the field keys; a draft may be incomplete", async () => {
    const bad = await call("POST", "/listings", {
      as: "u-1",
      body: toListingInput({ ...carValues, media: [photo("a")], year: null }),
    })
    expect(bad.status).toBe(422)
    expect(bad.body.fields).toMatchObject({
      media: "validation.media_min",
      year: "validation.required",
    })
    const draft = await call("POST", "/listings", {
      as: "u-1",
      body: { title: "Half done", price: 1000, cityId: "khartoum" },
    })
    expect(draft.status).toBe(200)
    expect(draft.body.moderation).toBe("draft")
    const edited = await call("PATCH", `/listings/${draft.body.id}`, {
      as: "u-1",
      body: toListingInput({ ...carValues, year: null }),
    })
    expect(edited.status).toBe(422)
    expect(edited.body.fields.year).toBe("validation.required")
  })
  it("a rejected listing is resubmitted with submit: pending again, reason cleared; at the limit it stays rejected", async () => {
    const row = db.listings.find(
      (l) => l.ownerUserId === "u-omar" && l.moderation === "rejected"
    )!
    const sub = db.subscriptions.find(
      (s) => s.userId === "u-omar" && s.status === "active"
    )!
    const { limit } = sub.usage
    sub.usage.limit = 1
    const blocked = await call("PATCH", `/listings/${row.id}`, {
      as: "u-omar",
      body: { submit: true },
    })
    expect(blocked.body.code).toBe("limit_reached")
    expect(row.moderation).toBe("rejected")
    sub.usage.limit = limit
    const sent = await call("PATCH", `/listings/${row.id}`, {
      as: "u-omar",
      body: { submit: true },
    })
    expect(sent.body).toMatchObject({
      moderation: "pending",
      rejectionReason: null,
    })
  })
  it("an edit that changes title, description, photos or type sends an approved listing back to review; price never does", async () => {
    const created = await call("POST", "/listings", { as: "u-1", body: car })
    const row = db.listings.find((l) => l.id === created.body.id)!
    const newPhoto = {
      id: "m-1",
      type: "image",
      url: "/x.webp",
      width: 4,
      height: 3,
      placeholderColor: "#ccc",
      posterUrl: null,
    }
    const edit = async (body: object) => {
      row.moderation = "approved"
      return (await call("PATCH", `/listings/${row.id}`, { as: "u-1", body }))
        .body.moderation
    }
    expect(await edit({ price: 1 })).toBe("approved")
    expect(await edit({ title: row.title })).toBe("approved")
    expect(await edit({ title: "Toyota Corolla 2019" })).toBe("pending")
    expect(await edit({ description: "New text" })).toBe("pending")
    expect(await edit({ media: [newPhoto] })).toBe("pending")
    expect(await edit({ vehicleType: "truck" })).toBe("pending")
  })
  it("an auto-approved dealer keeps an approved listing live after an edit", async () => {
    db.settings.autoApproveVerifiedDealers = true
    const row = db.listings.find(
      (l) => l.ownerUserId === "u-dealer" && l.moderation === "approved"
    )!
    const res = await call("PATCH", `/listings/${row.id}`, {
      as: "u-dealer",
      body: { title: "A new title for the listing" },
    })
    expect(res.status).toBe(200)
    expect(res.body.moderation).toBe("approved")
  })
  it("a verified dealer's new vehicle goes live on its inventory until the plan limit", async () => {
    db.settings.autoApproveVerifiedDealers = true
    db.dealerships.find((d) => d.ownerId === "u-dealer")!.verified = true
    const created = await call("POST", "/listings", {
      as: "u-dealer",
      body: car,
    })
    expect(created.body.moderation).toBe("approved")
    const inventory = await call(
      "GET",
      "/listings?seller=u-dealer&pageSize=100"
    )
    const ids = inventory.body.items.map((l: { id: string }) => l.id)
    expect(ids).toContain(created.body.id)
    const own = new Set(
      db.listings.filter((l) => l.ownerUserId === "u-dealer").map((l) => l.id)
    )
    expect(ids.every((id: string) => own.has(id))).toBe(true)
    const sub = db.subscriptions.find((s) => s.userId === "u-dealer")!
    sub.usage.limit = (
      await call("GET", "/me/subscription", { as: "u-dealer" })
    ).body.usage.used
    const over = await call("POST", "/listings", { as: "u-dealer", body: car })
    expect(over.status).toBe(403)
    expect(over.body.code).toBe("limit_reached")
  })
})

describe("directory", () => {
  it("filters dealerships and 404s an unknown slug", async () => {
    const res = await call("GET", "/dealerships?verified=true")
    expect(res.body.items.length).toBeGreaterThan(0)
    expect(res.body.items.every((d: { verified: boolean }) => d.verified)).toBe(
      true
    )
    expect((await call("GET", "/workshops/nope")).body.code).toBe("not_found")
    expect(
      (await call("GET", "/mechanics?available=true&minYears=5")).status
    ).toBe(200)
  })
  it("a workshop owner edits own services", async () => {
    const added = await call("POST", "/me/services", {
      as: "u-workshop",
      body: { name: "Wheel alignment", priceFrom: 40000 },
    })
    expect(added.status).toBe(200)
    expect(
      (await call("GET", "/me/services", { as: "u-workshop" })).body.some(
        (s: { id: string }) => s.id === added.body.id
      )
    ).toBe(true)
    expect((await call("GET", "/me/services", { as: "u-omar" })).status).toBe(
      403
    )
  })
  it("a mechanic on Basic adds portfolio photos up to 5", async () => {
    const sub = db.subscriptions.find(
      (s) => s.userId === "u-mechanic" && s.status === "active"
    )!
    sub.planId = "plan-mechanic-basic"
    const m = db.mechanics.find((r) => r.ownerId === "u-mechanic")!
    m.portfolio = []
    const add = async () => {
      const form = new FormData()
      form.set("file", file("a.png", 20))
      form.set("width", "100")
      form.set("height", "80")
      form.set("placeholderColor", "#112233")
      const imageId = (
        await call("POST", "/uploads", { as: "u-mechanic", form })
      ).body.id
      return call("POST", "/me/portfolio", {
        as: "u-mechanic",
        body: { imageId, caption: "Brake job" },
      })
    }
    const first = await add()
    expect(first.body).toMatchObject({ caption: "Brake job", width: 100 })
    for (let i = 0; i < 4; i++) expect((await add()).status).toBe(200)
    expect((await add()).status).toBe(403)
    expect(
      (
        await call("POST", "/me/portfolio", {
          as: "u-mechanic",
          body: { imageId: "nope", caption: "x" },
        })
      ).status
    ).toBe(403)
    sub.planId = "plan-mechanic-plus"
    expect((await add()).status).toBe(200)
    m.portfolio = []
    expect(
      (
        await call("POST", "/me/portfolio", {
          as: "u-mechanic",
          body: { imageId: "nope", caption: "x" },
        })
      ).status
    ).toBe(422)
  })
  it("sends no phone or WhatsApp number of a banned owner's business page", async () => {
    const kinds = [
      ["dealerships", db.dealerships[0]!, { phones: [], whatsapp: null }],
      ["workshops", db.workshops[0]!, { phone: "", whatsapp: null }],
      ["mechanics", db.mechanics[0]!, { phone: "", whatsapp: null }],
    ] as const
    for (const [path, row, empty] of kinds) {
      db.users.find((u) => u.id === row.ownerId)!.banned = true
      const { status, body } = await call("GET", `/${path}/${row.slug}`)
      expect(status).toBe(200)
      expect(body).toMatchObject({ unavailable: true, ...empty })
    }
  })
})

describe("reviews", () => {
  it("adds a review, recomputes the rating, refuses a second one", async () => {
    const before = db.dealerships[1]?.rating.count ?? 0
    const target = db.dealerships[1]
    const body = {
      targetType: "dealership",
      targetId: target?.id,
      rating: 5,
      body: "Very good dealer and fair price",
    }
    expect(
      (await call("POST", "/reviews", { as: "u-omar", body })).status
    ).toBe(200)
    expect(target?.rating.count).toBe(before + 1)
    expect(
      (await call("POST", "/reviews", { as: "u-omar", body })).body.code
    ).toBe("already_reviewed")
    expect((await call("POST", "/reviews", { body })).status).toBe(401)
  })
})

describe("reviews, owner side", () => {
  const owner = () =>
    db.users.find((u) => u.role === "dealership" && u.onboardingDone)!
  const biz = () => db.dealerships.find((d) => d.ownerId === owner().id)!
  const row = (id: string, status: Review["status"], replied = false) => ({
    id,
    targetType: "dealership" as const,
    targetId: biz().id,
    authorId: "u-omar",
    authorName: "Omar",
    rating: 4,
    body: "Good dealer, fair price",
    createdAt: new Date().toISOString(),
    status,
    reply: replied
      ? { body: "Thank you", createdAt: new Date().toISOString() }
      : undefined,
  })
  const ids = async (query: string, as?: string) =>
    (
      (
        await call(
          "GET",
          `/reviews?targetType=dealership&targetId=${biz().id}${query}`,
          { as }
        )
      ).body.items as Review[]
    )
      .map((r) => r.id)
      .filter((id) => id.startsWith("t-"))

  it("hidden and unanswered reviews are for the owner to ask for, nobody else", async () => {
    db.reviews.push(
      row("t-visible", "visible"),
      row("t-replied", "visible", true),
      row("t-hidden", "hidden")
    )
    expect((await ids("&pageSize=100")).sort()).toEqual([
      "t-replied",
      "t-visible",
    ])
    expect((await ids("&pageSize=100&includeHidden=true")).sort()).toEqual([
      "t-replied",
      "t-visible",
    ])
    expect(
      (await ids("&pageSize=100&includeHidden=true", owner().id)).sort()
    ).toEqual(["t-hidden", "t-replied", "t-visible"])
    expect(
      await ids("&pageSize=100&includeHidden=true&needsReply=true", owner().id)
    ).toEqual(["t-visible"])
  })

  it("a reply is saved and edited in place; a hidden review takes none", async () => {
    db.reviews.push(row("t-a", "visible"), row("t-h", "hidden"))
    const as = owner().id
    expect(
      (
        await call("POST", "/reviews/t-a/reply", {
          as,
          body: { body: "First" },
        })
      ).status
    ).toBe(200)
    const edited = await call("POST", "/reviews/t-a/reply", {
      as,
      body: { body: "Second" },
    })
    expect(edited.body.reply.body).toBe("Second")
    expect(
      (await call("POST", "/reviews/t-h/reply", { as, body: { body: "No" } }))
        .status
    ).toBe(409)
    expect(
      (
        await call("POST", "/reviews/t-a/reply", {
          as: "u-omar",
          body: { body: "Not mine" },
        })
      ).status
    ).toBe(403)
  })

  it("a report keeps the review public and puts it in the admin Flagged list", async () => {
    db.reviews.push(row("t-f", "visible"))
    const as = owner().id
    expect((await call("POST", "/reviews/t-f/flag", { as })).body.status).toBe(
      "flagged"
    )
    expect(await ids("&pageSize=100")).toContain("t-f")
    const admin = db.users.find((u) => u.role === "admin")!.id
    const flagged = await call(
      "GET",
      "/admin/reviews?status=flagged&pageSize=100",
      {
        as: admin,
      }
    )
    expect((flagged.body.items as Review[]).some((r) => r.id === "t-f")).toBe(
      true
    )
    expect(
      (await call("POST", "/reviews/t-f/flag", { as: "u-omar" })).status
    ).toBe(403)
  })
})

describe("saved", () => {
  it("favorites toggle and update stats; signed out is 401", async () => {
    const id = db.listings.find((l) => l.moderation === "approved")?.id ?? ""
    const before = db.listings.find((l) => l.id === id)?.stats.favorites ?? 0
    await call("POST", "/favorites", { as: "u-new", body: { listingId: id } })
    expect(
      (await call("GET", "/me/favorite-ids", { as: "u-new" })).body
    ).toEqual({ ids: [id] })
    expect(db.listings.find((l) => l.id === id)?.stats.favorites).toBe(
      before + 1
    )
    await call("DELETE", `/favorites/${id}`, { as: "u-new" })
    expect(
      (await call("GET", "/me/favorite-ids", { as: "u-new" })).body
    ).toEqual({ ids: [] })
    // The ids endpoint is public: signed out it is just empty.
    expect((await call("GET", "/me/favorite-ids")).body).toEqual({ ids: [] })
    expect((await call("GET", "/favorites")).status).toBe(401)
  })
  it("favorites list: newest save first, sorts, type filter, savedAt on every item", async () => {
    type Item = { id: string; price: number; savedAt: string; kind: string }
    const list = async (query = "") => {
      const { body } = await call("GET", `/favorites${query}`, { as: "u-omar" })
      return body as { items: Item[]; total: number; pageSize: number }
    }
    const recent = await list()
    expect(recent.total).toBe(
      db.favorites.filter((f) => f.userId === "u-omar").length
    )
    expect(recent.pageSize).toBe(24)
    const saved = recent.items.map((l) => l.savedAt)
    expect(saved).toEqual([...saved].sort().reverse())
    const asc = (await list("?sort=price_asc")).items.map((l) => l.price)
    expect(asc).toEqual([...asc].sort((a, b) => a - b))
    const desc = (await list("?sort=price_desc")).items.map((l) => l.price)
    expect(desc).toEqual([...desc].sort((a, b) => b - a))
    // A bad sort falls back to recent, a bad type to no filter.
    expect((await list("?sort=nope&type=nope")).items.map((l) => l.id)).toEqual(
      recent.items.map((l) => l.id)
    )
    const first = db.listings.find((l) => l.id === recent.items[0]!.id)!
    const type = first.kind === "part" ? "part" : first.vehicleType!
    const expected = db.favorites
      .filter((f) => f.userId === "u-omar")
      .map((f) => db.listings.find((l) => l.id === f.listingId)!)
      .filter((l) =>
        type === "part" ? l.kind === "part" : l.vehicleType === type
      )
    expect(expected.length).toBeGreaterThan(0)
    expect((await list(`?type=${type}`)).total).toBe(expected.length)
  })
  it("favorites list flags sold, rented, removed and blocked-seller listings as unavailable", async () => {
    const ids = (
      (await call("GET", "/me/favorite-ids", { as: "u-omar" })).body as {
        ids: string[]
      }
    ).ids
    const [sold, rented, removed, blocked, fine] = ids.map((id) =>
      db.listings.find((l) => l.id === id)!
    )
    for (const l of [sold!, rented!, removed!, blocked!, fine!]) {
      l.moderation = "approved"
      l.status = "available"
    }
    sold!.status = "sold"
    rented!.status = "rented"
    removed!.moderation = "removed"
    const owner = db.users.find((u) => u.id === blocked!.ownerUserId)!
    owner.banned = true
    const { body } = await call("GET", "/favorites", { as: "u-omar" })
    const flag = (id: string) =>
      (body as { items: { id: string; unavailable: boolean }[] }).items.find(
        (l) => l.id === id
      )?.unavailable
    expect([sold, rented, removed, blocked].map((l) => flag(l!.id))).toEqual([
      true,
      true,
      true,
      true,
    ])
    expect(flag(fine!.id)).toBe(false)
  })
  it("saved searches: create, mark seen", async () => {
    const created = await call("POST", "/saved-searches", {
      as: "u-new",
      body: { name: "Cars", params: { kind: "vehicle", type: "car" } },
    })
    expect(created.status).toBe(200)
    const seen = await call("PATCH", `/saved-searches/${created.body.id}`, {
      as: "u-new",
      body: { markSeen: true, alerts: false },
    })
    expect(seen.body).toMatchObject({ newCount: 0, alerts: false })
    expect(
      (
        await call("PATCH", `/saved-searches/${created.body.id}`, {
          as: "u-omar",
          body: {},
        })
      ).status
    ).toBe(404)
  })
})

describe("messaging and notifications", () => {
  it("starts a thread, notifies the seller, counts unread, marks read", async () => {
    const listing = db.listings.find(
      (l) => l.ownerUserId === "u-omar" && l.moderation === "approved"
    )
    const thread = await call("POST", "/threads", {
      as: "u-1",
      body: {
        subjectType: "listing",
        subjectId: listing?.id,
        body: "Is it still available?",
      },
    })
    expect(thread.status).toBe(200)
    const unreadBefore = (await call("GET", "/me/counts", { as: "u-omar" }))
      .body
    expect(unreadBefore.unreadMessages).toBeGreaterThan(0)
    expect(
      db.notifications.some(
        (n) => n.userId === "u-omar" && n.type === "message"
      )
    ).toBe(true)
    await call("POST", `/threads/${thread.body.id}/read`, { as: "u-omar" })
    expect(
      (await call("GET", "/threads", { as: "u-omar" })).body.find(
        (t: { id: string }) => t.id === thread.body.id
      ).unreadCount
    ).toBe(0)
    expect(
      (
        await call("GET", `/threads/${thread.body.id}/messages`, {
          as: "u-dealer",
        })
      ).status
    ).toBe(403)
    await call("POST", "/notifications/read", { as: "u-omar", body: {} })
    expect(
      (await call("GET", "/me/counts", { as: "u-omar" })).body
        .unreadNotifications
    ).toBe(0)
  })
})

describe("messaging demo reply", () => {
  afterEach(() => vi.unstubAllEnvs())
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
  const listing = () =>
    db.listings.find(
      (l) => l.ownerUserId === "u-omar" && l.moderation === "approved"
    )
  const messagesOf = (id: string) =>
    db.messages.filter((m) => m.threadId === id)

  it("answers a new thread once, from the owner, after the delay", async () => {
    vi.stubEnv("VITE_DEMO", "true")
    vi.stubEnv("MOCK_REPLY_MS", "30")
    const thread = await call("POST", "/threads", {
      as: "u-1",
      body: { subjectType: "listing", subjectId: listing()?.id, body: "Hi" },
    })
    expect(thread.body.subjectSlug).toBe(listing()?.slug)
    expect(messagesOf(thread.body.id)).toHaveLength(1)
    await wait(120)
    const [first, reply] = messagesOf(thread.body.id)
    expect(reply?.senderId).toBe("u-omar")
    expect(first?.senderId).toBe("u-1")
    // The owner has spoken now, so nothing more is scripted.
    await call("POST", `/threads/${thread.body.id}/messages`, {
      as: "u-1",
      body: { body: "And the price?" },
    })
    await wait(120)
    expect(messagesOf(thread.body.id)).toHaveLength(3)
  })

  it("stays silent when the demo is off, and in threads the other person already wrote in", async () => {
    vi.stubEnv("VITE_DEMO", "false")
    vi.stubEnv("MOCK_REPLY_MS", "30")
    const off = await call("POST", "/threads", {
      as: "u-1",
      body: { subjectType: "listing", subjectId: listing()?.id, body: "Hi" },
    })
    await wait(120)
    expect(messagesOf(off.body.id)).toHaveLength(1)

    vi.stubEnv("VITE_DEMO", "true")
    const seeded = db.threads.find((t) => t.participantIds.includes("u-omar"))
    const before = messagesOf(seeded?.id ?? "").length
    await call("POST", `/threads/${seeded?.id}/messages`, {
      as: "u-omar",
      body: { body: "Thanks" },
    })
    await wait(120)
    expect(messagesOf(seeded?.id ?? "")).toHaveLength(before + 1)
  })
})

describe("billing, promotions and payments", () => {
  it("spends featured credits on 7-day Featured: active at once, counted per period, refused when gone", async () => {
    const as = "u-dealer"
    const mine = db.listings.filter(
      (l) => l.ownerUserId === as && l.status === "available"
    )
    const credits = async () =>
      (await call("GET", "/me/subscription", { as })).body.credits
    expect(await credits()).toEqual({ total: 3, left: 3 })
    expect(
      (
        await call("POST", "/promotions", {
          as,
          body: { listingId: mine[0]!.id },
        })
      ).status
    ).toBe(422)
    for (const l of mine.slice(0, 3)) {
      const res = await call("POST", "/promotions", {
        as,
        body: { listingId: l.id, useCredit: true },
      })
      expect(res.body).toMatchObject({
        type: "featured",
        durationDays: 7,
        status: "active",
        source: "credit",
      })
    }
    expect(await credits()).toEqual({ total: 3, left: 0 })
    expect(
      (
        await call("POST", "/promotions", {
          as,
          body: { listingId: mine[3]!.id, useCredit: true },
        })
      ).body.code
    ).toBe("no_credits")
  })
  it("a receipt creates a pending payment; approval activates the plan and notifies", async () => {
    const paid = await call("POST", "/payments", {
      as: "u-1",
      form: receipt("plan", "plan-user-plus"),
    })
    expect(paid.status).toBe(200)
    expect(paid.body).toMatchObject({ status: "pending_review" })
    expect(paid.body.payerName).toBe("Omar Hassan")
    expect(
      (
        await call("POST", "/payments", {
          as: "u-1",
          form: receipt("plan", "plan-user-plus"),
        })
      ).body.code
    ).toBe("payment_pending")
    expect(
      (
        await call("POST", `/admin/payments/${paid.body.id}/approve`, {
          as: "u-omar",
        })
      ).status
    ).toBe(403)
    await call("POST", `/admin/payments/${paid.body.id}/approve`, {
      as: "u-admin",
    })
    const mine = (await call("GET", "/me/subscription", { as: "u-1" })).body
    expect(mine.subscription.planId).toBe("plan-user-plus")
    expect(mine.subscription.price).toBe(50_000)
    expect(mine.plan.id).toBe("plan-user-plus")
    expect(
      db.notifications.some(
        (n) => n.userId === "u-1" && n.type === "payment_approved"
      )
    ).toBe(true)
  })
  it("a paid plan picked in onboarding waits on the account until a receipt, comes back after a rejection, and Keep the free plan drops it", async () => {
    await call("POST", "/onboarding/complete", {
      as: "u-new",
      body: {
        role: "dealership",
        payload: { name: "Fresh Motors", planId: "plan-dealer-growth" },
      },
    })
    const me = async () => (await call("GET", "/me", { as: "u-new" })).body
    expect((await me()).chosenPlanId).toBe("plan-dealer-growth")
    const sub = async () =>
      (await call("GET", "/me/subscription", { as: "u-new" })).body
    expect((await sub()).reviewPlan).toBeNull()
    const paid = await call("POST", "/payments", {
      as: "u-new",
      form: receipt("plan", "plan-dealer-growth"),
    })
    expect((await me()).chosenPlanId).toBeUndefined()
    expect((await sub()).reviewPlan.id).toBe("plan-dealer-growth")
    await call("POST", `/admin/payments/${paid.body.id}/reject`, {
      as: "u-admin",
      body: { reason: "Blurry" },
    })
    expect((await me()).chosenPlanId).toBe("plan-dealer-growth")
    expect((await sub()).reviewPlan).toBeNull()
    const kept = await call("DELETE", "/me/chosen-plan", { as: "u-new" })
    expect(kept.body.chosenPlanId).toBeUndefined()
    expect((await me()).chosenPlanId).toBeUndefined()
  })

  it("a free plan pick leaves nothing waiting", async () => {
    await call("POST", "/onboarding/complete", {
      as: "u-new",
      body: {
        role: "dealership",
        payload: { name: "Fresh Motors", planId: "plan-dealer-starter" },
      },
    })
    expect(db.users.find((u) => u.id === "u-new")!.chosenPlanId).toBeUndefined()
  })

  it("a dealership's plan payment goes through the admin queue and raises its vehicle limit", async () => {
    await call("POST", "/onboarding/complete", {
      as: "u-new",
      body: { role: "dealership", payload: { name: "Fresh Motors" } },
    })
    const usage = async () =>
      (await call("GET", "/me/subscription", { as: "u-new" })).body.usage
    expect(await usage()).toMatchObject({ used: 0, limit: 10 })
    for (let i = 0; i < 10; i++)
      await call("POST", "/listings", { as: "u-new", body: car })
    const over = await call("POST", "/listings", { as: "u-new", body: car })
    expect(over.body.code).toBe("limit_reached")
    const paid = await call("POST", "/payments", {
      as: "u-new",
      form: receipt("plan", "plan-dealer-growth"),
    })
    const queue = await call("GET", "/admin/payments?status=pending_review", {
      as: "u-admin",
    })
    expect(
      queue.body.items.some((p: { id: string }) => p.id === paid.body.id)
    ).toBe(true)
    await call("POST", `/admin/payments/${paid.body.id}/approve`, {
      as: "u-admin",
    })
    expect((await usage()).limit).toBe(80)
    expect(
      (await call("POST", "/listings", { as: "u-new", body: car })).status
    ).toBe(200)
  })
  it("a workshop's plan payment goes through the admin queue and activates its plan", async () => {
    await call("POST", "/onboarding/complete", {
      as: "u-new",
      body: { role: "workshop", payload: { name: "Test Garage" } },
    })
    const sub = async () =>
      (await call("GET", "/me/subscription", { as: "u-new" })).body
    expect((await sub()).plan.id).toBe("plan-workshop-basic")
    // Basic caps services at 10 and photos at 1.
    const addService = async () =>
      (
        await call("POST", "/me/services", {
          as: "u-new",
          body: { name: "Oil change", priceFrom: 20000 },
        })
      ).status
    for (let i = 0; i < 10; i++) expect(await addService()).toBe(200)
    expect(await addService()).toBe(403)
    const upload = async () => {
      const form = new FormData()
      form.set("file", file("a.png", 20))
      form.set("width", "100")
      form.set("height", "80")
      form.set("placeholderColor", "#112233")
      return (await call("POST", "/uploads", { as: "u-new", form })).body.id
    }
    const photos = async (ids: string[]) =>
      (
        await call("PUT", "/me/business/images", {
          as: "u-new",
          body: { ids },
        })
      ).status
    const first = await upload()
    expect(await photos([first])).toBe(200)
    expect(await photos([first, await upload()])).toBe(403)
    expect(
      (
        await call("POST", "/payments", {
          as: "u-new",
          form: receipt("plan", "plan-dealer-growth"),
        })
      ).status
    ).toBe(404)
    const paid = await call("POST", "/payments", {
      as: "u-new",
      form: receipt("plan", "plan-workshop-plus"),
    })
    expect(paid.body).toMatchObject({ status: "pending_review" })
    expect((await sub()).reviewPlan.id).toBe("plan-workshop-plus")
    const queue = await call("GET", "/admin/payments?status=pending_review", {
      as: "u-admin",
    })
    expect(
      queue.body.items.some((p: { id: string }) => p.id === paid.body.id)
    ).toBe(true)
    await call("POST", `/admin/payments/${paid.body.id}/approve`, {
      as: "u-admin",
    })
    const after = await sub()
    expect(after.plan.id).toBe("plan-workshop-plus")
    expect(after.subscription.price).toBe(120_000)
    expect(after.reviewPlan).toBeNull()
    expect(await addService()).toBe(200)
    expect(await photos([first, await upload()])).toBe(200)
    expect(
      db.notifications.some(
        (n) => n.userId === "u-new" && n.type === "payment_approved"
      )
    ).toBe(true)
  })
  it("a mechanic's Plus payment goes through the admin queue and puts them at the top of search", async () => {
    const mechanic = db.mechanics.find((m) => m.ownerId === "u-mechanic")!
    const sub = async () =>
      (await call("GET", "/me/subscription", { as: "u-mechanic" })).body
    const top = async () =>
      (await call("GET", "/mechanics?sort=newest")).body.items[0].id
    expect((await sub()).plan.id).toBe("plan-mechanic-basic")
    expect(await top()).not.toBe(mechanic.id)
    expect(
      (
        await call("POST", "/payments", {
          as: "u-mechanic",
          form: receipt("plan", "plan-workshop-plus"),
        })
      ).status
    ).toBe(404)
    // The demo mechanic's Plus receipt is already waiting in the seed, so a second one is refused.
    expect(
      (
        await call("POST", "/payments", {
          as: "u-mechanic",
          form: receipt("plan", "plan-mechanic-plus"),
        })
      ).body.code
    ).toBe("payment_pending")
    const pending = db.payments.find(
      (p) =>
        p.userId === "u-mechanic" &&
        p.itemId === "plan-mechanic-plus" &&
        p.status === "pending_review"
    )!
    expect((await sub()).reviewPlan.id).toBe("plan-mechanic-plus")
    // Under review is not paid yet, so the order is unchanged.
    expect(await top()).not.toBe(mechanic.id)
    const queue = await call("GET", "/admin/payments?status=pending_review", {
      as: "u-admin",
    })
    expect(
      queue.body.items.some((p: { id: string }) => p.id === pending.id)
    ).toBe(true)
    await call("POST", `/admin/payments/${pending.id}/approve`, {
      as: "u-admin",
    })
    const after = await sub()
    expect(after.plan.id).toBe("plan-mechanic-plus")
    expect(after.subscription.price).toBe(60_000)
    expect(await top()).toBe(mechanic.id)
    expect(
      (await call("GET", "/mechanics?sort=experience")).body.items[0].id
    ).toBe(mechanic.id)
  })
  it("a payment needs the payer name", async () => {
    const res = await call("POST", "/payments", {
      as: "u-1",
      form: receipt("plan", "plan-user-plus", { payerName: "" }),
    })
    expect(res.status).toBe(422)
    expect(res.body.fields.payerName).toBe("validation.name_min")
  })
  it("a promotion starts unpaid, is paid through checkout, and runs once approved", async () => {
    const listing = db.listings.find(
      (l) =>
        l.ownerUserId === "u-omar" &&
        l.moderation === "approved" &&
        l.promotions.length === 0 &&
        !db.promotions.some((p) => p.listingId === l.id)
    )
    const made = await call("POST", "/promotions", {
      as: "u-omar",
      body: { listingId: listing?.id, priceId: "featured-7" },
    })
    expect(made.body.status).toBe("pending_payment")
    expect(made.body.durationDays).toBe(7)
    // Asking again returns the same unpaid promotion.
    const again = await call("POST", "/promotions", {
      as: "u-omar",
      body: { listingId: listing?.id, priceId: "featured-7" },
    })
    expect(again.body.id).toBe(made.body.id)
    const item = `promotion:${made.body.id}`
    const checkout = await call("GET", `/checkout?item=${item}`, {
      as: "u-omar",
    })
    expect(checkout.body).toMatchObject({
      itemType: "promotion",
      amount: 40_000,
      durationDays: 7,
      pendingPaymentId: null,
      bankak: { name: "Sayaratak", number: "1234567" },
    })
    const pay = await call("POST", "/payments", {
      as: "u-omar",
      form: receipt("promotion", made.body.id),
    })
    expect(pay.body.reference).toBe(checkout.body.reference)
    expect(
      (await call("GET", `/checkout?item=${item}`, { as: "u-omar" })).body
        .pendingPaymentId
    ).toBe(pay.body.id)
    const mine = (await call("GET", "/me/promotions", { as: "u-omar" })).body
    expect(
      mine.items.find((p: { id: string }) => p.id === made.body.id)
    ).toMatchObject({
      status: "pending_payment",
      paymentStatus: "pending_review",
      price: 40_000,
    })
    expect(
      (
        await call("POST", `/admin/payments/${pay.body.id}/reject`, {
          as: "u-admin",
          body: {},
        })
      ).status
    ).toBe(422)
    await call("POST", `/admin/payments/${pay.body.id}/approve`, {
      as: "u-admin",
    })
    expect(listing?.promotions.map((p) => p.type)).toContain("featured")
    const running = db.promotions.find((p) => p.id === made.body.id)
    expect(running?.status).toBe("active")
    expect(running?.endsAt).toBeTruthy()
    // Ending it takes it off the listing.
    await call("POST", `/admin/promotions/${made.body.id}/end`, {
      as: "u-admin",
    })
    expect(listing?.promotions.map((p) => p.type)).not.toContain("featured")
    expect(db.promotions.find((p) => p.id === made.body.id)?.status).toBe(
      "ended"
    )
  })
  it("an admin grant starts at once and is free", async () => {
    const listing = db.listings.find(
      (l) => l.moderation === "approved" && l.promotions.length === 0
    )
    const grant = await call("POST", "/admin/promotions/grant", {
      as: "u-admin",
      body: { listingId: listing?.id, type: "featured", days: 5 },
    })
    expect(grant.body).toMatchObject({
      status: "active",
      source: "admin_grant",
      durationDays: 5,
      price: 0,
      paymentStatus: "none",
    })
    expect(listing?.promotions.map((p) => p.type)).toContain("featured")
  })
  it("refuses a second bump within 24 hours of the last one", async () => {
    const listing = db.listings.find(
      (l) => l.ownerUserId === "u-omar" && l.moderation === "approved"
    )!
    const bump = () =>
      call("POST", "/promotions", {
        as: "u-omar",
        body: { listingId: listing.id, priceId: "bump" },
      })
    listing.bumpedAt = new Date(Date.now() - 23 * 3_600_000).toISOString()
    expect((await bump()).body.code).toBe("bump_wait")
    listing.bumpedAt = new Date(Date.now() - 25 * 3_600_000).toISOString()
    expect((await bump()).body).toMatchObject({ type: "bump" })
  })
  it("a paid bump is done once approved: the listing is bumped, carries no promotion, and the bump reads ended", async () => {
    const listing = db.listings.find(
      (l) =>
        l.ownerUserId === "u-omar" &&
        l.moderation === "approved" &&
        l.promotions.length === 0 &&
        !db.promotions.some((p) => p.listingId === l.id)
    )!
    const made = await call("POST", "/promotions", {
      as: "u-omar",
      body: { listingId: listing.id, priceId: "bump" },
    })
    expect(made.body).toMatchObject({ type: "bump", durationDays: 0 })
    const pay = await call("POST", "/payments", {
      as: "u-omar",
      form: receipt("promotion", made.body.id),
    })
    expect(pay.body.amount).toBe(5_000)
    await call("POST", `/admin/payments/${pay.body.id}/approve`, {
      as: "u-admin",
    })
    expect(listing.bumpedAt).toBeTruthy()
    expect(listing.promotions).toEqual([])
    expect(db.promotions.find((p) => p.id === made.body.id)?.status).toBe(
      "ended"
    )
  })
  it("plans hide the individual ones when individual subscriptions are off", async () => {
    expect((await call("GET", "/plans?audience=user")).body.length).toBe(2)
    db.settings.individualSubscriptionsEnabled = false
    expect((await call("GET", "/plans?audience=user")).body).toEqual([])
    const all = (await call("GET", "/plans")).body
    expect(all.some((p: { audience: string }) => p.audience === "user")).toBe(
      false
    )
    const usage = (await call("GET", "/me/subscription", { as: "u-1" })).body
      .usage
    expect(usage.limit).toBeNull()
  })
  it("the first plan of every audience is free", () => {
    for (const audience of ["user", "dealership", "workshop", "mechanic"]) {
      const first = db.plans
        .filter((p) => p.audience === audience)
        .sort((a, b) => a.sortOrder - b.sortOrder)[0]
      expect(first?.price).toBe(0)
    }
  })
  it("the payments page carries the summary strip and the payer", async () => {
    const page = (await call("GET", "/admin/payments", { as: "u-admin" })).body
    expect(page.summary.pendingCount).toBe(
      db.payments.filter((p) => p.status === "pending_review").length
    )
    expect(page.items[0].user.name).toBeTruthy()
    expect(page.summary.approvedThisMonth).toBeGreaterThanOrEqual(0)
  })
})

describe("trust, content, map, uploads, analytics", () => {
  it("reports need details for 'other'", async () => {
    const listingId = db.listings[0]?.id
    expect(
      (
        await call("POST", "/reports", {
          as: "u-1",
          body: { listingId, reason: "scam" },
        })
      ).status
    ).toBe(200)
    expect(
      (
        await call("POST", "/reports", {
          as: "u-1",
          body: { listingId, reason: "other" },
        })
      ).body.fields.details
    ).toBe("validation.details_required")
  })
  it("pages, banners, 404", async () => {
    expect((await call("GET", "/pages/about")).body.title.en).toBe("About us")
    expect((await call("GET", "/pages/unknown")).status).toBe(404)
    expect(
      (await call("GET", "/banners?placement=home_top")).body
    ).toHaveLength(4)
  })
  it("contact stores the message, a bad one is a 422 with key errors", async () => {
    const body = {
      name: "Omar",
      contact: "a@b.co",
      subject: "business",
      message: "Do you list dealerships?",
    }
    expect((await call("POST", "/contact", { body })).status).toBe(200)
    expect(db.contacts[0]).toMatchObject(body)
    const bad = await call("POST", "/contact", {
      body: { ...body, contact: "nope", message: "short" },
    })
    expect(bad.status).toBe(422)
    expect(bad.body.fields).toMatchObject({
      contact: "validation.identifier",
      message: "validation.message_min",
    })
    expect(db.contacts).toHaveLength(1)
  })
  it("map is capped at 300 points and respects the bbox", async () => {
    // `layers` repeats like every array param.
    const all = await call(
      "GET",
      "/map?layers=vehicles&layers=dealerships&layers=workshops&layers=mechanics"
    )
    expect(all.body.items.length).toBeLessThanOrEqual(300)
    expect(all.body.total).toBeGreaterThanOrEqual(all.body.items.length)
    const none = await call("GET", "/map?layers=vehicles&bbox=0,0,1,1")
    expect(none.body).toEqual({ items: [], total: 0 })
    const dealers = await call("GET", "/map?layers=dealerships")
    expect(
      dealers.body.items.every((p: { kind: string }) => p.kind === "dealership")
    ).toBe(true)
  })
  it("the vehicle layer rounds positions for everyone but the owner", async () => {
    const mine = db.listings.find(
      (l) =>
        l.ownerUserId === "u-omar" && l.moderation === "approved" && l.location
    )
    const point = (await call("GET", "/map?layers=vehicles")).body.items.find(
      (p: { id: string }) => p.id === mine?.id
    )
    const round = (n: number) => Math.round(n * 100) / 100
    expect(point.location).toEqual({
      lat: round(mine?.location?.lat ?? 0),
      lng: round(mine?.location?.lng ?? 0),
    })
  })
  it("uploads need a signed-in account and a file (uploadFormSchema)", async () => {
    const form = new FormData()
    form.set("file", file("a.png", 20))
    const out = await call("POST", "/uploads", { form })
    expect(out.status).toBe(401)
    expect(out.body.code).toBe("unauthenticated")
    const empty = await call("POST", "/uploads", {
      as: "u-omar",
      form: new FormData(),
    })
    expect(empty.body.fields.file).toBe("validation.required")
  })
  it("uploads return a Media, serve the file and refuse files over the limits", async () => {
    const form = new FormData()
    form.set("file", file("a.png", 20))
    form.set("width", "100")
    form.set("height", "80")
    form.set("placeholderColor", "#112233")
    const up = await call("POST", "/uploads", { as: "u-omar", form })
    expect(up.status).toBe(201)
    expect(up.body).toMatchObject({
      type: "image",
      width: 100,
      height: 80,
      placeholderColor: "#112233",
      posterUrl: null,
    })
    expect(up.body.url).toContain("{w}")
    const got = await call(
      "GET",
      up.body.url.replace("/api", "").replace("{w}", "640")
    )
    expect(got.raw.byteLength).toBe(20)
    const big = new FormData()
    big.set("file", file("b.png", 5 * 1024 * 1024 + 1))
    expect(
      (await call("POST", "/uploads", { as: "u-omar", form: big })).body.fields
        .file
    ).toBe("validation.file_size_5mb")
    const pdf = new FormData()
    pdf.set("file", file("c.pdf", 10, "application/pdf"))
    expect(
      (await call("POST", "/uploads", { as: "u-omar", form: pdf })).body.fields
        .file
    ).toBe("validation.image_type")
    const svg = new FormData()
    svg.set("file", file("d.svg", 10, "image/svg+xml"))
    expect(
      (await call("POST", "/uploads", { as: "u-omar", form: svg })).body.fields
        .file
    ).toBe("validation.image_type")
  })
  it("a video upload stores its poster and allows 30 MB", async () => {
    const form = new FormData()
    form.set("file", file("v.mp4", 6 * 1024 * 1024, "video/mp4"))
    form.set("poster", file("p.webp", 10, "image/webp"))
    const up = await call("POST", "/uploads", { as: "u-omar", form })
    expect(up.body.type).toBe("video")
    expect(up.body.posterUrl).toContain("{w}")
    const poster = await call(
      "GET",
      up.body.posterUrl.replace("/api", "").replace("{w}", "640")
    )
    expect(poster.raw.byteLength).toBe(10)
    const big = new FormData()
    big.set("file", file("w.mp4", 30 * 1024 * 1024 + 1, "video/mp4"))
    expect(
      (await call("POST", "/uploads", { as: "u-omar", form: big })).body.fields
        .file
    ).toBe("validation.video_size")
  })
  it("events raise listing stats and the daily series", async () => {
    const listing = db.listings.find(
      (l) => l.ownerUserId === "u-omar" && l.moderation === "approved"
    )
    const before = listing?.stats.views ?? 0
    await call("POST", "/events", {
      body: { type: "view", targetId: listing?.id },
    })
    expect(listing?.stats.views).toBe(before + 1)
    const a = await call("GET", "/me/analytics?range=7d", { as: "u-omar" })
    expect(a.body.daily).toHaveLength(7)
    expect(a.body.totals.views).toBeGreaterThan(0)
    expect(a.body.previous.views).toBeGreaterThanOrEqual(0)
    // Only dealerships get a top-listings table.
    expect(a.body.topListings).toEqual([])
    const dealer = await call("GET", "/me/analytics?range=30d", {
      as: "u-dealer",
    })
    expect(dealer.body.topListings.length).toBeGreaterThan(0)
    expect(dealer.body.topListings.length).toBeLessThanOrEqual(10)
  })
  it("analytics totals count today and add up to the daily series", async () => {
    const listing = db.listings.find(
      (l) => l.ownerUserId === "u-omar" && l.moderation === "approved"
    )
    for (const type of ["view", "view", "phone_click", "whatsapp_click"])
      await call("POST", "/events", { body: { type, targetId: listing?.id } })
    for (const range of ["7d", "30d", "90d"]) {
      const { body } = await call("GET", `/me/analytics?range=${range}`, {
        as: "u-omar",
      })
      const sum = (key: string) =>
        body.daily.reduce(
          (n: number, d: Record<string, number>) => n + d[key]!,
          0
        )
      expect(body.totals.views).toBe(sum("views"))
      expect(body.totals.calls).toBe(sum("calls"))
      expect(body.totals.whatsapp).toBe(sum("whatsapp"))
      expect(body.totals.messages).toBe(sum("messages"))
    }
    const day = new Date().toISOString().slice(0, 10)
    const today = (
      await call("GET", "/me/analytics?range=7d", { as: "u-omar" })
    ).body.daily.find((d: { date: string }) => d.date === day)
    expect(today).toMatchObject({ views: expect.any(Number) })
    expect(today.views).toBeGreaterThanOrEqual(2)
  })
})

describe("admin", () => {
  it("a ban needs a reason; 7 days lifts itself on the first request after its end, permanent stays", async () => {
    const login = () =>
      call("POST", "/auth/login", {
        body: { email: "user@demo.sy", password: "Demo1234" },
      })
    expect(
      (
        await call("POST", "/admin/users/u-omar/ban", {
          as: "u-admin",
          body: { reason: " ", duration: "7d" },
        })
      ).status
    ).toBe(422)
    const banned = await call("POST", "/admin/users/u-omar/ban", {
      as: "u-admin",
      body: { reason: "Spam", duration: "7d" },
    })
    expect(banned.body).toMatchObject({ banned: true, bannedReason: "Spam" })
    const until = Date.parse(banned.body.bannedUntil)
    expect(Math.round((until - Date.now()) / 86_400_000)).toBe(7)
    expect((await login()).body.code).toBe("banned")
    vi.useFakeTimers({ now: until + 1000, toFake: ["Date"] })
    try {
      expect((await login()).status).toBe(200)
      expect(db.users.find((u) => u.id === "u-omar")).toMatchObject({
        banned: false,
        bannedUntil: undefined,
      })
    } finally {
      vi.useRealTimers()
    }
    const forever = await call("POST", "/admin/users/u-omar/ban", {
      as: "u-admin",
      body: { reason: "Fraud", duration: "permanent" },
    })
    expect(forever.body.bannedUntil).toBeUndefined()
    expect((await login()).body.code).toBe("banned")
  })

  it("filters all listings by owner, for the seller panel's counts", async () => {
    const page = await call(
      "GET",
      "/admin/listings?ownerId=u-omar&moderation=approved&pageSize=1",
      { as: "u-admin" }
    )
    const expected = db.listings.filter(
      (l) => l.ownerUserId === "u-omar" && l.moderation === "approved"
    ).length
    expect(expected).toBeGreaterThan(0)
    expect(page.body.total).toBe(expected)
    expect(page.body.items).toHaveLength(1)
  })

  it("approving a listing notifies the owner and matches saved searches; non-admins are refused", async () => {
    const created = await call("POST", "/listings", { as: "u-1", body: car })
    const alertsBefore =
      db.savedSearches.find((s) => s.id === "ss-1")?.newCount ?? 0
    expect(
      (
        await call("POST", `/admin/listings/${created.body.id}/approve`, {
          as: "u-omar",
        })
      ).status
    ).toBe(403)
    await call("POST", `/admin/listings/${created.body.id}/approve`, {
      as: "u-admin",
    })
    expect(
      db.notifications.some(
        (n) => n.userId === "u-1" && n.type === "listing_approved"
      )
    ).toBe(true)
    expect(db.savedSearches.find((s) => s.id === "ss-1")?.newCount).toBe(
      alertsBefore + 1
    )
    expect(
      db.notifications.some(
        (n) => n.userId === "u-omar" && n.type === "saved_search_match"
      )
    ).toBe(true)
    const rejected = await call(
      "POST",
      `/admin/listings/${created.body.id}/reject`,
      { as: "u-admin", body: { reason: "Blurry photos" } }
    )
    expect(rejected.body).toMatchObject({
      moderation: "rejected",
      rejectionReason: "Blurry photos",
    })
  })
  it("a notification is skipped when its switch is off, and links to the recipient's own page", async () => {
    const created = await call("POST", "/listings", { as: "u-1", body: car })
    const id = created.body.id
    const mine = (userId: string, type: string) =>
      db.notifications.filter((n) => n.userId === userId && n.type === type)
    const patched = await call("PATCH", "/me/notification-prefs", {
      as: "u-1",
      body: { updates: false },
    })
    expect(patched.body).toMatchObject({ updates: false, messages: true })
    await call("POST", `/admin/listings/${id}/approve`, { as: "u-admin" })
    expect(mine("u-1", "listing_approved")).toHaveLength(0)
    await call("PATCH", "/me/notification-prefs", {
      as: "u-1",
      body: { updates: true },
    })
    await call("POST", `/admin/listings/${id}/reject`, {
      as: "u-admin",
      body: { reason: "Blurry photos" },
    })
    // The buyer's page is "listings"; the dealer's is "inventory".
    expect(mine("u-1", "listing_rejected")[0]?.href).toBe("/account/listings")
    const dealerListing = db.listings.find(
      (l) => l.ownerUserId === "u-dealer" && l.moderation === "approved"
    )!
    await call("POST", `/admin/listings/${dealerListing.id}/reject`, {
      as: "u-admin",
      body: { reason: "Blurry photos" },
    })
    expect(mine("u-dealer", "listing_rejected")[0]?.href).toBe(
      "/dealer/inventory"
    )
  })
  it("a broadcast respects announcements; new messages link to the thread in the role's inbox", async () => {
    const owner = db.users.find(
      (u) =>
        (u.role === "workshop" || u.role === "mechanic") &&
        db.threads.some((t) => t.participantIds.includes(u.id))
    )!
    const thread = db.threads.find((t) => t.participantIds.includes(owner.id))!
    await call("PATCH", "/me/notification-prefs", {
      as: owner.id,
      body: { announcements: false },
    })
    const hi = await call("POST", "/admin/broadcasts", {
      as: "u-admin",
      body: {
        roles: [owner.role],
        verifiedOnly: false,
        title: { ar: "مرحبا", en: "Hi all" },
        body: { ar: "أهلا", en: "Welcome" },
      },
    })
    // The bells ring a moment after Send, as the api's job does.
    await vi.waitFor(
      () =>
        expect(db.broadcasts.find((b) => b.id === hi.body.id)?.status).toBe(
          "sent"
        ),
      { timeout: 4000 }
    )
    expect(
      db.notifications.filter(
        (n) => n.userId === owner.id && n.title.en === "Hi all"
      )
    ).toHaveLength(0)
    const other = thread.participantIds.find((p) => p !== owner.id)!
    await call("POST", `/threads/${thread.id}/messages`, {
      as: other,
      body: { body: "Hello" },
    })
    const inbox = owner.role === "workshop" ? "workshop" : "mechanic"
    expect(
      db.notifications.find(
        (n) => n.userId === owner.id && n.type === "message"
      )?.href
    ).toBe(`/${inbox}/inquiries?thread=${thread.id}`)
  })
  it("search returns at most five hits per group; stats and counts add the admin extras", async () => {
    const s = await call("GET", "/admin/search?q=a", { as: "u-admin" })
    for (const group of Object.values(
      z.record(z.string(), z.array(z.unknown())).parse(s.body)
    ))
      expect(group.length).toBeLessThanOrEqual(5)
    expect(
      (await call("GET", "/me/counts", { as: "u-admin" })).body.pendingListings
    ).toBeGreaterThan(0)
    const stats = (
      await call("GET", "/admin/stats?range=7d", { as: "u-admin" })
    ).body
    expect(stats.totals.users).toBe(db.users.length)
    expect(stats.series.newListings).toHaveLength(7)
    expect(stats.series.revenue).toHaveLength(7)
    // The feed is newest first, at most ten, and each row links to its screen with the item selected (a pending listing opens in the review queue with `?listing=`).
    const feed = (await call("GET", "/admin/activity", { as: "u-admin" })).body
      .items
    expect(feed.length).toBeLessThanOrEqual(10)
    expect(
      feed.every((i: { href: string }) => /\?(id|listing)=/.test(i.href))
    ).toBe(true)
  })
  it("taxonomy rows in use cannot be deleted; broadcasts notify the audience", async () => {
    expect(
      (
        await call("DELETE", "/admin/taxonomy/cities/khartoum", {
          as: "u-admin",
        })
      ).body.code
    ).toBe("in_use")
    const created = await call("POST", "/admin/taxonomy/cities", {
      as: "u-admin",
      body: {
        countryId: "sd",
        name: { ar: "دنقلا", en: "Dongola" },
        center: { lat: 19.17, lng: 30.48 },
      },
    })
    expect(created.status).toBe(200)
    expect(
      (
        await call("DELETE", "/admin/taxonomy/cities/dongola", {
          as: "u-admin",
        })
      ).status
    ).toBe(200)
    const est = await call("GET", "/admin/broadcasts/estimate?roles=mechanic", {
      as: "u-admin",
    })
    const sent = await call("POST", "/admin/broadcasts", {
      as: "u-admin",
      body: {
        roles: ["mechanic"],
        verifiedOnly: false,
        title: { ar: "مرحبا", en: "Hello" },
        body: { ar: "أهلا", en: "Welcome" },
      },
    })
    expect(sent.status).toBe(200)
    // Queued at once, nobody rung yet.
    expect(sent.body).toMatchObject({ status: "queued", recipients: 0 })
    expect(db.notifications.some((n) => n.title.en === "Hello")).toBe(false)
    await vi.waitFor(
      () =>
        expect(db.broadcasts.find((b) => b.id === sent.body.id)).toMatchObject({
          status: "sent",
          recipients: est.body.count,
        }),
      { timeout: 4000 }
    )
    expect(
      db.notifications.some(
        (n) => n.userId === "u-mechanic" && n.type === "broadcast"
      )
    ).toBe(true)
  })
})

describe("verification, owner side", () => {
  const send = (as: string, docs: [string, File][], note?: string) => {
    const form = new FormData()
    for (const [label, f] of docs) {
      form.append("label", label)
      form.append("file", f)
    }
    if (note) form.set("note", note)
    return call("POST", "/me/verification", { as, form })
  }
  const dealerBiz = () => db.dealerships.find((d) => d.ownerId === "u-dealer")!
  beforeEach(() => {
    db.verifications = db.verifications.filter((v) => v.ownerId !== "u-dealer")
    dealerBiz().verified = false
  })

  it("stores the files, lands in the admin queue and approval turns the badge on", async () => {
    const sent = await send(
      "u-dealer",
      [
        ["commercial_registration", file("cr.png", 20)],
        ["shop_photo", file("shop.png", 30)],
      ],
      "Please check"
    )
    expect(sent.status).toBe(200)
    expect(sent.body).toMatchObject({
      status: "pending",
      targetType: "dealership",
      targetId: dealerBiz().id,
      note: "Please check",
    })
    expect(sent.body.documents.map((d: { label: string }) => d.label)).toEqual([
      "commercial_registration",
      "shop_photo",
    ])
    const doc = await call(
      "GET",
      sent.body.documents[0].url.replace("/api", "")
    )
    expect(doc.raw.byteLength).toBe(20)
    expect(
      (await call("GET", "/me/verification", { as: "u-dealer" })).body.id
    ).toBe(sent.body.id)
    const queue = await call("GET", "/admin/verifications?status=pending", {
      as: "u-admin",
    })
    expect(
      queue.body.items.some((v: { id: string }) => v.id === sent.body.id)
    ).toBe(true)
    await call("POST", `/admin/verifications/${sent.body.id}/approve`, {
      as: "u-admin",
    })
    expect(dealerBiz().verified).toBe(true)
    expect(
      db.notifications.some(
        (n) => n.userId === "u-dealer" && n.type === "verification_result"
      )
    ).toBe(true)
  })

  it("a dealership made through onboarding gets the public badge after approval", async () => {
    await call("POST", "/onboarding/complete", {
      as: "u-new",
      body: { role: "dealership", payload: { name: "Fresh Motors" } },
    })
    const slug = db.dealerships.find((d) => d.ownerId === "u-new")!.slug
    const badge = async () =>
      (await call("GET", `/dealerships/${slug}`)).body.verified
    expect(await badge()).toBe(false)
    const sent = await send("u-new", [
      ["commercial_registration", file("cr.png", 20)],
      ["shop_photo", file("shop.png", 30)],
    ])
    expect(sent.body).toMatchObject({
      status: "pending",
      targetType: "dealership",
    })
    await call("POST", `/admin/verifications/${sent.body.id}/approve`, {
      as: "u-admin",
    })
    expect(await badge()).toBe(true)
    expect(
      (await call("GET", "/me/verification", { as: "u-new" })).body.status
    ).toBe("approved")
  })

  it("the demo workshop starts unverified and gets the public badge after approval", async () => {
    const shop = db.workshops.find((w) => w.ownerId === "u-workshop")!
    const badge = async () =>
      (await call("GET", `/workshops/${shop.slug}`)).body.verified
    expect(await badge()).toBe(false)
    expect(
      (await call("GET", "/me/verification", { as: "u-workshop" })).body
    ).toBeNull()
    const sent = await send("u-workshop", [
      ["workshop_license", file("license.png", 20)],
      ["shop_photo", file("shop.png", 30)],
    ])
    expect(sent.body).toMatchObject({
      status: "pending",
      targetType: "workshop",
      targetId: shop.id,
    })
    await call("POST", `/admin/verifications/${sent.body.id}/approve`, {
      as: "u-admin",
    })
    expect(await badge()).toBe(true)
    expect(
      (await call("GET", "/me/verification", { as: "u-workshop" })).body.status
    ).toBe("approved")
  })

  it("the demo mechanic starts unverified and gets the public badge after approval", async () => {
    const mechanic = db.mechanics.find((m) => m.ownerId === "u-mechanic")!
    const badge = async () =>
      (await call("GET", `/mechanics/${mechanic.slug}`)).body.verified
    expect(await badge()).toBe(false)
    expect(
      (await call("GET", "/me/verification", { as: "u-mechanic" })).body
    ).toBeNull()
    const sent = await send("u-mechanic", [
      ["national_id", file("id.png", 20)],
      ["certificate", file("certificate.png", 30)],
    ])
    expect(sent.body).toMatchObject({
      status: "pending",
      targetType: "mechanic",
      targetId: mechanic.id,
    })
    await call("POST", `/admin/verifications/${sent.body.id}/approve`, {
      as: "u-admin",
    })
    expect(await badge()).toBe(true)
    expect(
      (await call("GET", "/me/verification", { as: "u-mechanic" })).body.status
    ).toBe("approved")
  })

  it("refuses bad input, a second pending request and an already verified business", async () => {
    const png = () => file("a.png", 10)
    const bad = await send("u-dealer", [["selfie", png()]])
    expect(bad.status).toBe(422)
    expect(bad.body.fields.documents).toBe("validation.select_min")
    expect((await send("u-dealer", [])).status).toBe(422)
    expect(
      (
        await send(
          "u-dealer",
          Array.from({ length: 6 }, () => ["other", png()])
        )
      ).status
    ).toBe(422)
    const pdf = await send("u-dealer", [
      ["other", file("a.pdf", 10, "application/pdf")],
    ])
    expect(pdf.body.fields.file).toBe("validation.image_type")
    expect(
      (await send("u-dealer", [["other", png()]], "x".repeat(301))).body.fields
        .note
    ).toBe("validation.too_long")
    expect((await send("u-omar", [["other", png()]])).status).toBe(403)
    expect((await send("u-dealer", [["other", png()]])).status).toBe(200)
    expect((await send("u-dealer", [["other", png()]])).status).toBe(409)
    dealerBiz().verified = true
    db.verifications = db.verifications.filter((v) => v.ownerId !== "u-dealer")
    expect((await send("u-dealer", [["other", png()]])).status).toBe(409)
  })

  it("a rejected request can be sent again and the newest one wins", async () => {
    const first = await send("u-dealer", [["other", file("a.png", 10)]])
    await call("POST", `/admin/verifications/${first.body.id}/reject`, {
      as: "u-admin",
      body: { reason: "Blurry" },
    })
    const mine = await call("GET", "/me/verification", { as: "u-dealer" })
    expect(mine.body).toMatchObject({
      status: "rejected",
      rejectionReason: "Blurry",
    })
    const again = await send("u-dealer", [["other", file("b.png", 10)]])
    expect(again.status).toBe(200)
    expect(
      (await call("GET", "/me/verification", { as: "u-dealer" })).body.id
    ).toBe(again.body.id)
  })
})

describe("account, settings side", () => {
  const user = () => db.users.find((u) => u.id === "u-1")!
  const patch = (body: object, as = "u-1") => call("PATCH", "/me", { as, body })

  it("saves a new phone only with the code, and then counts it as verified", async () => {
    user().verifiedPhone = false
    const noCode = await patch({ phone: "+249922222222" })
    expect(noCode.status).toBe(422)
    expect(noCode.body.code).toBe("otp_invalid")
    expect(
      (await patch({ phone: "+249922222222", code: "111111" })).status
    ).toBe(422)
    expect(user().phone).not.toBe("+249922222222")
    const ok = await patch({ phone: "+249922222222", code: "123456" })
    expect(ok.status).toBe(200)
    expect(ok.body).toMatchObject({
      phone: "+249922222222",
      verifiedPhone: true,
    })
  })

  it("needs no code for a field that did not change", async () => {
    const res = await patch({ phone: user().phone, fullName: "Omar Saved" })
    expect(res.status).toBe(200)
    expect(res.body.fullName).toBe("Omar Saved")
  })

  it("refuses a phone or email another account has, before and after the code", async () => {
    const taken = db.users.find((u) => u.id !== "u-1" && u.phone)!.phone!
    expect((await patch({ phone: taken, code: "123456" })).body.code).toBe(
      "exists"
    )
    const send = (as?: string) =>
      call("POST", "/auth/otp/send", { as, body: { identifier: taken } })
    expect((await send("u-1")).status).toBe(409)
    expect((await send()).status).toBe(200) // signed out, the code is for signing in
  })

  it("removes the phone with an empty string, never the email", async () => {
    const email = user().email
    const kept = await patch({ email: "" })
    expect(kept.status).toBe(422)
    expect(kept.body.code).toBe("contact_required")
    expect(user().email).toBe(email)
    const cleared = await patch({ phone: "" })
    expect(cleared.status).toBe(200)
    expect(cleared.body.phone).toBeUndefined()
    expect(user().verifiedPhone).toBe(false)
  })

  it("keeps the language on the account and clears the city and avatar on empty", async () => {
    user().cityId = "khartoum"
    user().avatarUrl = "/api/uploads/up-1?w={w}"
    const res = await patch({ locale: "en", cityId: "", avatarUrl: "" })
    expect(res.status).toBe(200)
    expect(user().locale).toBe("en")
    expect(res.body.cityId).toBeUndefined()
    expect(res.body.avatarUrl).toBeUndefined()
  })

  it("tells whether the account has a password, and takes a first one without the current", async () => {
    const social = await call("POST", "/auth/oauth/google", {
      body: { accountId: "Sara" },
    })
    expect(social.body.hasPassword).toBe(false)
    const as = social.res.headers
      .get("set-cookie")!
      .match(/sy_session=([^;]+)/)![1]!
    expect((await call("GET", "/me", { as })).body.hasPassword).toBe(false)
    const set = await call("POST", "/me/password", {
      as,
      body: { newPassword: "Fresh1234" },
    })
    expect(set.status).toBe(200)
    expect((await call("GET", "/me", { as })).body.hasPassword).toBe(true)
    const wrong = await call("POST", "/me/password", {
      as,
      body: { currentPassword: "Nope1234", newPassword: "Other5678" },
    })
    expect(wrong.status).toBe(401)
  })

  it("deletes a business owner with the profile, its reviews and threads", async () => {
    const biz = db.dealerships.find((d) => d.ownerId === "u-dealer")!
    // Seeded reviews land on random businesses, so make sure this one has one.
    if (!db.reviews.some((r) => r.targetId === biz.id))
      db.reviews.push({
        ...db.reviews[0]!,
        id: "r-cascade",
        targetType: "dealership",
        targetId: biz.id,
      })
    expect(db.reviews.some((r) => r.targetId === biz.id)).toBe(true)
    const pending = db.payments.find((p) => p.userId === "u-dealer")
    const res = await call("DELETE", "/me", { as: "u-dealer" })
    expect(res.status).toBe(200)
    expect(db.users.some((u) => u.id === "u-dealer")).toBe(false)
    expect(db.dealerships.some((d) => d.id === biz.id)).toBe(false)
    expect(db.reviews.some((r) => r.targetId === biz.id)).toBe(false)
    expect(
      db.listings.some(
        (l) => l.ownerUserId === "u-dealer" && l.moderation !== "removed"
      )
    ).toBe(false)
    expect(db.threads.some((t) => t.participantIds.includes("u-dealer"))).toBe(
      false
    )
    expect(db.subscriptions.some((s) => s.userId === "u-dealer")).toBe(false)
    expect((await call("GET", `/dealerships/${biz.slug}`)).status).toBe(404)
    if (pending?.status === "pending_review")
      throw new Error("payment kept pending")
    expect((await call("GET", "/me", { as: "u-dealer" })).body).toBeNull()
  })

  it("does not delete an admin", async () => {
    expect((await call("DELETE", "/me", { as: "u-admin" })).status).toBe(403)
    expect(db.users.some((u) => u.id === "u-admin")).toBe(true)
  })
})

describe("mock", () => {
  it("reset restores the seed", async () => {
    await call("POST", "/listings", { as: "u-1", body: car })
    const count = db.listings.length
    await call("POST", "/mock/reset")
    expect(db.listings.length).toBe(count - 1)
  })
})

describe("banner ads", () => {
  const tomorrow = () =>
    new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
  const creative = {
    imageUrl: "/mock/banner-1.webp",
    copy: {
      en: { heading: "Big sale", body: "This week only", cta: "See cars" },
      ar: { heading: "تخفيضات", body: "هذا الأسبوع فقط", cta: "شاهد" },
    },
  }
  const targets = async (as: string) =>
    (await call("GET", "/me/ad-targets", { as })).body as { href: string }[]

  it("prices from the page table, links only to own pages, and runs after admin approval", async () => {
    const as = "u-dealer"
    const [profile] = await targets(as)
    expect(profile!.href).toMatch(/^\/dealerships\//)
    const bad = await call("POST", "/campaigns", {
      as,
      body: {
        creative,
        href: "https://evil.example",
        pages: ["search_parts"],
        startDate: tomorrow(),
        weeks: 2,
      },
    })
    expect(bad.body.fields.href).toBe("validation.ad_target")
    const made = await call("POST", "/campaigns", {
      as,
      body: {
        creative,
        href: profile!.href,
        pages: ["search_parts", "directory_mechanics"],
        startDate: tomorrow(),
        weeks: 2,
      },
    })
    expect(made.body).toMatchObject({
      status: "pending_payment",
      amount: (80_000 + 50_000) * 2,
    })
    const checkout = await call(
      "GET",
      `/checkout?item=campaign:${made.body.id}`,
      { as }
    )
    expect(checkout.body.amount).toBe(260_000)
    const paid = await call("POST", "/payments", {
      as,
      form: receipt("campaign", made.body.id),
    })
    expect(paid.status).toBe(200)
    // Under review now: the checkout shows the pending state and a second receipt is refused as pending.
    const after = await call("GET", `/checkout?item=campaign:${made.body.id}`, {
      as,
    })
    expect(after.body.pendingPaymentId).toBe(paid.body.id)
    const again = await call("POST", "/payments", {
      as,
      form: receipt("campaign", made.body.id),
    })
    expect(again.body.code).toBe("payment_pending")
    const row = db.campaigns.find((c) => c.id === made.body.id)!
    expect(row.status).toBe("under_review")
    row.startsAt = new Date(Date.now() - 1000).toISOString()
    expect((await call("GET", "/ads?page=search_parts")).body).toEqual([])
    await call("POST", `/admin/campaigns/${row.id}/approve`, { as: "u-admin" })
    const served = (await call("GET", "/ads?page=search_parts")).body
    expect(served).toHaveLength(1)
    expect(served[0]).toMatchObject({ id: row.id, sponsored: true })
  })

  it("refuses a page with no free slot for the dates", async () => {
    const page = db.adPages.find((p) => p.id === "search_motorcycle")!
    page.slots = 1
    const as = "u-dealer"
    const [profile] = await targets(as)
    const body = {
      creative,
      href: profile!.href,
      pages: ["search_motorcycle"],
      startDate: tomorrow(),
      weeks: 1,
    }
    const first = await call("POST", "/campaigns", { as, body })
    db.campaigns.find((c) => c.id === first.body.id)!.status = "approved"
    const free = (
      await call("GET", `/ad-pages?startDate=${tomorrow()}&weeks=1`, { as })
    ).body
    expect(
      free.find((p: { id: string }) => p.id === "search_motorcycle").free
    ).toBe(0)
    const second = await call("POST", "/campaigns", { as, body })
    expect(second.status).toBe(409)
    expect(second.body.pages).toEqual(["search_motorcycle"])
  })
})
