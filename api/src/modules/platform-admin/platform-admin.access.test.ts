import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"

import { env } from "~/env"
import { testInbox } from "~/shared/mail/send"
import { clock } from "~/shared/time/clock"

import { errorOf } from "../../../tests/admin"
import { resetDb } from "../../../tests/helpers"
import { ask, INBOX, KEY, platform } from "../../../tests/platform"

beforeEach(resetDb)
afterEach(() => {
  env.ADMIN_SECRET_KEY = KEY
  env.ADMIN_RECOVERY_EMAIL = INBOX
})

const ROUTES = [
  ["POST", "/code"],
  ["POST", ""],
  ["PATCH", ""],
  ["DELETE", ""],
] as const

describe("the key", () => {
  test("the endpoint is off (404) while the key or the inbox is not set", async () => {
    for (const unset of ["ADMIN_SECRET_KEY", "ADMIN_RECOVERY_EMAIL"] as const) {
      env[unset] = undefined
      for (const [method, path] of ROUTES)
        expect((await platform(method, path)).status).toBe(404)
      env.ADMIN_SECRET_KEY = KEY
      env.ADMIN_RECOVERY_EMAIL = INBOX
    }
  })

  test("a missing or wrong key is 403, before the body is read", async () => {
    let n = 0
    for (const key of [null, "wrong", `${KEY}x`])
      for (const [method, path] of ROUTES) {
        // A new address each time, so the lock-out is not in the way.
        const ip = `10.0.0.${++n}`
        const res = await platform(method, path, { key, body: {}, ip })
        expect(res.status).toBe(403)
        expect((await errorOf(res)).code).toBe("forbidden")
      }
  })

  test("five wrong keys from one address lock it, even for the right key", async () => {
    for (let i = 0; i < 5; i++)
      expect((await platform("DELETE", "", { key: "bad" })).status).toBe(403)
    const res = await platform("DELETE", "")
    expect(res.status).toBe(429)
    expect(await errorOf(res)).toMatchObject({ code: "too_many_attempts" })
    // Another address is not locked.
    expect((await ask({ op: "delete" }, "10.0.0.99")).res.status).toBe(200)
  })
})

describe("the code", () => {
  test("asking mails a 6-digit code to the owner's inbox only", async () => {
    const mails = testInbox.length
    const { res, code, at } = await ask({ op: "delete" })
    expect(res.status).toBe(200)
    expect(code).toMatch(/^\d{6}$/)
    expect(await res.json()).toEqual({ at, expiresIn: 600 })
    expect(testInbox.slice(mails).map((m) => m.to)).toEqual([INBOX])
  })

  test("a change that cannot run mails nothing", async () => {
    const mails = testInbox.length
    const create = await ask({
      op: "create",
      input: { email: "a@b.sd", name: "A B", password: "strong pass 42" },
    })
    expect(create.res.status).toBe(409)
    expect((await errorOf(create.res)).code).toBe("conflict")
    const taken = await ask({ op: "update", input: { email: "user@demo.sy" } })
    expect((await errorOf(taken.res)).code).toBe("exists")
    expect(testInbox.length).toBe(mails)
  })

  test("a code fits one change only", async () => {
    const { code, at } = await ask({
      op: "update",
      input: { name: "Same name" },
    })
    for (const [method, body] of [
      ["DELETE", undefined],
      ["PATCH", { name: "Other name" }],
    ] as const) {
      const res = await platform(method, "", { code, at, body })
      expect(res.status).toBe(422)
      expect((await errorOf(res)).code).toBe("otp_invalid")
    }
  })

  test("a missing, wrong or future code is 422 `otp_invalid`", async () => {
    const { code, at } = await ask({ op: "delete" })
    const nowSeconds = Math.floor(Date.now() / 1000)
    const calls = [
      {},
      { code, at: undefined },
      { code: "000000", at },
      { code: code?.slice(1), at },
      { code, at: "x" },
      { code, at: nowSeconds + 60 },
    ]
    for (const [n, call] of calls.entries()) {
      const res = await platform("DELETE", "", { ...call, ip: `10.0.1.${n}` })
      expect(res.status).toBe(422)
      expect((await errorOf(res)).code).toBe("otp_invalid")
    }
  })

  test("a code is dead after 10 minutes (410 `code_expired`)", async () => {
    const { code, at } = await ask({ op: "delete" })
    spyOn(clock, "now").mockReturnValue(new Date(Date.now() + 601_000))
    const res = await platform("DELETE", "", { code, at })
    expect(res.status).toBe(410)
    expect((await errorOf(res)).code).toBe("code_expired")
  })

  test("five wrong codes lock the address, even for the right code", async () => {
    const { code, at } = await ask({ op: "delete" })
    for (let i = 0; i < 5; i++)
      await platform("DELETE", "", { code: "000000", at })
    const res = await platform("DELETE", "", { code, at })
    expect(res.status).toBe(429)
  })
})
