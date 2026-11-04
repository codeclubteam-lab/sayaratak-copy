import { beforeAll, describe, expect, it, vi } from "vitest"

import { ApiError, apiFetch } from "@/lib/api/client"
import { handleMock } from "@/mocks/router"
import { taxonomySchema } from "@sayaratak/shared/schemas/taxonomy"
import { userSchema } from "@sayaratak/shared/schemas/user"
import { meQuery } from "@/features/auth/queries"
import { useMockFetch } from "./mock-fetch"

beforeAll(() => useMockFetch())

describe("mock router", () => {
  it("serves the taxonomy and a null session", async () => {
    const taxonomy = await apiFetch("/taxonomy", { schema: taxonomySchema })
    expect(taxonomy.cities).toHaveLength(10)
    expect(await apiFetch("/me", { schema: userSchema.nullable() })).toBeNull()
  })
  it("reads the session cookie", async () => {
    const res = await handleMock(
      new Request("http://localhost/api/me", {
        headers: { cookie: "sy_session=u-omar" },
      })
    )
    expect(userSchema.parse(await res.json()).fullName).toBe("Omar Hassan")
  })
  it("unknown path is a 404 not_found", async () => {
    const res = await handleMock(new Request("http://localhost/api/nope"))
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe("not_found")
  })
  it("x-mock-fail turns into an ApiError", async () => {
    const fetchWith = (mode: string) =>
      fetch("/api/taxonomy", { headers: { "x-mock-fail": mode } })
    for (const [mode, status] of [
      ["500", 500],
      ["404", 404],
      ["422", 422],
      ["offline", 503],
    ] as const) {
      const res = await fetchWith(mode)
      expect(res.status).toBe(status)
    }
    const original = globalThis.fetch
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((input, init) =>
        original(input, { ...init, headers: { "x-mock-fail": "500" } })
      )
    await expect(
      apiFetch("/taxonomy", { schema: taxonomySchema })
    ).rejects.toMatchObject({ status: 500, code: "server_error" })
    spy.mockRestore()
  })
  it("exposes the query options used by the root route", () => {
    expect(meQuery.queryKey).toEqual(["me"])
    expect(ApiError.name).toBe("ApiError")
  })
})
