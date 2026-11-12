// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest"

import { checkDeployment } from "../scripts/check-deployment"

const web = "https://web.example.test"
const api = "https://api.example.test"
const site = {
  contact: { phone: "", whatsapp: "", email: "", address: "" },
  locales: ["ar", "en"],
}
const taxonomy = {
  cities: [],
  districts: [],
  makes: [],
  models: [],
  vehicleTypes: [],
  partCategories: [],
  specializations: [],
  serviceTemplates: [],
}

afterEach(() => vi.restoreAllMocks())

function responses(override?: (url: URL) => Response | undefined) {
  return vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
    const request = new Request(input, init)
    expect(request.method).toBe("GET")
    expect(request.headers.has("cookie")).toBe(false)
    expect(request.redirect).toBe("manual")
    const url = new URL(request.url)
    const replaced = override?.(url)
    if (replaced) return replaced
    if (url.pathname === "/api/v1/site") return Response.json(site)
    if (url.pathname === "/api/v1/taxonomy") return Response.json(taxonomy)
    if (url.pathname === "/api/v1/me") return Response.json(null)
    if (url.pathname === "/api/health/ready")
      return Response.json({
        ok: true,
        checks: { database: "ok", migrations: "ok", smtp: "off", jobs: "ok" },
      })
    return new Response(`<html lang="${url.pathname.slice(1)}"><main />`, {
      headers: { "content-type": "text/html" },
    })
  })
}

it("passes valid JSON including signed-out me and issues GET requests only", async () => {
  vi.spyOn(process.stdout, "write").mockReturnValue(true)
  const fetchImpl = responses()
  expect(await checkDeployment(web, api, fetchImpl)).toBe(true)
  const paths = fetchImpl.mock.calls.map(
    ([input]) => new URL(String(input)).pathname
  )
  expect(paths).toEqual(
    expect.arrayContaining([
      "/ar",
      "/en",
      "/api/v1/site",
      "/api/v1/taxonomy",
      "/api/v1/me",
      "/api/health/ready",
    ])
  )
})

it("fails an HTML 404 on the website site API", async () => {
  vi.spyOn(process.stdout, "write").mockReturnValue(true)
  const fetchImpl = responses((url) =>
    url.origin === web && url.pathname === "/api/v1/site"
      ? new Response("private error detail", { status: 404 })
      : undefined
  )
  expect(await checkDeployment(web, api, fetchImpl)).toBe(false)
  expect(process.stdout.write).not.toHaveBeenCalledWith(
    expect.stringContaining("private error detail")
  )
})

it("fails readiness 503", async () => {
  vi.spyOn(process.stdout, "write").mockReturnValue(true)
  expect(
    await checkDeployment(
      web,
      api,
      responses((url) =>
        url.pathname === "/api/health/ready"
          ? Response.json({ ok: false }, { status: 503 })
          : undefined
      )
    )
  ).toBe(false)
})

it.each([
  ["/api/v1/site", Response.json({ locales: ["en"] })],
  ["/api/v1/taxonomy", Response.json({})],
  ["/api/v1/me", Response.json({ id: "unexpected-account" })],
  [
    "/api/health/ready",
    Response.json({ ok: true, checks: { migrations: "failed" } }),
  ],
  [
    "/en",
    new Response("login", { status: 302, headers: { location: "/auth" } }),
  ],
])("fails malformed or unexpected %s responses", async (path, response) => {
  vi.spyOn(process.stdout, "write").mockReturnValue(true)
  expect(
    await checkDeployment(
      web,
      api,
      responses((url) => (url.pathname === path ? response.clone() : undefined))
    )
  ).toBe(false)
})

it("does not expose response bodies or network exception messages", async () => {
  const output = vi.spyOn(process.stdout, "write").mockReturnValue(true)
  const fetchImpl = vi
    .fn<typeof fetch>()
    .mockRejectedValue(new Error("secret-cookie"))
  expect(await checkDeployment(web, api, fetchImpl)).toBe(false)
  expect(output.mock.calls.flat().join("")).not.toContain("secret-cookie")
})

it.each([
  "https://user:password@web.example.test",
  "https://web.example.test/api/v1",
  "file:///tmp/site",
])("rejects invalid origin without fetching or printing it", async (origin) => {
  const output = vi.spyOn(process.stdout, "write").mockReturnValue(true)
  const fetchImpl = responses()
  expect(await checkDeployment(origin, api, fetchImpl)).toBe(false)
  expect(fetchImpl).not.toHaveBeenCalled()
  expect(output.mock.calls.flat().join("")).not.toContain(origin)
})
