import { beforeEach, describe, expect, test } from "bun:test"
import { userSchema } from "@sayaratak/shared/schemas/user"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { user } from "~/modules/auth/auth.tables"
import { subscriptions } from "~/modules/plans/plans.tables"
import { uploads } from "~/modules/uploads/uploads.tables"

import { expectSchema, resetDb, signIn } from "../../../tests/helpers"
import {
  complete,
  dealerPayload,
  mine,
  NEW_ID,
  upload,
} from "../../../tests/onboarding"

const DAY_MS = 86_400_000

beforeEach(resetDb)

describe("a dealership", () => {
  test("gets its profile, the free plan and the paid pick remembered", async () => {
    const visitor = await signIn("new")
    const logoId = await upload(visitor)
    const res = await complete(visitor, "dealership", {
      ...dealerPayload,
      logoId,
    })
    expect(res.status).toBe(200)
    const me = await expectSchema(res, userSchema)
    expect(me).toMatchObject({
      id: NEW_ID,
      role: "dealership",
      onboardingDone: true,
      cityId: "khartoum",
      chosenPlanId: "plan-dealer-growth",
    })
    const [row] = await mine.dealership()
    expect(row).toMatchObject({
      name: { ar: "Al Nour Motors", en: "Al Nour Motors" },
      cityId: "khartoum",
      districtId: "khartoum-riyadh",
      phones: ["+249912345678", "+249911111111"],
      whatsapp: null,
      lat: 15.55,
      lng: 32.53,
      verified: false,
      status: "active",
      logoUploadId: logoId,
      coverUploadId: null,
    })
    expect(row?.slug).toMatch(/^al-nour-motors-/)
    expect(row?.id).toMatch(/^d-[0-9a-z]{8}$/)
    // Friday (day 5) is closed, the other days open 8:00 to 18:00.
    expect(
      row?.hours.filter((day) => day.closed).map((day) => day.day)
    ).toEqual([5])
  })

  test("starts the free plan with its price and limit, and attaches the logo", async () => {
    const visitor = await signIn("new")
    const logoId = await upload(visitor)
    await complete(visitor, "dealership", { ...dealerPayload, logoId })
    const subs = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, NEW_ID))
    expect(subs).toHaveLength(1)
    expect(subs[0]).toMatchObject({
      planId: "plan-dealer-starter",
      status: "active",
      price: 0,
      listingLimit: 10,
    })
    const days =
      ((subs[0]?.endsAt.getTime() ?? 0) - (subs[0]?.startsAt.getTime() ?? 0)) /
      DAY_MS
    expect(days).toBe(30)
    const [file] = await db.select().from(uploads).where(eq(uploads.id, logoId))
    expect(file?.attachedAt).not.toBeNull()
  })

  test("falls back to the account's city and phone, and 422 when it has neither", async () => {
    const visitor = await signIn("new")
    const empty = await complete(visitor, "dealership", {
      name: "Al Nour",
      phones: [{ value: "+249912345678" }],
    })
    expect(empty.status).toBe(422)
    expect(await empty.json()).toMatchObject({
      code: "validation",
      fields: { cityId: "validation.required" },
    })
    const noPhone = await complete(visitor, "dealership", {
      name: "Al Nour",
      cityId: "khartoum",
    })
    expect(noPhone.status).toBe(422)
    expect(await noPhone.json()).toMatchObject({
      fields: { phones: "validation.phone_min" },
    })
    await db
      .update(user)
      .set({ cityId: "omdurman", phone: "+249900000001" })
      .where(eq(user.id, NEW_ID))
    const ok = await complete(visitor, "dealership", { name: "Al Nour" })
    expect(ok.status).toBe(200)
    const [row] = await mine.dealership()
    expect(row).toMatchObject({ cityId: "omdurman", phones: ["+249900000001"] })
  })
})
