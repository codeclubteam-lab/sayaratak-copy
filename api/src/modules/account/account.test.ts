import { beforeEach, describe, expect, it } from "bun:test"
import { draftSchema } from "@sayaratak/shared/schemas/api"

import {
  expectSchema,
  req,
  resetDb,
  type SignedIn,
  signIn,
} from "../../../tests/helpers"

function saveDraft(as: SignedIn, key: string, body: object) {
  return req(`/drafts/${key}`, {
    method: "PATCH",
    headers: {
      cookie: as.cookie,
      origin: as.origin,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

function readDraft(as: SignedIn, key: string) {
  return req(`/drafts/${key}`, { headers: { cookie: as.cookie } })
}

beforeEach(resetDb)

describe("drafts", () => {
  it("answers empty data when nothing was saved", async () => {
    const draft = await expectSchema(
      await readDraft(await signIn("user"), "post"),
      draftSchema
    )
    expect(draft).toEqual({ data: {} })
  })

  it("saves, replaces and reads back a draft under its key", async () => {
    const omar = await signIn("user")
    await saveDraft(omar, "post", { data: { step: 1, make: "toyota" } })
    const saved = await expectSchema(
      await saveDraft(omar, "post", { data: { step: 2 } }),
      draftSchema
    )
    expect(saved).toEqual({ data: { step: 2 } })
    expect(await (await readDraft(omar, "post")).json()).toEqual({
      data: { step: 2 },
    })
    expect(await (await readDraft(omar, "onboarding")).json()).toEqual({
      data: {},
    })
  })

  it("keeps each person's drafts apart", async () => {
    await saveDraft(await signIn("user"), "post", { data: { step: 3 } })
    const other = await readDraft(await signIn("dealership"), "post")
    expect(await other.json()).toEqual({ data: {} })
  })

  it("returns 422 for a body without data and 401 signed out", async () => {
    expect((await saveDraft(await signIn("user"), "post", {})).status).toBe(422)
    expect((await req("/drafts/post")).status).toBe(401)
  })
})
