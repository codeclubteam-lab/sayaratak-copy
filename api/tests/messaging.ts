import { countsSchema } from "@sayaratak/shared/schemas/api"
import { pageOf } from "@sayaratak/shared/schemas/fields"
import {
  messageSchema,
  threadSchema,
} from "@sayaratak/shared/schemas/messaging"
import { z } from "zod"

import { call, expectSchema, req, type SignedIn } from "./helpers"

// Seed: u-omar is in t-6 to t-9 (t-6 about l0006x with u-50), u-dealer owns l0007b, u-workshop owns w-1.
export const listSchema = z.array(threadSchema)
export const messagesSchema = pageOf(messageSchema)
export const start = (as: SignedIn, body: object) =>
  call(as, "/threads", { method: "POST", body })
export const write = (as: SignedIn, id: string, body: string) =>
  call(as, `/threads/${id}/messages`, { method: "POST", body: { body } })
export const readMessages = async (as: SignedIn, id: string, query = "") =>
  expectSchema(
    await req(`/threads/${id}/messages${query}`, {
      headers: { cookie: as.cookie },
    }),
    messagesSchema
  )
export const counts = async (as: SignedIn) =>
  expectSchema(
    await req("/me/counts", { headers: { cookie: as.cookie } }),
    countsSchema
  )
export const listing = {
  subjectType: "listing",
  subjectId: "l0007b",
  body: "Is it free?",
}
