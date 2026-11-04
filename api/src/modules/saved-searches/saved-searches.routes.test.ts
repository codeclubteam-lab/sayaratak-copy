import { beforeEach, describe, expect, test } from "bun:test"
import { okSchema } from "@sayaratak/shared/schemas/api"
import { savedSearchSchema } from "@sayaratak/shared/schemas/saved-search"
import { z } from "zod"

import { db } from "~/shared/db/client"

import {
  call,
  expectSchema,
  req,
  resetDb,
  type SignedIn,
  signIn,
} from "../../../tests/helpers"
import { savedSearches } from "./saved-searches.tables"

// Seed: u-omar has ss-1 (alerts on, 2 new), ss-2 (alerts off), ss-3 (alerts on, 1 new).
const listSchema = z.array(savedSearchSchema)
const list = async (as: SignedIn) =>
  expectSchema(
    await req("/saved-searches", { headers: { cookie: as.cookie } }),
    listSchema
  )
const body = {
  name: "Corolla in Khartoum",
  params: { kind: "vehicle", make: "toyota", city: "khartoum" },
}

beforeEach(resetDb)

describe("GET /saved-searches", () => {
  test("is 401 signed out and answers the account's own searches", async () => {
    expect((await req("/saved-searches")).status).toBe(401)
    const buyer = await signIn("user")
    const rows = await list(buyer)
    expect(rows.map((r) => r.id).sort()).toEqual(["ss-1", "ss-2", "ss-3"])
    expect(rows.find((r) => r.id === "ss-1")).toMatchObject({
      alerts: true,
      newCount: 2,
    })
    expect(await list(await signIn("dealership"))).toEqual([])
  })
})

describe("POST /saved-searches", () => {
  test("saves the filters with alerts on and nothing new, last in the list", async () => {
    const buyer = await signIn("user")
    const res = await call(buyer, "/saved-searches", { method: "POST", body })
    const saved = await expectSchema(res, savedSearchSchema)
    expect(saved).toMatchObject({
      name: body.name,
      alerts: true,
      newCount: 0,
      params: {
        ...body.params,
        includeSold: false,
        sort: "relevance",
        page: 1,
      },
    })
    expect((await list(buyer)).at(-1)?.id).toBe(saved.id)
  })

  test("is 401 signed out and 422 for a missing or long name", async () => {
    expect((await req("/saved-searches", { method: "POST" })).status).toBe(401)
    const buyer = await signIn("user")
    const bad = await call(buyer, "/saved-searches", {
      method: "POST",
      body: { ...body, name: "" },
    })
    expect(bad.status).toBe(422)
    const long = await call(buyer, "/saved-searches", {
      method: "POST",
      body: { ...body, name: "x".repeat(61) },
    })
    expect(long.status).toBe(422)
  })
})

describe("PATCH /saved-searches/:id", () => {
  const patch = (as: SignedIn, id: string, change: object) =>
    call(as, `/saved-searches/${id}`, { method: "PATCH", body: change })

  test("renames, switches alerts, and markSeen zeroes the new matches", async () => {
    const buyer = await signIn("user")
    expect(
      await expectSchema(
        await patch(buyer, "ss-1", { name: "Hilux" }),
        savedSearchSchema
      )
    ).toMatchObject({ name: "Hilux", alerts: true, newCount: 2 })
    expect(
      await expectSchema(
        await patch(buyer, "ss-1", { alerts: false }),
        savedSearchSchema
      )
    ).toMatchObject({ name: "Hilux", alerts: false, newCount: 2 })
    expect(
      await expectSchema(
        await patch(buyer, "ss-1", { markSeen: false }),
        savedSearchSchema
      )
    ).toMatchObject({ newCount: 2 })
    expect(
      await expectSchema(
        await patch(buyer, "ss-1", { markSeen: true }),
        savedSearchSchema
      )
    ).toMatchObject({ name: "Hilux", newCount: 0 })
    expect(
      await expectSchema(await patch(buyer, "ss-3", {}), savedSearchSchema)
    ).toMatchObject({
      newCount: 1,
    })
  })

  test("is 404 for an unknown search and for another account's, 422 for a long name", async () => {
    const buyer = await signIn("user")
    expect((await patch(buyer, "ss-nope", {})).status).toBe(404)
    expect(
      (await patch(await signIn("dealership"), "ss-1", { name: "x" })).status
    ).toBe(404)
    expect((await patch(buyer, "ss-1", { name: "x".repeat(61) })).status).toBe(
      422
    )
  })
})

describe("DELETE /saved-searches/:id", () => {
  test("deletes the account's own search; another account's or unknown is 404", async () => {
    const buyer = await signIn("user")
    const drop = (as: SignedIn, id: string) =>
      call(as, `/saved-searches/${id}`, { method: "DELETE" })
    expect((await drop(await signIn("dealership"), "ss-2")).status).toBe(404)
    await expectSchema(await drop(buyer, "ss-2"), okSchema)
    expect((await drop(buyer, "ss-2")).status).toBe(404)
    expect(await db.$count(savedSearches)).toBe(2)
  })
})
