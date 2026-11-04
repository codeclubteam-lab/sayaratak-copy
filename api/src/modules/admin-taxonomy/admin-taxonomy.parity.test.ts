import { afterAll, beforeAll, describe, test } from "bun:test"
import { taxonomyTypeSchema } from "@sayaratak/shared/schemas/api"

import { bothSessions, resetDb } from "../../../tests/helpers"
import { expectParity } from "../../../tests/parity"
import { dongola, eritrea } from "../../../tests/taxonomy"

// One admin sign-in for the whole file: the emailed code is capped per address.
let headers: Record<string, string> = {}

beforeAll(async () => {
  await resetDb()
  headers = {
    ...(await bothSessions("admin")),
    origin: "http://localhost:3000",
    "content-type": "application/json",
  }
})

// The mock's rows live for the whole run, so what the writes below change is put back.
afterAll(async () => {
  const { handleMock } = await import("../../../../web/src/mocks/router")
  await handleMock(
    new Request("http://localhost/api/mock/reset", { method: "POST" })
  )
  await resetDb()
})

// A district or model made here gets a random id on each side.
const sameIds = (body: unknown) =>
  JSON.parse(
    JSON.stringify(body).replace(/"(dis|mod)-[A-Za-z0-9_-]{8}"/g, '"$1-new"')
  )

const read = (path: string) =>
  expectParity(path, { init: { headers }, ignore: sameIds })
const write = (method: string, path: string, body?: unknown) =>
  expectParity(`/api/v1/admin/taxonomy/${path}`, {
    ignore: sameIds,
    init: {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  })

describe("GET /admin/taxonomy/:type matches the mock", () => {
  test("every list, and an unknown one", async () => {
    for (const type of [...taxonomyTypeSchema.options, "nope"])
      await read(`/api/v1/admin/taxonomy/${type}`)
  })
})

describe("the taxonomy writes match the mock", () => {
  test("add: each list, a taken slug, a taken code and bad bodies", async () => {
    await write("POST", "cities", dongola)
    await write("POST", "cities", dongola)
    await write("POST", "cities", { name: dongola.name })
    await write("POST", "districts", {
      cityId: "khartoum",
      name: { ar: "ح", en: "H" },
    })
    await write("POST", "makes", {
      name: { ar: "شيري", en: "Chery" },
      vehicleTypes: ["car"],
    })
    await write("POST", "makes", {
      name: { ar: "ش", en: "C" },
      vehicleTypes: [],
    })
    await write("POST", "models", {
      makeId: "toyota",
      name: { ar: "م", en: "M" },
    })
    await write("POST", "part-categories", {
      name: { ar: "زجاج", en: "Glass" },
    })
    await write("POST", "countries", eritrea)
    await write("POST", "countries", { ...eritrea, code: "sd" })
    await write("POST", "countries", { ...eritrea, dialCode: "291" })
    await write("POST", "vehicle-types", {})
    await write("POST", "nope", {})
    await read("/api/v1/admin/taxonomy/cities")
    await read("/api/v1/admin/taxonomy/countries")
  })

  test("edit: names, centers, flags, the last shown and unknown entries", async () => {
    await write("PATCH", "cities/omdurman", {
      name: { ar: "أم درمان!", en: "Omdurman!" },
      center: { lat: 15.7, lng: 32.5 },
    })
    await write("PATCH", "districts/khartoum-riyadh", {
      name: { ar: "ر", en: "R" },
    })
    await write("PATCH", "makes/toyota", { vehicleTypes: ["car", "truck"] })
    await write("PATCH", "models/ford-ranger", { name: { ar: "ر", en: "R" } })
    await write("PATCH", "part-categories/engine", {
      name: { ar: "م", en: "E" },
    })
    await write("PATCH", "countries/eg", { enabled: true, dialCode: "+20" })
    await write("PATCH", "countries/sd", { enabled: false })
    await write("PATCH", "countries/sd", { dialCode: "249" })
    await write("PATCH", "vehicle-types/truck", {
      name: { ar: "ش", en: "T" },
      enabled: false,
    })
    await write("PATCH", "cities/khartoum", {})
    await write("PATCH", "cities/nope", { name: { ar: "ا", en: "A" } })
    await read("/api/v1/admin/taxonomy/vehicle-types")
  })

  test("last shown: hiding every vehicle type but one, then the last", async () => {
    for (const id of ["car", "motorcycle", "tuk_tuk", "rickshaw"])
      await write("PATCH", `vehicle-types/${id}`, { enabled: false })
    await write("PATCH", "vehicle-types/truck", { enabled: false })
  })

  test("delete: in use, fixed, unknown and free to go", async () => {
    for (const path of [
      "cities/khartoum",
      "makes/toyota",
      "countries/sd",
      "vehicle-types/car",
      "cities/nope",
      "countries/eg",
      "districts/nyala-market",
      "models/ford-ranger",
    ])
      await write("DELETE", path)
    await read("/api/v1/admin/taxonomy/districts")
  })
})
