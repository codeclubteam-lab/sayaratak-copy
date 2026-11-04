import { expect, test } from "bun:test"
import { z } from "zod"

import { createLogger, maskFields } from "~/shared/log/logger"

const lineSchema = z.looseObject({
  time: z.iso.datetime(),
  level: z.string(),
  msg: z.string(),
})

test("writes one JSON line with time, level, msg and fields", () => {
  const lines: string[] = []
  const log = createLogger("info", (line) => lines.push(line))
  log.info("started", { port: 4000 })
  expect(lines).toHaveLength(1)
  expect(lines[0]?.endsWith("\n")).toBe(true)
  const line = lineSchema.parse(JSON.parse(lines[0] ?? ""))
  expect(line).toMatchObject({ level: "info", msg: "started", port: 4000 })
})

test("drops lines below the level", () => {
  const lines: string[] = []
  const log = createLogger("warn", (line) => lines.push(line))
  log.debug("a")
  log.info("b")
  log.warn("c")
  log.error("d")
  expect(lines.map((l) => lineSchema.parse(JSON.parse(l)).msg)).toEqual([
    "c",
    "d",
  ])
})

test("redacts secret keys at any depth", () => {
  expect(
    maskFields({
      password: "hunter2",
      user: { newPassword: "x", otp: "123456", id: "u1" },
      headers: [{ Cookie: "sy.session_token=abc", authorization: "Bearer t" }],
    })
  ).toEqual({
    password: "[redacted]",
    user: { newPassword: "[redacted]", otp: "[redacted]", id: "u1" },
    headers: [{ Cookie: "[redacted]", authorization: "[redacted]" }],
  })
})

test("masks emails and key=value secrets inside text", () => {
  expect(
    maskFields({
      note: "sent to ali.hassan@mail.sd, password=hunter2 token=abc",
    })
  ).toEqual({
    note: "sent to a***@mail.sd, password=[redacted] token=[redacted]",
  })
})

test("keeps name, message and stack of an Error, masked", () => {
  const { error } = maskFields({ error: new Error("bad otp=999 for a@b.sd") })
  expect(error).toMatchObject({
    name: "Error",
    message: "bad otp=[redacted] for a***@b.sd",
  })
  expect(JSON.stringify(error)).not.toContain("999")
})
