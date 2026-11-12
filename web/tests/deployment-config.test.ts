// @vitest-environment node
import { describe, expect, it } from "vitest"

import { readDeploymentConfig } from "@/lib/server/deployment-config"

const deployed = {
  NODE_ENV: "production",
  API_BASE_URL: "https://sayaratak-api-91a8.onrender.com",
  APP_ORIGIN: "https://sayaratak-web.onrender.com",
  VITE_API_BASE_URL: "https://sayaratak-web.onrender.com",
}

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
