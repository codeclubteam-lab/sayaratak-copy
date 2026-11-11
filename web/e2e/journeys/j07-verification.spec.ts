import { expect, test, visit } from "./fixtures"

test("J7 workshop sends documents, admin approves, public profile shows the badge", async ({
  page: workshop,
  as,
  signIn,
  t,
  at,
  lang,
}) => {
  const name = { ar: "الأمل لخدمة السيارات", en: "Al Amal Auto Care" }[lang]
  const profile = at("/workshops/al-amal-auto-care")
  const badge = (page: typeof workshop) =>
    page.locator("main").getByText(t("listing.verified"), { exact: true })

  const visitor = await as("user")
  await visit(visitor, profile)
  await expect(visitor.locator("h1")).toHaveText(name)
  await expect(badge(visitor)).toHaveCount(0)

  await signIn("workshop")
  await visit(workshop, at("/workshop/verification"))
  const files = workshop.locator("main input[type=file]")
  // A document's drop zone goes away once its file is in, so the next empty one is first.
  await expect(files).toHaveCount(2)
  await files.first().setInputFiles("public/mock/banner-1.webp")
  await expect(files).toHaveCount(1)
  await files.first().setInputFiles("public/mock/banner-2.webp")
  await expect(files).toHaveCount(0)
  const sent = workshop.waitForResponse(
    (r) =>
      r.url().includes("/api/") && r.request().method() === "POST" && r.ok()
  )
  await workshop.getByRole("button", { name: t("verification.submit") }).click()
  await sent
  await expect(
    workshop.getByRole("button", { name: t("verification.submit") })
  ).toHaveCount(0)

  const admin = await as("admin")
  await visit(admin, at("/admin/verifications"))
  await admin.getByRole("searchbox").fill(name)
  await admin
    .locator("main")
    .getByRole("button", { name })
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
  await expect(admin.getByText(t("admin.verification_approved"))).toBeVisible()

  await visit(visitor, profile)
  await expect(badge(visitor).first()).toBeVisible()
})
