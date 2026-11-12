// @vitest-environment node
import { readFileSync } from "node:fs"
import { afterEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"

import { readDeploymentConfig } from "@/lib/server/deployment-config"

const deployed = {
  NODE_ENV: "production",
  API_BASE_URL: "https://sayaratak-api-91a8.onrender.com",
  APP_ORIGIN: "https://sayaratak-web.onrender.com",
  VITE_API_BASE_URL: "https://sayaratak-web.onrender.com",
}

afterEach(() => vi.unstubAllEnvs())

it("existing E2E suites build and start with website browser and public auth origins", async () => {
  vi.stubEnv(
    "DATABASE_URL",
    "postgres://sayaratak:sayaratak@localhost:5434/sayaratak"
  )
  const configs = [
    (await import("../playwright.config")).default,
    (await import("../playwright.journeys.config")).default,
  ]
  for (const config of configs) {
    const servers = z
      .array(
        z.object({
          command: z.string(),
          env: z.record(z.string(), z.string()),
        })
      )
      .parse(config.webServer)
    const api = servers[0]!
    const web = servers.at(-1)!
    expect(web.env.VITE_API_BASE_URL).toBe(web.env.APP_ORIGIN)
    expect(api.env.BETTER_AUTH_URL).toBe(web.env.APP_ORIGIN)
    expect(api.env.WEB_ORIGIN).toBe(web.env.APP_ORIGIN)
    expect(web.command).toContain("bun run build")
  }
  const { scripts } = z
    .object({ scripts: z.record(z.string(), z.string()) })
    .parse(JSON.parse(readFileSync("package.json", "utf8")))
  expect(scripts["test:journeys"]).not.toMatch(/^bun run build/)
  expect(scripts["test:states"]).not.toMatch(/^bun run build/)
})

describe("same-origin deployment configuration", () => {
  it("accepts the exact Render origins", () => {
    expect(readDeploymentConfig(deployed)).toEqual({
      apiBaseUrl: deployed.API_BASE_URL,
      appOrigin: deployed.APP_ORIGIN,
    })
  })

  it.each(["API_BASE_URL", "APP_ORIGIN"])(
    "requires explicit %s in production server mode",
    (key) => {
      for (const value of [undefined, "", " "]) {
        expect(() =>
          readDeploymentConfig({ ...deployed, [key]: value })
        ).toThrow(key)
      }
    }
  )

  it.each(["API_BASE_URL", "APP_ORIGIN"])(
    "rejects non-origin %s without leaking its value",
    (key) => {
      for (const value of [
        "https://example.test/api/v1",
        "https://user:private-password@example.test",
        "https://example.test?x=1",
        "https://example.test#fragment",
        "ftp://example.test",
        "not a url",
        " https://example.test ",
      ]) {
        const read = () => readDeploymentConfig({ ...deployed, [key]: value })
        expect(read).toThrow(key)
        expect(read).not.toThrow("private-password")
      }
    }
  )

  it("rejects proxy recursion, including equivalent trailing-slash origins", () => {
    expect(() =>
      readDeploymentConfig({
        ...deployed,
        API_BASE_URL: `${deployed.APP_ORIGIN}/`,
      })
    ).toThrow("API_BASE_URL")
  })

  it.each(["", "/", deployed.APP_ORIGIN, `${deployed.APP_ORIGIN}/`])(
    "accepts root-relative or website browser base %s",
    (value) => {
      expect(
        readDeploymentConfig({ ...deployed, VITE_API_BASE_URL: value })
      ).toEqual({
        apiBaseUrl: deployed.API_BASE_URL,
        appOrigin: deployed.APP_ORIGIN,
      })
    }
  )

  it.each([
    deployed.API_BASE_URL,
    "//evil.test",
    "/api/v1",
    "https://evil.test",
    " https://sayaratak-web.onrender.com ",
  ])("rejects browser base outside the website origin: %s", (value) => {
    expect(() =>
      readDeploymentConfig({ ...deployed, VITE_API_BASE_URL: value })
    ).toThrow("VITE_API_BASE_URL")
  })

  it("retains localhost defaults for isolated tests and development", () => {
    expect(readDeploymentConfig({ NODE_ENV: "test" })).toEqual({
      apiBaseUrl: "http://localhost:4000",
      appOrigin: "http://localhost:3000",
    })
    expect(readDeploymentConfig({ NODE_ENV: "development" })).toEqual(
      readDeploymentConfig({ NODE_ENV: "test" })
    )
  })
})
