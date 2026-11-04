import { beforeEach, describe, expect, test } from "bun:test"
import { verifyPassword } from "better-auth/crypto"
import { asc, eq, sql } from "drizzle-orm"

import { account, user } from "~/modules/auth/auth.tables"
import { specializations } from "~/modules/taxonomy/taxonomy.tables"
import { uploads } from "~/modules/uploads/uploads.tables"
import { db } from "~/shared/db/client"

import { buildSeed, resetDb } from "../../../tests/helpers"
import {
  dealerships,
  mechanicCities,
  mechanics,
  portfolioItems,
  workshopImages,
  workshops,
} from "./businesses.tables"

const seeded = buildSeed()

beforeEach(resetDb)

describe("user and business tables", () => {
  test("hold every mock account and business", async () => {
    expect(await db.$count(user)).toBe(seeded.users.length)
    expect(await db.$count(account)).toBe(seeded.users.length)
    expect(await db.$count(dealerships)).toBe(seeded.dealerships.length)
    expect(await db.$count(workshops)).toBe(seeded.workshops.length)
    expect(await db.$count(mechanics)).toBe(seeded.mechanics.length)
    expect(await db.$count(portfolioItems)).toBe(
      seeded.mechanics.reduce((n, m) => n + m.portfolio.length, 0)
    )
  })

  test("sign demo accounts in with the demo password", async () => {
    const [row] = await db
      .select({ hash: account.password })
      .from(account)
      .where(eq(account.userId, "u-omar"))
    expect(
      await verifyPassword({ hash: row?.hash ?? "", password: "Demo1234" })
    ).toBe(true)
  })

  test("keep the mock's photo and city order", async () => {
    const workshop = seeded.workshops[0]
    const mechanic = seeded.mechanics[1]
    const images = await db
      .select({ id: workshopImages.uploadId, url: uploads.url })
      .from(workshopImages)
      .innerJoin(uploads, eq(uploads.id, workshopImages.uploadId))
      .where(eq(workshopImages.workshopId, workshop?.id ?? ""))
      .orderBy(asc(workshopImages.position))
    expect(images).toEqual(
      workshop?.images.map(({ id, url }) => ({ id, url })) ?? []
    )
    const served = await db
      .select({ id: mechanicCities.cityId })
      .from(mechanicCities)
      .where(eq(mechanicCities.mechanicId, mechanic?.id ?? ""))
      .orderBy(asc(mechanicCities.position))
    expect(served.map((row) => row.id)).toEqual(mechanic?.servedCityIds ?? [])
  })

  test("refuse to delete a specialization a mechanic uses", async () => {
    const used = seeded.mechanics[0]?.specializationIds[0] ?? ""
    const error = await db
      .delete(specializations)
      .where(eq(specializations.id, used))
      .catch((error) => error)
    expect(error.cause.errno).toBe("23503")
  })

  test("drop a deleted account's business and keep its uploads ownerless", async () => {
    await db.delete(user).where(eq(user.id, "u-workshop"))
    expect(
      await db.$count(workshops, eq(workshops.ownerUserId, "u-workshop"))
    ).toBe(0)
    const logo = await db
      .select({ owner: uploads.ownerUserId })
      .from(uploads)
      .where(eq(uploads.id, "up-w-1-logo"))
    expect(logo).toEqual([{ owner: null }])
  })

  test("refuse a shared phone, an uppercase email and an upload with two sources", async () => {
    const taken = await db
      .update(user)
      .set({ phone: "+249912345601" })
      .where(eq(user.id, "u-dealer"))
      .catch((error) => error)
    expect(taken.cause.errno).toBe("23505")
    const upper = await db
      .update(user)
      .set({ email: "Omar@Demo.sy" })
      .where(eq(user.id, "u-omar"))
      .catch((error) => error)
    expect(upper.cause.constraint).toBe("user_email_lower")
    const both = await db
      .execute(
        sql`insert into uploads (id, kind, delivery, cloudinary_id, url, created_at) values ('x', 'image', 'public', 'a', '/b', now())`
      )
      .catch((error) => error)
    expect(both.cause.constraint).toBe("uploads_one_source")
  })
})
