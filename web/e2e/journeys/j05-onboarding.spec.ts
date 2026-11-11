import { expect, freshAccount, khartoum, pick, test, visit } from "./fixtures"
import type { Page } from "@playwright/test"

type Lang = "ar" | "en"
type T = (key: string) => string
type Step = (page: Page, t: T, lang: Lang) => Promise<void>

// Taxonomy names, which are data, not message keys.
const amarat = { ar: "العمارات", en: "Amarat" }
const engines = { ar: "المحركات", en: "Engines" }
const oilChange = { ar: "تغيير زيت", en: "Oil change" }

const box = (page: Page, name: string) =>
  page.getByRole("textbox", { name: new RegExp(`^${name}`) }).first()
const chip = (page: Page, name: string) =>
  page
    .locator("label")
    .filter({ has: page.getByRole("checkbox", { name, exact: true }) })
    .first()
const place: Step = async (page, t, lang) => {
  await pick(page, t("form.city"), khartoum[lang])
  await pick(page, t("form.district"), amarat[lang])
  await box(page, t("form.address")).fill("Street 15, near the market")
  await box(page, t("form.phone")).fill("912345611")
}
// The free plan is chosen once the plans have loaded.
const freePlan: Step = async (page) => {
  await expect(page.getByRole("radio", { checked: true })).toBeVisible()
}
const about = "Honest work, fair prices and papers in order."

// Each role's steps after the role page, in order; the business name is what the directory shows.
const runs: Array<{
  role: "user" | "dealership" | "workshop" | "mechanic"
  name: string
  directory?: string
  // The step that "Finish setting up" opens after Save and exit on the second step.
  resume?: string
  steps: Array<Step>
}> = [
  {
    role: "user",
    name: "Journey Individual",
    steps: [
      async (page, t, lang) => pick(page, t("form.city"), khartoum[lang]),
    ],
  },
  {
    role: "dealership",
    name: "Journey Motors",
    directory: "/dealerships",
    resume: "hours",
    steps: [
      async (page, t) => {
        await box(page, t("onboarding.dealer_name_label")).fill(
          "Journey Motors"
        )
        await box(page, t("onboarding.dealer_about_label")).fill(about)
      },
      place,
      async () => {},
      freePlan,
    ],
  },
  {
    role: "workshop",
    name: "Journey Garage",
    directory: "/workshops",
    resume: "hours-services",
    steps: [
      async (page, t) => {
        await box(page, t("onboarding.workshop_name_label")).fill(
          "Journey Garage"
        )
        await box(page, t("onboarding.workshop_about_label")).fill(about)
      },
      place,
      async (page, _t, lang) => chip(page, oilChange[lang]).click(),
      freePlan,
    ],
  },
  {
    role: "mechanic",
    name: "Journey Mechanic",
    directory: "/mechanics",
    resume: "contact-plan",
    steps: [
      async (page, t) => {
        await box(page, t("onboarding.mechanic_years_label")).fill("8")
        await box(page, t("onboarding.mechanic_bio_label")).fill(about)
      },
      async (page, t, lang) => {
        await chip(page, engines[lang]).click()
        await pick(
          page,
          t("onboarding.mechanic_home_city_label"),
          khartoum[lang]
        )
      },
      async (page, t, lang) => {
        await box(page, t("form.phone")).fill("912345622")
        await freePlan(page, t, lang)
      },
    ],
  },
]

for (const { role, name, directory, resume, steps } of runs)
  test(`J5 onboarding as ${role}: refresh, Back, resume, dashboard and directory`, async ({
    page,
    t,
    at,
    lang,
  }) => {
    await freshAccount(page, name, `${role}@journey.sy`)
    await visit(page, at("/onboarding/role"))
    await page
      .locator("label")
      .filter({
        has: page.getByRole("radio", {
          name: new RegExp(`^${t(`onboarding.role_${role}_title`)}`),
        }),
      })
      .click()
    const next = page.getByRole("button", {
      name: new RegExp(
        `^(${t("common.continue")}|${t(`onboarding.finish_${role}`)})`
      ),
    })
    // Continue moves on once the step is saved.
    const advance = async () => {
      const from = page.url()
      await next.click()
      await expect(page).not.toHaveURL(from)
    }
    await advance()
    await expect(page).toHaveURL(new RegExp(`/onboarding/${role}/`))
    const first = page.url()

    // Refresh in the middle keeps the step.
    await page.reload({ waitUntil: "networkidle" })
    expect(page.url()).toBe(first)

    // Save and exit keeps what is valid; "Finish setting up" (/onboarding) resumes at the first open step.
    const exitAndResume = async (expected: string, saves: boolean) => {
      // The save finishes in the background after the page has left; wait for it before coming back.
      const saved =
        saves &&
        page.waitForResponse(
          (r) =>
            r.url().includes("/api/v1/drafts/") &&
            r.request().method() === "PATCH"
        )
      await page
        .getByRole("button", { name: t("onboarding.save_exit") })
        .click()
      await expect(page).not.toHaveURL(/onboarding/)
      await saved
      await visit(page, at("/onboarding"))
      await expect(page).toHaveURL(expected)
    }

    if (role === "user") {
      // Back from the only step goes to the role page, which keeps the choice.
      await page.getByRole("button", { name: t("common.back") }).click()
      await expect(page).toHaveURL(/\/onboarding\/role/)
      await advance()
      await expect(page).toHaveURL(first)
      // No city yet, so nothing is saved and the step stays open.
      await exitAndResume(first, false)
      await steps[0]!(page, t, lang)
      await advance()
    } else {
      await steps[0]!(page, t, lang)
      await advance()
      const second = page.url()
      // Back returns to the saved first step with its values.
      await page.getByRole("button", { name: t("common.back") }).click()
      await expect(page).toHaveURL(first)
      if (role !== "mechanic")
        await expect(page.getByRole("textbox").first()).toHaveValue(name)
      await advance()
      await steps[1]!(page, t, lang)
      // The second step is valid, so it is saved and the third one is open.
      await exitAndResume(first.replace(/[^/]+$/, resume!), true)
      expect(page.url()).not.toBe(second)
      for (const step of steps.slice(2)) {
        await step(page, t, lang)
        await advance()
      }
    }
    const dashboard =
      role === "user"
        ? "/account"
        : `/${role === "dealership" ? "dealer" : role}`
    await expect(page).toHaveURL(new RegExp(`${at(dashboard)}\\?welcome=1$`))

    if (directory) {
      await visit(page, at(`${directory}?q=${encodeURIComponent(name)}`))
      await expect(page.locator("main").getByText(name).first()).toBeVisible()
    }
  })
