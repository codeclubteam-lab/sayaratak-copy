import { readFileSync, readdirSync } from "node:fs"

import { test as base, expect } from "@playwright/test"
import type { Locator, Page } from "@playwright/test"

import { sessions } from "../routes"
import type { Role } from "../routes"

export type Options = { lang: "ar" | "en" }
type Lang = Options["lang"]

const messages = (lang: Lang): Record<string, string> =>
  Object.assign(
    {},
    ...readdirSync(`src/messages/${lang}`).map(
      (file) =>
        JSON.parse(readFileSync(`src/messages/${lang}/${file}`, "utf8")) as {}
    )
  )
const all = { ar: messages("ar"), en: messages("en") }

// UI text by key, so the same journey reads both languages. `{{name}}` placeholders are filled from `vars`.
export const text = (
  lang: Lang,
  key: string,
  vars: Record<string, string | number> = {}
) => {
  const value = all[lang][key]
  if (value === undefined) throw new Error(`missing ${lang} key ${key}`)
  return value.replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
    String(vars[name])
  )
}

// A number as the page shows it, in either digit set, with separators dropped.
export const readNumber = async (locator: Locator) =>
  Number(
    (await locator.innerText())
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
      .replace(/\D/g, "")
  )

// Fills the sign up form inside `scope` (the page or the auth dialog) and enters the emailed code, which the mock
// returns as `demoCode`. Ends on the "verified" step.
export const signUp = async (
  scope: Locator,
  t: (key: string) => string,
  { name, email }: { name: string; email: string }
) => {
  const page = scope.page()
  await scope.getByLabel(t("auth.full_name_label")).fill(name)
  await scope.getByLabel(t("auth.email_label")).fill(email)
  await scope
    .getByLabel(t("auth.password_label"), { exact: true })
    .fill("Journey1234")
  await scope.getByLabel(t("auth.confirm_password_label")).fill("Journey1234")
  await scope.getByRole("checkbox").click()
  const sent = page.waitForResponse((r) => r.url().endsWith("/api/auth/signup"))
  await scope.getByRole("button", { name: t("auth.create_account") }).click()
  const { demoCode } = (await (await sent).json()) as { demoCode: string }
  await scope.getByLabel(t("auth.otp_label")).fill(demoCode)
  await expect(scope.getByText(t("auth.verified_title"))).toBeVisible()
}

// A new signed-in account made through the API, for journeys where sign up is not the subject. Shares the page's cookies.
export const freshAccount = async (page: Page, name: string, email: string) => {
  const sent = await page.request.post("/api/auth/signup", {
    data: { fullName: name, email, password: "Journey1234" },
  })
  const { demoCode } = (await sent.json()) as { demoCode: string }
  const made = await page.request.post("/api/auth/signup/verify", {
    data: { email, code: demoCode },
  })
  expect(made.ok()).toBe(true)
}

// Opens a page and waits for it to settle, so the first click lands on a hydrated page, not on the server markup.
export const visit = (page: Page, path: string) =>
  page.goto(path, { waitUntil: "networkidle" })

// Chooses an option in a select by its field label.
export const pick = async (
  scope: Page | Locator,
  label: string,
  option: string
) => {
  await scope.getByRole("combobox", { name: label }).click()
  const page = "page" in scope ? scope.page() : scope
  await page.getByRole("option", { name: option, exact: true }).click()
}

// The city every journey uses, by taxonomy name.
export const khartoum = { ar: "الخرطوم", en: "Khartoum" }

type Fixtures = {
  t: (key: string, vars?: Record<string, string | number>) => string
  // A page in a fresh browser context signed in as a seed account, for the second person in a journey.
  as: (role: Exclude<Role, "anon">) => Promise<Page>
  // Signs the test's own page in as a seed account, so a failure snapshot shows the main person's screen.
  signIn: (role: Exclude<Role, "anon">) => Promise<void>
  // The path with the locale in front.
  at: (path: string) => string
}

export const test = base.extend<Options & Fixtures>({
  lang: ["ar", { option: true }],
  t: async ({ lang }, use) => use((key, vars) => text(lang, key, vars)),
  at: async ({ lang }, use) => use((path) => `/${lang}${path}`),
  signIn: async ({ context, baseURL }, use) =>
    use((role) =>
      context.addCookies([
        { name: "sy_session", value: sessions[role], url: baseURL },
      ])
    ),
  as: async ({ browser, baseURL, viewport }, use) => {
    const contexts: Array<Awaited<ReturnType<typeof browser.newContext>>> = []
    await use(async (role) => {
      const context = await browser.newContext({ baseURL, viewport })
      contexts.push(context)
      await context.addCookies([
        { name: "sy_session", value: sessions[role], url: baseURL },
      ])
      return context.newPage()
    })
    for (const context of contexts) await context.close()
  },
})

// Every journey starts from the seed.
test.beforeEach(async ({ request }) => {
  expect((await request.post("/api/mock/reset")).ok()).toBe(true)
})

export { expect }
