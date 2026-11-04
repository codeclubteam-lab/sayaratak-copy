import { mechanicSchema } from "@sayaratak/shared/schemas/profile"

import { db } from "~/shared/db/client"
import { plans } from "~/modules/plans/plans.tables"

import { read } from "./business"
import { call, expectSchema, type SignedIn } from "./helpers"

export const itemSchema = mechanicSchema.shape.portfolio.element
export const listSchema = mechanicSchema.shape.portfolio

export const list = async (as: SignedIn) =>
  expectSchema(await read(as, "/me/portfolio"), listSchema)
export const add = (as: SignedIn, body: object) =>
  call(as, "/me/portfolio", { method: "POST", body })
export const patch = (as: SignedIn, id: string, body: object) =>
  call(as, `/me/portfolio/${id}`, { method: "PATCH", body })
export const remove = (as: SignedIn, id: string) =>
  call(as, `/me/portfolio/${id}`, { method: "DELETE" })
export const reorder = (as: SignedIn, ids: string[]) =>
  call(as, "/me/portfolio/reorder", { method: "POST", body: { ids } })
export const limitTo = (portfolioLimit: number) =>
  db.update(plans).set({ portfolioLimit })
