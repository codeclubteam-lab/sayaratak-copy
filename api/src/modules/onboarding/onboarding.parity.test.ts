import { describe, test } from "bun:test"

import { bothSessions, resetDb } from "../../../tests/helpers"
import { expectParity } from "../../../tests/parity"

const ORIGIN = "http://localhost:3000"

// Every role finishes onboarding on a fresh seed, on both sides, with what the web's forms send.
async function complete(role: string, payload: object) {
  await resetDb()
  const { cookie } = await bothSessions("new")
  await expectParity("/api/v1/onboarding/complete", {
    init: {
      method: "POST",
      headers: { cookie, origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({ role, payload }),
    },
  })
}

describe("POST /onboarding/complete matches the mock", () => {
  test("a dealership with a paid pick", async () => {
    await complete("dealership", {
      name: "Al Nour Motors",
      description: "Used cars bought and sold in Khartoum since 2010.",
      cityId: "khartoum",
      districtId: "khartoum-riyadh",
      address: "Africa Street",
      location: { lat: 15.55, lng: 32.53 },
      phones: [{ value: "+249912345678" }],
      whatsapp: "",
      planId: "plan-dealer-growth",
    })
  })

  test("a workshop and a mechanic", async () => {
    await complete("workshop", {
      name: "Quick Fix",
      cityId: "khartoum",
      phone: "+249912345678",
      services: [{ name: "Oil change", priceFrom: 15000, templateId: null }],
      planId: "plan-workshop-plus",
    })
    await complete("mechanic", {
      name: "Hassan",
      cityId: "khartoum",
      phone: "+249912345678",
      specializationIds: ["engine"],
      planId: "plan-mechanic-plus",
    })
  })

  test("an individual, with a plan of another audience ignored", async () => {
    await complete("user", {
      fullName: "Omar Ali",
      cityId: "omdurman",
      interests: ["cars"],
      planId: "plan-dealer-growth",
    })
  })
})
