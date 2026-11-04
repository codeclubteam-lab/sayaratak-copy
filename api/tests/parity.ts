import { expect } from "bun:test"

import { app } from "~/app"
import { resetRateLimits } from "~/shared/http/rate-limit"

type MockHandler = (request: Request) => Promise<Response>

// Mock and api build their rows a few milliseconds apart, and the mock writes
// times relative to `Date.now()`, so equal times differ a little.
const TIME_TOLERANCE_MS = 5000
const ISO_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/

/**
 * Gate B6 (A13): sends the same request to the mock (`handleMock` from
 * web/src/mocks/router.ts) and to the api, then expects the same status and
 * the same JSON once times are normalized. `path` is the api path; the mock
 * gets it without `/v1`, so `/api/v1/site` goes to the mock as `/api/site`.
 */
export async function expectParity(
  path: string,
  options: {
    init?: RequestInit
    mock?: MockHandler
    /** Applied to both bodies, to leave out what is meant to differ (a documented deviation). */
    ignore?: (body: unknown) => unknown
  } = {}
) {
  // The mock has no rate limits; parity compares what a route does, not how often it may be called.
  resetRateLimits()
  const mock = options.mock ?? (await loadMock())
  const mockUrl = `http://localhost${path.replace(/^\/api\/v1\//, "/api/")}`
  // x-mock-ssr turns off the mock's random latency.
  const mockRequest = new Request(mockUrl, options.init)
  mockRequest.headers.set("x-mock-ssr", "1")
  const [fromMock, fromApi] = await Promise.all([
    mock(mockRequest),
    app.request(path, options.init),
  ])
  expect(fromApi.status).toBe(fromMock.status)
  const ignore = options.ignore ?? ((body: unknown) => body)
  const expected = ignore(await fromMock.json())
  expect(normalizeTimes(ignore(await fromApi.json()), expected)).toEqual(
    expected
  )
}

/**
 * Copies `expected`'s time wherever both sides hold ISO times within the
 * tolerance, so only real differences remain.
 * `{ at: "…:00.120Z" }` against `{ at: "…:00.004Z" }` reads as equal;
 * the same pair a day apart stays different.
 */
export function normalizeTimes(actual: unknown, expected: unknown): unknown {
  if (isTime(actual) && isTime(expected)) {
    const gap = Math.abs(Date.parse(actual) - Date.parse(expected))
    return gap <= TIME_TOLERANCE_MS ? expected : actual
  }
  if (Array.isArray(actual) && Array.isArray(expected)) {
    return actual.map((item, i) => normalizeTimes(item, expected[i]))
  }
  if (isObject(actual) && isObject(expected)) {
    return Object.fromEntries(
      Object.entries(actual).map(([key, value]) => [
        key,
        normalizeTimes(value, expected[key]),
      ])
    )
  }
  return actual
}

// Imported on first use: building the mock seeds its whole in-memory DB.
async function loadMock(): Promise<MockHandler> {
  const { handleMock } = await import("../../web/src/mocks/router")
  return (request) => handleMock(request)
}

function isTime(value: unknown): value is string {
  return typeof value === "string" && ISO_TIME.test(value)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
