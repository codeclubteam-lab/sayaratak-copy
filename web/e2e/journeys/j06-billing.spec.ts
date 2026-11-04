import { expect, test, visit } from "./fixtures"

test("J6 dealership upgrades by transfer, admin approves, plan and limit change, dealer notified", async ({
  page: dealer,
  as,
  signIn,
  t,
  at,
  lang,
}) => {
  const pro = { ar: "المحترف", en: "Pro" }[lang]
  const transaction = "77665544"

  await signIn("dealer")
  await visit(dealer, at("/dealer/billing"))
  const vehicles = dealer.locator("main").getByRole("meter", {
    name: t("billing.usage_vehicles"),
  })
  await expect(vehicles).toHaveAttribute("aria-valuemax", "80")

  await dealer
    .getByRole("button", { name: t("billing.upgrade_to", { name: pro }) })
    .click()
  await expect(dealer).toHaveURL(/\/dealer\/billing\/checkout/)
  await dealer.getByLabel(t("billing.payer_name")).fill("Al Nasr Motors")
  await dealer.getByLabel(t("billing.transaction_ref")).fill(transaction)
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

  // The admin finds the transfer by its number and approves it.
  const admin = await as("admin")
  await visit(admin, at("/admin/payments"))
  await admin.getByRole("searchbox").fill(transaction)
  await admin
    .locator("main")
    .getByRole("button", { name: /^SY-/ })
    .locator("visible=true")
    .first()
    .click()
  const sheet = admin.getByRole("dialog")
  await sheet.getByRole("button", { name: t("admin.approve") }).click()
  await admin
    .getByRole("alertdialog")
    .getByRole("button", { name: t("admin.approve") })
    .click()
  await expect(admin.getByText(t("admin.payment_approved"))).toBeVisible()

  // The dealer is on Pro with its vehicle limit, and was told.
  await visit(dealer, at("/dealer/billing"))
  await expect(vehicles).toHaveAttribute("aria-valuemax", "300")
  await visit(dealer, at("/dealer/notifications"))
  await expect(
    dealer
      .locator("main")
      .getByText(lang === "ar" ? "تمت الموافقة على الدفع" : "Payment approved")
      .first()
  ).toBeVisible()
})
