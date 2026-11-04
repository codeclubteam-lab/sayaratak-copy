import { beforeEach, describe, expect, test } from "bun:test"
import { userSchema } from "@sayaratak/shared/schemas/user"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { user } from "~/modules/auth/auth.tables"
import { dealerships } from "~/modules/businesses/businesses.tables"
import { subscriptions } from "~/modules/plans/plans.tables"

import { expectSchema, req, resetDb, signIn } from "../../../tests/helpers"
import {
  complete,
  dealerPayload,
  mine,
  NEW_ID,
  upload,
} from "../../../tests/onboarding"

beforeEach(resetDb)

describe("POST /onboarding/complete access", () => {
  test("returns 401 signed out, 403 for an admin and 403 banned for a banned account", async () => {
    const out = await req("/onboarding/complete", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
      body: JSON.stringify({ role: "workshop", payload: {} }),
    })
    expect(out.status).toBe(401)
    const admin = await complete(await signIn("admin"), "workshop")
    expect(admin.status).toBe(403)
    expect(await admin.json()).toMatchObject({ code: "forbidden" })
    const visitor = await signIn("new")
    await db.update(user).set({ banned: true }).where(eq(user.id, NEW_ID))
    const banned = await complete(visitor, "workshop")
    expect(banned.status).toBe(403)
    expect(await banned.json()).toMatchObject({ code: "banned" })
  })

  test("returns 422 on a role that is not allowed", async () => {
    const res = await complete(await signIn("new"), "admin")
    expect(res.status).toBe(422)
  })
})

describe("an individual", () => {
  test("takes the name, city, interests and photo, and starts no plan", async () => {
    const visitor = await signIn("new")
    const avatarId = await upload(visitor)
    const res = await complete(visitor, "user", {
      fullName: "Omar Ali",
      cityId: "omdurman",
      interests: ["cars", "parts", "not-an-interest"],
      avatarId,
    })
    expect(res.status).toBe(200)
    const me = await expectSchema(res, userSchema)
    expect(me).toMatchObject({
      role: "user",
      fullName: "Omar Ali",
      cityId: "omdurman",
      onboardingDone: true,
      interests: [],
    })
    expect(me.avatarUrl).toBeString()
    const subs = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, NEW_ID))
    expect(subs).toHaveLength(0)
  })

  test("keeps readable interests and a paid pick of its own audience", async () => {
    const res = await complete(await signIn("new"), "user", {
      cityId: "khartoum",
      interests: ["cars"],
      planId: "plan-user-plus",
    })
    expect(await res.json()).toMatchObject({
      fullName: "New Visitor",
      interests: ["cars"],
      chosenPlanId: "plan-user-plus",
    })
  })
})

describe("the paid pick", () => {
  test("ignores a free plan, a plan of another audience and an unknown id", async () => {
    for (const planId of [
      "plan-dealer-starter",
      "plan-workshop-plus",
      "nope",
    ]) {
      await resetDb()
      const res = await complete(await signIn("new"), "dealership", {
        ...dealerPayload,
        planId,
      })
      expect(res.status).toBe(200)
      expect(await res.json()).not.toHaveProperty("chosenPlanId")
    }
  })
})

describe("onboarding twice", () => {
  test("returns 409 conflict for a second call, whatever the role, and creates nothing more", async () => {
    const visitor = await signIn("new")
    expect((await complete(visitor, "dealership", dealerPayload)).status).toBe(
      200
    )
    const again = await complete(visitor, "workshop", {
      name: "Quick Fix",
      cityId: "khartoum",
      phone: "+249912345678",
    })
    expect(again.status).toBe(409)
    expect(await again.json()).toMatchObject({ code: "conflict" })
    expect(await mine.workshop()).toHaveLength(0)
    const [me] = await db.select().from(user).where(eq(user.id, NEW_ID))
    expect(me?.role).toBe("dealership")
  })

  test("returns 409 for an account that finished onboarding at sign up", async () => {
    const res = await complete(
      await signIn("user"),
      "dealership",
      dealerPayload
    )
    expect(res.status).toBe(409)
  })

  test("lets only one of two parallel calls through", async () => {
    const visitor = await signIn("new")
    const [a, b] = await Promise.all([
      complete(visitor, "dealership", dealerPayload),
      complete(visitor, "dealership", dealerPayload),
    ])
    expect([a.status, b.status].sort()).toEqual([200, 409])
    expect(
      await db
        .select()
        .from(dealerships)
        .where(eq(dealerships.ownerUserId, NEW_ID))
    ).toHaveLength(1)
    expect(
      await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, NEW_ID))
    ).toHaveLength(1)
  })
})
