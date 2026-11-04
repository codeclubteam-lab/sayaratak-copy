import { expect, test, visit } from "./fixtures"
import type { Page } from "@playwright/test"

// A listing of the demo dealership.
const listing = "/listing/chevrolet-cruze-2014-single-owner-khartoum-l0000p"

test("J9 report, admin removes the listing and bans the seller, seller cannot sign in, admin unbans", async ({
  page: seller,
  as,
  t,
  at,
  lang,
}) => {
  const shown = { ar: "شيفروليه كروز 2014", en: "Chevrolet Cruze 2014" }[lang]
  const signIn = async (page: Page) => {
    await visit(page, at("/auth/login"))
    const form = page.locator("main")
    await form.getByLabel(t("auth.email_label")).fill("dealer@demo.sy")
    await form
      .getByLabel(t("auth.password_label"), { exact: true })
      .fill("Demo1234")
    await form.getByRole("button", { name: t("auth.login_submit") }).click()
  }

  // A buyer reports the listing.
  const buyer = await as("user")
  await visit(buyer, at(listing))
  await buyer
    .getByRole("button", { name: t("listing.report") })
    .locator("visible=true")
    .first()
    .click()
  const report = buyer.getByRole("dialog")
  await report
    .locator("label")
    .filter({ hasText: t("listing.report_scam") })
    .click()
  await report.getByRole("button", { name: t("listing.report_send") }).click()
  await expect(buyer.getByText(t("toast.report_sent"))).toBeVisible()

  // The admin removes it from the report.
  const admin = await as("admin")
  await visit(admin, at("/admin/reports"))
  await admin
    .locator("main")
    .getByRole("button", { name: shown })
    .locator("visible=true")
    .first()
    .click()
  const sheet = admin.getByRole("dialog")
  await sheet
    .getByRole("button", { name: t("admin.report_remove_listing") })
    .click()
  await admin
    .getByRole("alertdialog")
    .getByRole("button")
    .filter({ hasText: t("common.remove") })
    .click()
  await expect(admin.getByText(t("admin.listing_removed"))).toBeVisible()
  await visit(buyer, at(listing))
  await expect(buyer.locator("h1")).not.toHaveText(shown)

  // And bans the seller.
  const openSeller = async () => {
    await visit(admin, at("/admin/users"))
    await admin.getByRole("searchbox").fill("Al Nasr Motors")
    await admin
      .locator("main")
      .getByRole("button", { name: /Al Nasr Motors/ })
      .locator("visible=true")
      .first()
      .click()
    return admin.getByRole("dialog")
  }
  let user = await openSeller()
  await user.getByRole("button", { name: t("admin.ban"), exact: true }).click()
  const ban = admin.getByRole("dialog").last()
  await ban
    .getByLabel(t("admin.reason"))
    .fill("Fake listings reported by buyers")
  await ban.getByRole("button", { name: t("admin.ban"), exact: true }).click()
  await expect(admin.getByText(t("admin.user_banned_toast"))).toBeVisible()

  await signIn(seller)
  await expect(seller.getByText(t("auth.account_suspended"))).toBeVisible()
  await expect(seller).toHaveURL(/\/auth\/login/)

  // The admin lifts the ban; the seller signs in again.
  user = await openSeller()
  await user.getByRole("button", { name: t("admin.unban") }).click()
  await admin
    .getByRole("alertdialog")
    .getByRole("button", { name: t("admin.unban") })
    .click()
  await expect(admin.getByText(t("admin.user_unbanned_toast"))).toBeVisible()

  await signIn(seller)
  await expect(seller).toHaveURL(new RegExp(`${at("/dealer")}$`))
})
