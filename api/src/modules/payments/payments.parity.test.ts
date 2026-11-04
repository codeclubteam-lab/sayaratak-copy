import { afterAll, beforeAll, describe, test } from "bun:test"

import { fileOf } from "../../../tests/files"
import {
  bothSessions,
  DEMO_ACCOUNTS,
  type DemoAccount,
  resetDb,
} from "../../../tests/helpers"
import { expectParity } from "../../../tests/parity"

beforeAll(resetDb)
afterAll(resetDb)

const headers = async (who: DemoAccount | null) =>
  who ? await bothSessions(who) : {}
// Both sides serve a receipt from their own address.
const withoutReceiptUrl = (body: unknown) =>
  JSON.parse(
    JSON.stringify(body, (key, value) => (key === "receiptUrl" ? "" : value))
  )

describe("GET /me/payments matches the mock", () => {
  test("every account, a later page and signed out", async () => {
    for (const who of DEMO_ACCOUNTS) {
      await expectParity("/api/v1/me/payments", {
        init: { headers: await headers(who) },
        ignore: withoutReceiptUrl,
      })
      await expectParity("/api/v1/me/payments?page=2&pageSize=1", {
        init: { headers: await headers(who) },
        ignore: withoutReceiptUrl,
      })
    }
    await expectParity("/api/v1/me/payments")
  })
})

// Seed: u-omar has pay-1 (plan-user-plus) and pay-3 (promo-53) under review; u-dealer pay-2 and pay-5
// (promo-54); camp-1 is u-dealer's and approved, camp-2 u-workshop's and under review.
describe("GET /checkout matches the mock", () => {
  test("plans, promotions and campaigns, mine, someone else's and unknown", async () => {
    const items: [DemoAccount | null, string][] = [
      ["user", "plan:plan-user-plus"],
      ["user", "plan:plan-user-free"],
      ["user", "plan:plan-dealer-growth"],
      ["user", "promotion:promo-53"],
      ["user", "promotion:promo-54"],
      ["dealership", "plan:plan-dealer-pro"],
      ["dealership", "promotion:promo-54"],
      ["dealership", "campaign:camp-1"],
      ["workshop", "campaign:camp-2"],
      ["workshop", "campaign:camp-1"],
      ["workshop", "plan:plan-workshop-plus:extra"],
      ["workshop", "plan:nope"],
      ["workshop", "gift:x"],
      ["workshop", ""],
      [null, "plan:plan-workshop-plus"],
    ]
    for (const [who, item] of items)
      await expectParity(`/api/v1/checkout?item=${encodeURIComponent(item)}`, {
        init: { headers: await headers(who) },
      })
    await expectParity("/api/v1/checkout", {
      init: { headers: await headers("user") },
    })
  })
})

const send = async (
  who: DemoAccount | null,
  fields: Record<string, string>,
  receipt: File | null = fileOf("jpeg")
) => {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.set(key, value)
  if (receipt) form.set("receipt", receipt)
  return expectParity("/api/v1/payments", {
    init: {
      method: "POST",
      headers: { ...(await headers(who)), origin: "http://localhost:3000" },
      body: form,
    },
  })
}
const valid = {
  itemType: "plan",
  itemId: "plan-workshop-plus",
  payerName: "Ali Hassan",
  transactionRef: "TX12345",
}

describe("POST /payments answers as the mock does when it fails", () => {
  test("signed out, bad fields, no receipt", async () => {
    await send(null, valid)
    await send("workshop", {})
    await send("workshop", { ...valid, itemType: "gift" })
    await send("workshop", { ...valid, payerName: " a ", transactionRef: "12" })
    await send("workshop", valid, null)
  })

  test("unknown, foreign, paid and already waiting items", async () => {
    await send("workshop", { ...valid, itemId: "nope" })
    await send("workshop", { ...valid, itemId: "" })
    await send("workshop", { ...valid, itemId: "plan-dealer-pro" })
    await send("user", { ...valid, itemId: "plan-user-plus" })
    await send("dealership", {
      ...valid,
      itemType: "promotion",
      itemId: "promo-53",
    })
    await send("dealership", {
      ...valid,
      itemType: "promotion",
      itemId: "promo-1",
    })
    await send("dealership", {
      ...valid,
      itemType: "campaign",
      itemId: "camp-1",
    })
    await send("user", { ...valid, itemType: "campaign", itemId: "camp-1" })
    await send("user", { ...valid, itemType: "campaign", itemId: "camp-99" })
  })

  test("a receipt over 5 MB", async () => {
    await send("workshop", valid, fileOf("jpeg", { size: 5 * 1024 * 1024 + 1 }))
  })
})
