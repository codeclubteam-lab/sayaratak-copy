import { z } from "zod"

import { req, signIn } from "./helpers"

const errorBody = z.object({
  code: z.string(),
  fields: z.record(z.string(), z.string()).optional(),
})

/** The `code` and `fields` of an error answer. */
export async function errorOf(res: Response) {
  return errorBody.parse(await res.json())
}

/**
 * An admin caller for one test: signs in on the first call (the emailed code is
 * capped per address, so one sign-in per test) and sends JSON from the web
 * origin, as the browser does. Make a new one in `beforeEach`, because
 * `resetDb` ends every session.
 */
export function adminCaller() {
  let session: ReturnType<typeof signIn> | undefined
  return async (method: string, path: string, body?: unknown) => {
    session ??= signIn("admin")
    const { cookie, origin } = await session
    return req(path, {
      method,
      headers: { cookie, origin, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  }
}
