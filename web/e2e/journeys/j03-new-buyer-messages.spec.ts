import { expect, khartoum, pick, signUp, test, visit } from "./fixtures"

// A listing of the demo dealership.
const listing = "/listing/chevrolet-cruze-2014-single-owner-khartoum-l0000p"

test("J3 new buyer signs up, messages a seller, gets the reply", async ({
  page,
  t,
  at,
  as,
  lang,
}) => {
  const buyer = "Journey Buyer"
  const question = "Is the Cruze still available?"
  const answer = "Yes, come by the showroom tomorrow."

  await visit(page, at("/auth/signup"))
  await signUp(page.locator("main"), t, {
    name: buyer,
    email: "buyer@journey.sy",
  })
  // A new account sets up its profile before its dashboard opens.
  await page.getByRole("button", { name: t("common.continue") }).click()
  await page
    .locator("label")
    .filter({
      has: page.getByRole("radio", { name: t("onboarding.role_user_title") }),
    })
    .click()
  await page.getByRole("button", { name: t("common.continue") }).click()
  await pick(page, t("form.city"), khartoum[lang])
  await page.getByRole("button", { name: t("onboarding.finish_user") }).click()
  await expect(page).toHaveURL(new RegExp(`${at("/account")}\\?welcome=1$`))

  await visit(page, at(listing))
  await page
    .getByRole("button", { name: t("listing.message"), exact: true })
    .locator("visible=true")
    .first()
    .click()
  const compose = page.getByRole("dialog")
  await compose.getByLabel(t("listing.message_label")).fill(question)
  await compose.getByRole("button", { name: t("listing.message_send") }).click()
  await expect(page.getByText(t("toast.message_sent"))).toBeVisible()

  // The seller finds it in the inbox and answers.
  const seller = await as("dealer")
  await seller.goto(at("/dealer/messages"))
  await seller.getByText(buyer).first().click()
  await expect(seller.getByRole("log").getByText(question)).toBeVisible()
  await seller.getByLabel(t("messages.composer_label")).fill(answer)
  await seller.getByRole("button", { name: t("messages.send") }).click()
  await expect(seller.getByRole("log").getByText(answer)).toBeVisible()

  // The buyer reads the answer in the same thread.
  await page.goto(at("/account/messages"))
  // The thread list previews the last message, the answer.
  await page.getByText(answer).first().click()
  await expect(page.getByRole("log").getByText(question)).toBeVisible()
  await expect(page.getByRole("log").getByText(answer)).toBeVisible()
})
