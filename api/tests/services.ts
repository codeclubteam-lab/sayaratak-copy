import { workshopSchema } from "@sayaratak/shared/schemas/profile"

import { db } from "~/shared/db/client"
import { plans } from "~/modules/plans/plans.tables"

import { read } from "./business"
import { call, expectSchema, type SignedIn } from "./helpers"

export const serviceSchema = workshopSchema.shape.services.element
export const listSchema = workshopSchema.shape.services

export const list = async (as: SignedIn) =>
  expectSchema(await read(as, "/me/services"), listSchema)
export const add = (as: SignedIn, body: object) =>
  call(as, "/me/services", { method: "POST", body })
export const patch = (as: SignedIn, id: string, body: object) =>
  call(as, `/me/services/${id}`, { method: "PATCH", body })
export const remove = (as: SignedIn, id: string) =>
  call(as, `/me/services/${id}`, { method: "DELETE" })
export const reorder = (as: SignedIn, ids: string[]) =>
  call(as, "/me/services/reorder", { method: "POST", body: { ids } })
export const limitTo = (serviceLimit: number) =>
  db.update(plans).set({ serviceLimit })
