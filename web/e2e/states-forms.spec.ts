import { readFileSync } from "node:fs"

import { expect, test } from "@playwright/test"
import type { Locator, Page } from "@playwright/test"

import { sessions } from "./routes"
import type { Role } from "./routes"

// 422 on submit (14.6): a form that fails to save keeps what the person typed, says so, and works again once the
// failure is gone. The failure goes in after the page has loaded, so only the submit fails.
const text = (locale: string, file: string, key: string) => {
  const all = JSON.parse(
    readFileSync(`src/messages/${locale}/${file}.json`, "utf8")
  ) as Record<string, string>
  const value = all[key]
  if (value === undefined) throw new Error(`missing ${locale} key ${key}`)
  return value
}

type Form = {
  name: string
  role: Role
  path: string
  // The field to edit, and the button that submits its form.
  field: (page: Page) => Locator
  submit: (page: Page) => Locator
  value: string
  // Anything else the form needs before it will submit.
  prepare?: (page: Page) => Promise<void>
  // The message the form shows when the save fails.
  error: [file: string, key: string]
}

const settings = (page: Page) => page.locator("main")
const forms: Array<Form> = [
  {
    name: "Contact",
    role: "anon",
    path: "/contact",
    field: (page) => page.locator("input[name=name]"),
    submit: (page) =>
      settings(page).getByRole("button", { name: /send|إرسال/i }),
    value: "Sweep Tester",
    error: ["toast", "toast.error_save"],
    prepare: async (page) => {
      await page.locator("input[name=contact]").fill("sweep@example.com")
      await page
        .locator("textarea[name=message]")
        .fill("This is a sweep test message.")
    },
  },
  {
    name: "Log in",
    role: "anon",
    path: "/auth/login",
    field: (page) => page.locator("input[name=email]"),
    submit: (page) =>
      page.locator("form:has(input[name=email]) button[type=submit]"),
    value: "sweep@example.com",
    error: ["auth", "auth.login_error"],
    prepare: async (page) => {
      await page.locator("input[name=password]").fill("Sweep-test-1")
    },
  },
  {
    name: "Account profile",
    role: "user",
    path: "/account/settings",
    field: (page) => page.locator("input[name=fullName]"),
    submit: (page) =>
      page.locator("form:has(input[name=fullName]) button[type=submit]"),
    value: "Sweep Tester",
    error: ["dashboard", "settings.save_error"],
  },
  {
    name: "Dealership profile",
    role: "dealer",
    path: "/dealer/profile",
    field: (page) => page.locator("input[name='name.en']"),
    submit: (page) =>
      page.locator("form:has(input[name='name.en']) button[type=submit]"),
    value: "Sweep Tester",
    error: ["dashboard", "settings.save_error"],
  },
  {
    name: "Workshop profile",
    role: "workshop",
    path: "/workshop/profile",
    field: (page) => page.locator("input[name='name.en']"),
    submit: (page) =>
      page.locator("form:has(input[name='name.en']) button[type=submit]"),
    value: "Sweep Tester",
    error: ["dashboard", "settings.save_error"],
  },
  {
    name: "Mechanic profile",
    role: "mechanic",
    path: "/mechanic/profile",
    field: (page) => page.locator("input[name='name.en']"),
    submit: (page) =>
      page.locator("form:has(input[name='name.en']) button[type=submit]"),
    value: "Sweep Tester",
    error: ["dashboard", "settings.save_error"],
  },
  {
    name: "Admin payments settings",
    role: "admin",
    path: "/admin/settings",
    field: (page) => page.locator("input[name=bankakAccountName]"),
    submit: (page) =>
      page.locator(
        "form:has(input[name=bankakAccountName]) button[type=submit]"
      ),
    value: "Sweep Tester",
    error: ["toast", "toast.error_save"],
  },
]

for (const form of forms)
  for (const locale of ["ar", "en"] as const)
    test(`422 on submit ${form.name} /${locale}`, async ({
      page,
      context,
      baseURL,
    }) => {
      const errors: Array<string> = []
      page.on("pageerror", (e) => errors.push(e.message))
      if (form.role !== "anon")
        await context.addCookies([
          { name: "sy_session", value: sessions[form.role], url: baseURL },
        ])
      await page.goto(`/${locale}${form.path}`, { waitUntil: "networkidle" })
      await page.waitForTimeout(1000)
      const field = form.field(page)
      await field.fill(form.value)
      await form.prepare?.(page)
      const failed = text(locale, ...form.error)
      await context.addCookies([
        { name: "mock_fail", value: "422", url: baseURL },
      ])
      await form.submit(page).click()
      // The page says it could not save, and the typed value is still there.
      await expect(page.getByText(failed).first()).toBeVisible()
      await expect(field).toHaveValue(form.value)
      // Once the failure is gone the same button saves.
      await context.clearCookies({ name: "mock_fail" })
      await form.submit(page).click()
      await expect(page.getByText(failed)).toHaveCount(0, {
        timeout: 10_000,
      })
      expect(errors, "thrown errors").toEqual([])
    })

// Optimistic updates roll back with a message (14.6): the heart fills at once, then empties when the save fails.
test("optimistic favorite rolls back on failure", async ({
  page,
  context,
  baseURL,
}) => {
  const errors: Array<string> = []
  page.on("pageerror", (e) => errors.push(e.message))
  await context.addCookies([
    { name: "sy_session", value: sessions.user, url: baseURL },
  ])
  await page.goto("/en/search", { waitUntil: "networkidle" })
  await page.waitForTimeout(1000)
  const add = page.getByRole("button", { name: "Save to favorites" }).first()
  await expect(add).toBeVisible()
  await context.addCookies([{ name: "mock_fail", value: "500", url: baseURL }])
  await add.click()
  await expect(
    page.getByText(text("en", "toast", "toast.error_save")).first()
  ).toBeVisible()
  // Rolled back: the same card offers "Save" again, and none shows "Remove".
  await expect(
    page.getByRole("button", { name: "Remove from favorites" })
  ).toHaveCount(0)
  expect(errors, "thrown errors").toEqual([])
})

// Slow route navigations (14.6): nothing shows for the first 150 ms, then the progress bar, then the skeleton from 400 ms.
test("slow navigation shows progress at 150 ms and skeleton at 400 ms", async ({
  page,
  context,
  baseURL,
}) => {
  await page.goto("/en", { waitUntil: "networkidle" })
  await page.waitForTimeout(1500)
  await context.addCookies([
    { name: "mock_latency", value: "2000", url: baseURL },
  ])
  // Times are taken inside the page, from the click, so Playwright's own delay does not count.
  await page.evaluate(() => {
    const w = window as unknown as {
      marks: { bar?: number; skeleton?: number }
    }
    w.marks = {}
    let t0 = 0
    document.addEventListener("click", () => (t0 = performance.now()), true)
    new MutationObserver(() => {
      if (!t0) return
      const now = Math.round(performance.now() - t0)
      if (document.querySelector("div.fixed.top-0.h-0\\.5")) w.marks.bar ??= now
      if (document.querySelector("[role=status][aria-busy=true]"))
        w.marks.skeleton ??= now
    }).observe(document.body, { childList: true, subtree: true })
  })
  await page.getByRole("link", { name: "Workshops" }).first().click()
  await page.waitForTimeout(1200)
  const marks = await page.evaluate(
    () =>
      (window as unknown as { marks: { bar?: number; skeleton?: number } })
        .marks
  )
  expect(marks.bar, "bar shows from 150 ms").toBeGreaterThanOrEqual(140)
  expect(marks.bar, "bar shows soon after 150 ms").toBeLessThan(300)
  expect(marks.skeleton, "skeleton shows from 400 ms").toBeGreaterThanOrEqual(
    390
  )
  expect(marks.skeleton, "skeleton shows soon after 400 ms").toBeLessThan(600)
  const skeleton = page.locator("[role=status][aria-busy=true]")
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
    timeout: 10_000,
  })
  await expect(skeleton).toHaveCount(0)
})

// The post wizard (14.6): Publish fails with a 422, the person stays on the review screen with everything they entered,
// and Publish works once the failure is gone. The wizard runs end to end in the browser; the listing it makes is wiped by
// the reset at the end.
test("422 on Publish keeps the wizard on the review screen", async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(90_000)
  const errors: Array<string> = []
  page.on("pageerror", (e) => errors.push(e.message))
  await context.addCookies([
    { name: "sy_session", value: sessions.user, url: baseURL },
  ])
  await page.goto("/en/post", { waitUntil: "networkidle" })
  await page.waitForTimeout(1000)
  const next = page.getByRole("button", { name: /^Next/ })
  const pick = async (label: RegExp) => {
    await page.getByLabel(label).first().click()
    await page.getByRole("option").first().click()
  }
  await page.getByRole("radio", { name: "Car" }).check({ force: true })
  await next.click()
  for (const label of [/^Make/, /^Model/, /^Year/, /^Fuel/, /^Transmission/])
    await pick(label)
  await page.getByRole("textbox", { name: /Mileage/ }).fill("120000")
  await page
    .locator("textarea")
    .first()
    .fill(
      "A clean car in very good condition, one owner, service history kept."
    )
  await page
    .getByLabel(/^Price/)
    .first()
    .fill("1500000")
  await next.click()
  await page
    .locator("input[type=file][accept*=image]")
    .first()
    .setInputFiles(
      ["banner-1", "banner-2", "banner-3"].map((n) => `public/mock/${n}.webp`)
    )
  await expect(async () => {
    await next.click()
    await expect(page).toHaveURL(/step=contact/, { timeout: 1500 })
  }).toPass({ timeout: 20_000 })
  await pick(/^District/)
  await next.click()
  await expect(page).toHaveURL(/step=review/)
  await context.addCookies([{ name: "mock_fail", value: "422", url: baseURL }])
  await page.getByRole("button", { name: "Publish" }).click()
  await expect(page.getByText(/Could not/).first()).toBeVisible()
  await expect(page).toHaveURL(/step=review/)
  await context.clearCookies({ name: "mock_fail" })
  await page.getByRole("button", { name: "Publish" }).click()
  await expect(page).toHaveURL(/step=done/, { timeout: 15_000 })
  expect(errors, "thrown errors").toEqual([])
  await page.request.post("/api/mock/reset")
})

// Onboarding (14.6): a fresh account picks a role, the save fails with a 422, and the choice is still selected.
test("422 on the onboarding role step keeps the choice", async ({
  page,
  context,
  baseURL,
  playwright,
}) => {
  const errors: Array<string> = []
  page.on("pageerror", (e) => errors.push(e.message))
  const api = await playwright.request.newContext({ baseURL })
  const email = `sweep${Date.now()}@example.com`
  const signup = (await (
    await api.post("/api/auth/signup", {
      data: { fullName: "Sweep Tester", email, password: "Sweep-test-1" },
    })
  ).json()) as { demoCode: string }
  await api.post("/api/auth/signup/verify", {
    data: { email, code: signup.demoCode },
  })
  const session = (await api.storageState()).cookies.find(
    (c) => c.name === "sy_session"
  )
  if (!session) throw new Error("no session")
  await context.addCookies([
    { name: "sy_session", value: session.value, url: baseURL },
  ])
  await page.goto("/en/onboarding", { waitUntil: "networkidle" })
  await page.waitForTimeout(1000)
  const choice = page.getByRole("radio", { name: /^Dealership/ })
  await choice.check({ force: true })
  await context.addCookies([{ name: "mock_fail", value: "422", url: baseURL }])
  await page.getByRole("button", { name: "Continue" }).click()
  await expect(page.getByText(/could not save/i).first()).toBeVisible()
  await expect(page).toHaveURL(/onboarding\/role/)
  await expect(choice).toBeChecked()
  await context.clearCookies({ name: "mock_fail" })
  await page.getByRole("button", { name: "Continue" }).click()
  await expect(page).not.toHaveURL(/onboarding\/role/, { timeout: 10_000 })
  expect(errors, "thrown errors").toEqual([])
  await page.request.post("/api/mock/reset")
})
