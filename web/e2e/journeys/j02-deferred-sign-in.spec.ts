import { expect, test } from "./fixtures"

const listing = "/listing/chevrolet-cruze-2014-single-owner-khartoum-l0000p"

test("J2 favorite while signed out, sign in, the favorite is saved", async ({
  page,
  t,
  at,
}) => {
  await page.goto(at(listing))
  const title = await page.locator("h1").innerText()
  // Marks this document, so a reload would show.
  await page.evaluate(() => Object.assign(window, { journey: true }))

  const heart = page
    .locator("main")
    .getByRole("button", { name: t("listing.favorite_add") })
    .first()
  await heart.click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  await dialog.getByLabel(t("auth.email_label")).fill("user@demo.sy")
  await dialog
    .getByLabel(t("auth.password_label"), { exact: true })
    .fill("Demo1234")
  await dialog.getByRole("button", { name: t("auth.login_submit") }).click()

  await expect(dialog).toBeHidden()
  await expect(heart).toHaveAttribute("aria-pressed", "true")
  expect(await page.evaluate(() => "journey" in window)).toBe(true)

  await page.goto(at("/account/favorites"))
  await expect(page.locator("main").getByText(title)).toBeVisible()
})
