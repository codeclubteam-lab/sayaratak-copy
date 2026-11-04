import { req, type SignedIn } from "./helpers"
import { send } from "./listings"

/** A signed-in GET, as the web app sends it. */
export const read = (as: SignedIn, path: string) =>
  req(path, { headers: { cookie: as.cookie, origin: as.origin } })

/** `PATCH /me/business` with the fields one profile section sends. */
export const patchBusiness = (as: SignedIn, body: object) =>
  send(as, "/me/business", { method: "PATCH", body })

/** The seeded business of a demo account, read through the api. */
export async function mineOf(as: SignedIn) {
  return (await read(as, "/me/business")).json() as Promise<
    Record<string, unknown> & { id: string; images?: { id: string }[] }
  >
}
