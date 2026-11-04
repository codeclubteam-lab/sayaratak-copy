import { afterAll, beforeAll, describe, test } from "bun:test"

import { app } from "~/app"

import { bothSessions, type DemoAccount, resetDb } from "../../../tests/helpers"
import { expectParity } from "../../../tests/parity"

beforeAll(resetDb)
// The mock keeps the changes below for the whole run; start the next suite clean.
afterAll(resetDb)

const sent = async (
  as: DemoAccount,
  request: { method: string; path: string; body?: object }
) =>
  expectParity(`/api/v1${request.path}`, {
    init: {
      method: request.method,
      headers: {
        ...(await bothSessions(as)),
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
      body: request.body && JSON.stringify(request.body),
    },
  })

async function pictureIds() {
  const res = await app.request("/api/v1/me/portfolio", {
    headers: await bothSessions("mechanic"),
  })
  return ((await res.json()) as { id: string }[]).map((row) => row.id)
}

describe("/me/portfolio matches the mock", () => {
  test("the list, and who may read it", async () => {
    await sent("mechanic", { method: "GET", path: "/me/portfolio" })
    await sent("workshop", { method: "GET", path: "/me/portfolio" })
    await sent("user", { method: "GET", path: "/me/portfolio" })
  })

  test("a full reorder, a caption, an unknown id and a wrong caption", async () => {
    const ids = await pictureIds()
    const [first = ""] = ids
    await sent("mechanic", {
      method: "POST",
      path: "/me/portfolio/reorder",
      body: { ids: [...ids].reverse() },
    })
    await sent("mechanic", {
      method: "POST",
      path: "/me/portfolio/reorder",
      body: { ids },
    })
    await sent("mechanic", {
      method: "PATCH",
      path: `/me/portfolio/${first}`,
      body: { caption: "Fresh caption" },
    })
    await sent("mechanic", {
      method: "PATCH",
      path: `/me/portfolio/${first}`,
      body: { caption: "" },
    })
    await sent("mechanic", {
      method: "PATCH",
      path: "/me/portfolio/pf-missing",
      body: { caption: "x" },
    })
    await sent("mechanic", {
      method: "DELETE",
      path: "/me/portfolio/pf-missing",
    })
  })

  test("a picture that is not an upload of the account", async () => {
    await sent("mechanic", {
      method: "POST",
      path: "/me/portfolio",
      body: { imageId: "up-missing", caption: "x" },
    })
  })
})
