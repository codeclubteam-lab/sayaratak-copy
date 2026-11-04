import { beforeEach, describe, expect, test } from "bun:test"
import { okSchema } from "@sayaratak/shared/schemas/api"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { user } from "~/modules/auth/auth.tables"

import {
  call,
  DEMO_IDS,
  expectSchema,
  req,
  resetDb,
  type SignedIn,
  signIn,
} from "../../../tests/helpers"
import { devices } from "./devices.tables"

// A real FCM token has a colon, which an app must URL-encode in the path.
const token = "dXk3:APA91bHx-9_example"
const device = {
  platform: "android",
  fcmToken: token,
  appVersion: "1.4.0",
  locale: "ar",
} as const

const register = (as: SignedIn, body: object = device) =>
  call(as, "/me/devices", { method: "POST", body })
const forget = (as: SignedIn, fcmToken = token) =>
  call(as, `/me/devices/${encodeURIComponent(fcmToken)}`, {
    method: "DELETE",
  })
const rows = () => db.select().from(devices)

beforeEach(resetDb)

describe("POST /me/devices", () => {
  test("registers the app's push address for the signed-in account", async () => {
    const buyer = await signIn("user")
    await expectSchema(await register(buyer), okSchema)
    expect(await rows()).toMatchObject([
      {
        userId: DEMO_IDS.user,
        platform: "android",
        fcmToken: token,
        appVersion: "1.4.0",
        locale: "ar",
      },
    ])
  })

  test("moves a token to the account that registers it and refreshes it", async () => {
    const buyer = await signIn("user")
    await register(buyer)
    const [first] = await rows()
    const dealer = await signIn("dealership")
    await register(dealer, { ...device, appVersion: "1.5.0", locale: "en" })
    const all = await rows()
    expect(all).toHaveLength(1)
    expect(all[0]).toMatchObject({
      id: first?.id,
      userId: DEMO_IDS.dealership,
      appVersion: "1.5.0",
      locale: "en",
    })
    expect(all[0]?.lastSeenAt.getTime()).toBeGreaterThanOrEqual(
      first?.lastSeenAt.getTime() ?? 0
    )
  })

  test("two registrations of one token at once leave one row", async () => {
    const buyer = await signIn("user")
    const results = await Promise.all([register(buyer), register(buyer)])
    expect(results.map((res) => res.status)).toEqual([200, 200])
    expect(await rows()).toHaveLength(1)
  })

  test("is 401 signed out and 403 banned", async () => {
    expect(
      (
        await req("/me/devices", {
          method: "POST",
          body: JSON.stringify(device),
        })
      ).status
    ).toBe(401)
    const buyer = await signIn("user")
    await db
      .update(user)
      .set({ banned: true })
      .where(eq(user.id, DEMO_IDS.user))
    expect(await (await register(buyer)).json()).toMatchObject({
      code: "banned",
    })
    expect(await rows()).toHaveLength(0)
  })

  test("is 422 for an unknown platform or locale and an empty token", async () => {
    const buyer = await signIn("user")
    for (const bad of [
      { ...device, platform: "web" },
      { ...device, locale: "fr" },
      { ...device, fcmToken: "" },
      { platform: "ios" },
    ]) {
      const res = await register(buyer, bad)
      expect(res.status).toBe(422)
      expect(await res.json()).toMatchObject({ code: "validation" })
    }
    expect(await rows()).toHaveLength(0)
  })
})

describe("DELETE /me/devices/:fcmToken", () => {
  test("forgets the account's own device, whatever the token's characters", async () => {
    const buyer = await signIn("user")
    await register(buyer)
    await expectSchema(await forget(buyer), okSchema)
    expect(await rows()).toHaveLength(0)
  })

  test("leaves another account's device and an unknown token alone", async () => {
    const buyer = await signIn("user")
    await register(buyer)
    const dealer = await signIn("dealership")
    await expectSchema(await forget(dealer), okSchema)
    await expectSchema(await forget(dealer, "nope"), okSchema)
    expect(await rows()).toHaveLength(1)
  })

  test("is 401 signed out and 403 banned", async () => {
    expect(
      (await req(`/me/devices/${token}`, { method: "DELETE" })).status
    ).toBe(401)
    const buyer = await signIn("user")
    await db
      .update(user)
      .set({ banned: true })
      .where(eq(user.id, DEMO_IDS.user))
    expect(await (await forget(buyer)).json()).toMatchObject({ code: "banned" })
  })
})
