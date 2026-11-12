// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest"

import validateDeployment from "@/lib/server/deployment-startup"

afterEach(() => vi.unstubAllEnvs())

it("Nitro startup refuses an absent upstream even without NODE_ENV set", () => {
  vi.stubEnv("NODE_ENV", "")
  vi.stubEnv("API_BASE_URL", "")
  vi.stubEnv("APP_ORIGIN", "https://web.example.test")
  expect(validateDeployment).toThrow("API_BASE_URL")
})

it("Nitro startup validates website/browser origins before listening", () => {
  vi.stubEnv("API_BASE_URL", "https://api.example.test")
  vi.stubEnv("APP_ORIGIN", "https://web.example.test")
  vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test")
  expect(validateDeployment).toThrow("VITE_API_BASE_URL")
})

it("Nitro startup accepts valid same-origin deployment settings", () => {
  vi.stubEnv("API_BASE_URL", "https://api.example.test")
  vi.stubEnv("APP_ORIGIN", "https://web.example.test")
  vi.stubEnv("VITE_API_BASE_URL", "https://web.example.test")
  expect(validateDeployment).not.toThrow()
})
