import { expect, khartoum, pick, signUp, test, visit } from "./fixtures"

test("J4 post signed out, sign up at the photos step, admin approves, saved search alert @en", async ({
  page,
  t,
  at,
  as,
  lang,
}) => {
  const title = "Toyota Corolla 2015 journey test"
  const district = { ar: "العمارات", en: "Amarat" }
  const make = lang === "ar" ? "تويوتا" : "Toyota"
  const model = lang === "ar" ? "كورولا" : "Corolla"
  // Vehicle cards and pages name the car by make, model and year; the typed title goes in alerts and shares.
  const shown = `${make} ${model} 2015`

  // A buyer watches cars for sale in Khartoum.
  const buyer = await as("user")
  await visit(buyer, at("/vehicles/cars/sale/khartoum"))
  await buyer.getByRole("button", { name: t("search.save") }).click()
  await expect(buyer.getByText(t("search.saved")).first()).toBeVisible()

  // Any promotion call would be a failure: a pending listing gets none.
  const promotions: Array<string> = []
  page.on("request", (r) => {
    if (r.method() === "POST" && /\/api\/.*promot/.test(r.url()))
      promotions.push(r.url())
  })

  await visit(page, at("/post"))
  const next = page.getByRole("button", { name: t("common.next") })
  const chip = (role: "radio" | "checkbox", name: string) =>
    page
      .locator("label")
      .filter({ has: page.getByRole(role, { name, exact: true }) })
  await chip("radio", lang === "ar" ? "سيارة" : "Car").click()
  await next.click()

  await expect(page).toHaveURL(/step=details/)
  await pick(page, t("form.make"), make)
  await pick(page, t("form.model"), model)
  await pick(page, t("form.year"), "2015")
  await pick(page, t("form.fuel"), t("fuel.petrol"))
  await pick(page, t("form.transmission"), t("transmission.automatic"))
  await page.getByRole("textbox", { name: t("form.mileage") }).fill("120000")
  await page.getByLabel(t("form.title")).fill(title)
  await expect(page.getByLabel(t("form.title"))).toHaveValue(title)
  await page
    .getByLabel(t("form.description"))
    .fill(
      "A clean car in very good condition, one owner, service history kept."
    )
  await page.getByLabel(t("form.price")).first().fill("15000000")
  await next.click()

  await expect(page).toHaveURL(/step=photos/)
  // Uploads need an account (owner, 2026-11-01): the photos step asks for one first, and keeps what was typed.
  await page.getByRole("button", { name: t("common.sign_in") }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByText(t("auth.reason_photos"))).toBeVisible()
  await dialog.getByRole("button", { name: t("auth.create_account") }).click()
  await signUp(dialog, t, {
    name: "Journey Seller",
    email: "seller@journey.sy",
  })
  await dialog.getByRole("button", { name: t("common.continue") }).click()
  await expect(dialog).toBeHidden()

  await page
    .locator("input[type=file][accept*=image]")
    .first()
    .setInputFiles(
      ["banner-1", "banner-2", "banner-3"].map((n) => `public/mock/${n}.webp`)
    )
  // Next waits until the three uploads have finished.
  await expect(async () => {
    await next.click()
    await expect(page).toHaveURL(/step=contact/, { timeout: 1500 })
  }).toPass({ timeout: 20_000 })

  await pick(page, t("form.city"), khartoum[lang])
  await pick(page, t("form.district"), district[lang])
  await page.getByRole("textbox", { name: t("form.phone") }).fill("912345699")
  await next.click()

  await expect(page).toHaveURL(/step=review/)
  await expect(page.getByRole("heading", { name: shown })).toBeVisible()
  const publish = page.getByRole("button", { name: t("post.publish") })

  // A new account gives its name and city on the review screen, then publishes.
  await page.getByLabel(t("auth.full_name_label")).fill("Journey Seller")
  await pick(page, t("form.city"), khartoum[lang])
  await publish.click()

  await expect(page).toHaveURL(/step=done/)
  await expect(page.getByText(t("post.done_pending_title"))).toBeVisible()
  await expect(
    page.getByText(t("listing.promote_after_approval"))
  ).toBeVisible()
  await expect(page.getByText(t("post.promo_title"))).toHaveCount(0)
  expect(promotions).toEqual([])

  // The admin approves it.
  const admin = await as("admin")
  await visit(admin, at("/admin/moderation"))
  const row = admin.getByRole("button", {
    name: new RegExp(`^${shown} .*Journey Seller`),
  })
  await row.click()
  await admin
    .locator("main")
    .getByRole("button", { name: t("admin.approve"), exact: true })
    .click()
  await admin
    .getByRole("alertdialog")
    .getByRole("button", { name: t("admin.approve") })
    .click()
  await expect(admin.getByText(t("admin.listing_approved"))).toBeVisible()
  await expect(row).toHaveCount(0)

  // The buyer's saved search raised an alert, and it opens the live public page.
  await visit(buyer, at("/account/notifications"))
  await buyer.getByText(title).first().click()
  await expect(buyer).toHaveURL(/\/listing\//)
  await expect(buyer.locator("h1")).toHaveText(shown)
})
