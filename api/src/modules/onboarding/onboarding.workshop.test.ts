import { beforeEach, describe, expect, test } from "bun:test"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import {
  mechanicCities,
  mechanicSpecializations,
  workshopServices,
} from "~/modules/businesses/businesses.tables"
import { subscriptions } from "~/modules/plans/plans.tables"

import { resetDb, signIn } from "../../../tests/helpers"
import { complete, mine, NEW_ID } from "../../../tests/onboarding"

beforeEach(resetDb)

describe("a workshop", () => {
  test("keeps its services in order, with a deleted template read as custom", async () => {
    const visitor = await signIn("new")
    const res = await complete(visitor, "workshop", {
      name: "Quick Fix",
      cityId: "khartoum",
      phone: "+249912345678",
      whatsapp: "+249911111111",
      services: [
        { name: "Oil change", priceFrom: 15000, templateId: "oil-change" },
        { name: "Wash", priceFrom: null, templateId: "gone-template" },
        { name: "Polish" },
      ],
      planId: "plan-workshop-plus",
    })
    expect(res.status).toBe(200)
    const [shop] = await mine.workshop()
    expect(shop).toMatchObject({
      phone: "+249912345678",
      whatsapp: "+249911111111",
      districtId: null,
    })
    const rows = await db
      .select()
      .from(workshopServices)
      .where(eq(workshopServices.workshopId, shop?.id ?? ""))
      .orderBy(workshopServices.position)
    expect(rows.map((r) => [r.name, r.priceFrom, r.templateId])).toEqual([
      ["Oil change", 15000, "oil-change"],
      ["Wash", null, null],
      ["Polish", null, null],
    ])
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, NEW_ID))
    expect(sub?.planId).toBe("plan-workshop-basic")
  })

  test("stores a price above the 32-bit limit", async () => {
    const res = await complete(await signIn("new"), "workshop", {
      name: "Big Jobs",
      cityId: "khartoum",
      phone: "+249912345678",
      services: [{ name: "Engine rebuild", priceFrom: 5_000_000_000 }],
    })
    expect(res.status).toBe(200)
    const [shop] = await mine.workshop()
    const [row] = await db
      .select()
      .from(workshopServices)
      .where(eq(workshopServices.workshopId, shop?.id ?? ""))
    expect(row?.priceFrom).toBe(5_000_000_000)
  })
})

describe("a mechanic", () => {
  test("keeps the home city first, drops unknown skills and cities", async () => {
    const res = await complete(await signIn("new"), "mechanic", {
      name: "Hassan",
      bio: "Twelve years on Japanese engines.",
      cityId: "khartoum",
      phone: "+249912345678",
      yearsOfExperience: 12,
      servedCityIds: ["omdurman", "nowhere", "khartoum"],
      specializationIds: ["engine", "no-such-skill", "ac"],
      planId: "plan-mechanic-plus",
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      role: "mechanic",
      chosenPlanId: "plan-mechanic-plus",
    })
    const [row] = await mine.mechanic()
    expect(row).toMatchObject({ yearsOfExperience: 12, available: true })
    const cities = await db
      .select()
      .from(mechanicCities)
      .where(eq(mechanicCities.mechanicId, row?.id ?? ""))
      .orderBy(mechanicCities.position)
    expect(cities.map((c) => c.cityId)).toEqual(["khartoum", "omdurman"])
    const skills = await db
      .select()
      .from(mechanicSpecializations)
      .where(eq(mechanicSpecializations.mechanicId, row?.id ?? ""))
      .orderBy(mechanicSpecializations.position)
    expect(skills.map((s) => s.specializationId)).toEqual(["engine", "ac"])
  })
})
