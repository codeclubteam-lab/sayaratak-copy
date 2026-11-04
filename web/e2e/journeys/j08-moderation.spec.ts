import { expect, test, visit } from "./fixtures"

// A pending listing of the demo user.
const id = "l0008k"

test("J8 admin rejects with a reason, owner edits and resubmits, admin approves", async ({
  page: owner,
  as,
  signIn,
  t,
  at,
}) => {
  const reason = "The price looks wrong, please check it"

  const admin = await as("admin")
  const review = async () => {
    await visit(admin, at(`/admin/moderation?listing=${id}`))
    return admin.locator("main")
  }
  let queue = await review()
  await queue
    .getByRole("button", { name: t("admin.reject"), exact: true })
    .click()
  const reject = admin.getByRole("dialog")
  await reject.getByLabel(t("admin.reject_label")).fill(reason)
  await reject.getByRole("button", { name: t("admin.reject") }).click()
  await expect(admin.getByText(t("admin.listing_rejected"))).toBeVisible()

  // The owner sees why on the account overview and goes to fix it.
  await signIn("user")
  await visit(owner, at("/account"))
  await expect(owner.getByText(reason).first()).toBeVisible()
  await owner
    .locator(`a[href*="edit=${id}"]`)
    .filter({ hasText: t("dashboard.overview_edit_resubmit") })
    .first()
    .click()
  await expect(owner).toHaveURL(new RegExp(`edit=${id}`))
  await expect(owner.getByRole("status").getByText(reason)).toBeVisible()

  const next = owner.getByRole("button", { name: t("common.next") })
  await next.click()
  await expect(owner).toHaveURL(/step=details/)
  await owner.getByLabel(t("form.price")).first().fill("18500000")
  for (const step of ["photos", "contact", "review"]) {
    await next.click()
    await expect(owner).toHaveURL(new RegExp(`step=${step}`))
  }
  await owner.getByRole("button", { name: t("post.publish") }).click()
  await expect(owner).toHaveURL(/step=done/)
  await expect(owner.getByText(t("post.done_pending_title"))).toBeVisible()

  // Back in the queue, the admin approves the fixed listing.
  queue = await review()
  await queue
    .getByRole("button", { name: t("admin.approve"), exact: true })
    .click()
  await admin
    .getByRole("alertdialog")
    .getByRole("button", { name: t("admin.approve") })
    .click()
  await expect(admin.getByText(t("admin.listing_approved"))).toBeVisible()

  // It is public now, at the new price.
  await visit(owner, at(`/listing/${id}`))
  await expect(
    owner
      .locator("main")
      .getByText(/18,500,000|١٨٬٥٠٠٬٠٠٠/)
      .first()
  ).toBeVisible()
})
