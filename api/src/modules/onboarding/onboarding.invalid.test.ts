import { beforeEach, describe, expect, test } from "bun:test"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { user } from "~/modules/auth/auth.tables"
import { uploads } from "~/modules/uploads/uploads.tables"

import { resetDb, signIn } from "../../../tests/helpers"
import {
  complete,
  dealerPayload,
  mine,
  NEW_ID,
  upload,
} from "../../../tests/onboarding"

beforeEach(resetDb)

describe("a bad payload", () => {
  test("returns 422 on an unknown city or district and creates nothing", async () => {
    const visitor = await signIn("new")
    const city = await complete(visitor, "dealership", {
      ...dealerPayload,
      cityId: "atlantis",
    })
    expect(city.status).toBe(422)
    expect(await city.json()).toMatchObject({
      fields: { cityId: "validation.required" },
    })
    const district = await complete(visitor, "dealership", {
      ...dealerPayload,
      districtId: "omdurman-other",
    })
    expect(await district.json()).toMatchObject({
      fields: { districtId: "validation.required" },
    })
    expect(await mine.dealership()).toHaveLength(0)
    const [me] = await db.select().from(user).where(eq(user.id, NEW_ID))
    expect(me).toMatchObject({ onboardingDone: false, role: "user" })
  })

  test("returns 422 on an invalid phone, hours or name", async () => {
    const visitor = await signIn("new")
    const phone = await complete(visitor, "workshop", {
      name: "Quick Fix",
      cityId: "khartoum",
      phone: "0912345678",
    })
    expect(await phone.json()).toMatchObject({
      fields: { phone: "validation.phone" },
    })
    const name = await complete(visitor, "workshop", {
      name: "   ",
      cityId: "khartoum",
      phone: "+249912345678",
    })
    expect(await name.json()).toMatchObject({
      fields: { name: "validation.required" },
    })
    const hours = await complete(visitor, "workshop", {
      name: "Quick Fix",
      cityId: "khartoum",
      phone: "+249912345678",
      hours: [{ day: 0, closed: false, open: "09:00", close: "08:00" }],
    })
    expect(hours.status).toBe(422)
  })

  test("returns 422 on a picture that is not the account's own unused image, and rolls back", async () => {
    const visitor = await signIn("new")
    const other = await signIn("user")
    const theirs = await upload(other)
    const res = await complete(visitor, "dealership", {
      ...dealerPayload,
      coverId: theirs,
    })
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({
      fields: { coverId: "validation.required" },
    })
    const unknown = await complete(visitor, "dealership", {
      ...dealerPayload,
      logoId: "up-nope",
    })
    expect(await unknown.json()).toMatchObject({
      fields: { logoId: "validation.required" },
    })
    expect(await mine.dealership()).toHaveLength(0)
    const [file] = await db.select().from(uploads).where(eq(uploads.id, theirs))
    expect(file?.attachedAt).toBeNull()
  })

  test("refuses one upload used as both logo and cover", async () => {
    const visitor = await signIn("new")
    const id = await upload(visitor)
    const res = await complete(visitor, "dealership", {
      ...dealerPayload,
      logoId: id,
      coverId: id,
    })
    expect(res.status).toBe(422)
  })
})
