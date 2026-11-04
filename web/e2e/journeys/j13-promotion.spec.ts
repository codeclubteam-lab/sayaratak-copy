import { expect, pick, test, visit } from "./fixtures"
import type { Page } from "@playwright/test"

type T = (key: string, vars?: Record<string, string | number>) => string

// Posts a Toyota Corolla through the dealer wizard and returns on the done screen.
const post = async (page: Page, t: T, lang: "ar" | "en", year: string) => {
  await visit(page, `/${lang}/dealer/inventory/new`)
  const next = page.getByRole("button", { name: t("common.next") })
  await page
    .locator("label")
    .filter({
      has: page.getByRole("radio", {
        name: lang === "ar" ? "سيارة" : "Car",
        exact: true,
      }),
    })
    .click()
  await next.click()
  await expect(page).toHaveURL(/step=details/)
  await pick(page, t("form.make"), lang === "ar" ? "تويوتا" : "Toyota")
  await pick(page, t("form.model"), lang === "ar" ? "كورولا" : "Corolla")
  await pick(page, t("form.year"), year)
  await pick(page, t("form.fuel"), t("fuel.petrol"))
  await pick(page, t("form.transmission"), t("transmission.automatic"))
  await page.getByRole("textbox", { name: t("form.mileage") }).fill("90000")
  await page
    .getByLabel(t("form.description"))
    .fill("Showroom car, inspected, papers and customs complete.")
  await page.getByLabel(t("form.price")).first().fill("16000000")
  await next.click()
  await expect(page).toHaveURL(/step=photos/)
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
  // The dealership's own address and phone fill the contact step once its profile has loaded.
  await expect(async () => {
    await next.click()
    await expect(page).toHaveURL(/step=review/, { timeout: 1500 })
  }).toPass({ timeout: 20_000 })
  await page.getByRole("button", { name: t("post.publish") }).click()
  await expect(page).toHaveURL(/step=done/)
}

test("J13 verified dealer posts live, features it for 7 days by transfer, admin approves, it is featured and ranks first; Not now creates nothing", async ({
  page: dealer,
  as,
  signIn,
  t,
  at,
  lang,
}) => {
  const shown = `${lang === "ar" ? "تويوتا كورولا" : "Toyota Corolla"} 2015`
  await signIn("dealer")

  // Auto-approve is on and the dealership is verified, so the listing is live at once and promotion is offered.
  await post(dealer, t, lang, "2015")
  await expect(dealer.getByText(t("post.done_live_title"))).toBeVisible()
  await dealer
    .getByRole("radiogroup", { name: t("post.promo_title") })
    .locator("label")
    .filter({ hasText: t("promotion.name_featured") })
    .filter({
      hasText: t(`billing.duration_days_${lang === "ar" ? "few" : "other"}`, {
        count: 7,
      }),
    })
    .click()
  await dealer.getByRole("button", { name: t("post.promo_continue") }).click()

  await expect(dealer).toHaveURL(/\/dealer\/billing\/checkout/)
  await dealer.getByLabel(t("billing.payer_name")).fill("Al Nasr Motors")
  await dealer.getByLabel(t("billing.transaction_ref")).fill("55443322")
  await dealer
    .locator("input[type=file]")
    .first()
    .setInputFiles("public/mock/banner-1.webp")
  await expect(dealer.getByAltText(t("billing.receipt_preview"))).toBeVisible()
  await dealer
    .getByRole("button", { name: t("billing.submit_payment") })
    .click()
  await expect(
    dealer.getByRole("heading", { name: t("billing.submitted_title") })
  ).toBeVisible()

  const admin = await as("admin")
  await visit(admin, at("/admin/payments"))
  await admin.getByRole("searchbox").fill("55443322")
  await admin
    .locator("main")
    .getByRole("button", { name: /^SY-/ })
    .locator("visible=true")
    .first()
    .click()
  await admin
    .getByRole("dialog")
    .getByRole("button", { name: t("admin.approve") })
    .click()
  await admin
    .getByRole("alertdialog")
    .getByRole("button", { name: t("admin.approve") })
    .click()
  await expect(admin.getByText(t("admin.payment_approved"))).toBeVisible()

  // In search the featured car carries the badge and comes before every unpromoted Corolla.
  const buyer = await as("user")
  await visit(buyer, at("/vehicles/cars/sale?make=toyota&model=toyota-corolla"))
  const cards = buyer.locator("main li article")
  await expect(cards.first()).toBeVisible()
  const rows = await cards.evaluateAll(
    (all, badge) =>
      all.map((card) => ({
        title: card.querySelector("h3")?.textContent ?? "",
        promoted: [...card.querySelectorAll("*")].some(
          (el) => el.children.length === 0 && el.textContent === badge
        ),
      })),
    t("listing.featured")
  )
  const ours = rows.findIndex((r) => r.title === shown)
  expect(ours).toBeGreaterThanOrEqual(0)
  expect(rows[ours]!.promoted).toBe(true)
  expect(rows.slice(0, ours).every((r) => r.promoted)).toBe(true)
  expect(rows.slice(ours + 1).some((r) => !r.promoted)).toBe(true)

  // A second listing: Not now closes the offer and creates no promotion.
  const promotions: Array<string> = []
  dealer.on("request", (r) => {
    if (r.method() === "POST" && /\/api\/.*promot/.test(r.url()))
      promotions.push(r.url())
  })
  await post(dealer, t, lang, "2016")
  await dealer.getByRole("button", { name: t("post.promo_skip") }).click()
  await expect(dealer.getByText(t("post.promo_title"))).toHaveCount(0)
  expect(promotions).toEqual([])
})
