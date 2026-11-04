import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import {
  dealerships,
  mechanics,
  workshops,
} from "~/modules/businesses/businesses.tables"

import { fileOf, postUpload } from "./files"
import { DEMO_IDS, type SignedIn } from "./helpers"
import { send } from "./listings"

/** The seeded visitor who has not finished onboarding. */
export const NEW_ID = DEMO_IDS.new

// The seed already holds businesses, so every read is scoped to the new account.
export const mine = {
  dealership: () =>
    db.select().from(dealerships).where(eq(dealerships.ownerUserId, NEW_ID)),
  workshop: () =>
    db.select().from(workshops).where(eq(workshops.ownerUserId, NEW_ID)),
  mechanic: () =>
    db.select().from(mechanics).where(eq(mechanics.ownerUserId, NEW_ID)),
}

/** `POST /onboarding/complete` as the signed-in browser. */
export const complete = (as: SignedIn, role: string, payload: object = {}) =>
  send(as, "/onboarding/complete", { method: "POST", body: { role, payload } })

/** Uploads a photo as the account and answers its id. */
export async function upload(as: SignedIn) {
  const res = await postUpload(as, { file: fileOf("jpeg") })
  return ((await res.json()) as { id: string }).id
}

/** What the dealership steps of the web send. */
export const dealerPayload = {
  name: "Al Nour Motors",
  description: "Used cars bought and sold in Khartoum since 2010.",
  cityId: "khartoum",
  districtId: "khartoum-riyadh",
  address: "Africa Street",
  location: { lat: 15.55, lng: 32.53 },
  phones: [{ value: "+249912345678" }, { value: "+249911111111" }],
  whatsapp: "",
  planId: "plan-dealer-growth",
}
