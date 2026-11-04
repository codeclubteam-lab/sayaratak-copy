import { z } from "zod"

import { flushMail, testInbox } from "~/shared/mail/send"

import { req } from "./helpers"

export const KEY = "test-admin-secret-key-0123456789abcdef"
export const INBOX = "owner-inbox@example.sd"
export const newAdmin = {
  email: "New.Owner@Example.SD",
  name: "New owner",
  password: "strong pass 42",
}

const askedSchema = z.object({ at: z.number() })

type Call = {
  key?: string | null
  code?: string
  at?: number | string
  body?: unknown
  ip?: string
}

/** One call to the platform admin endpoint, with the key unless `key: null`. */
export function platform(method: string, path: string, call: Call = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" }
  if (call.key !== null) headers["x-secret-key"] = call.key ?? KEY
  if (call.code) headers["x-confirm-code"] = call.code
  if (call.at !== undefined) headers["x-confirm-at"] = String(call.at)
  if (call.ip) headers["x-forwarded-for"] = call.ip
  return req(`/platform/admin${path}`, {
    method,
    headers,
    body: call.body === undefined ? undefined : JSON.stringify(call.body),
  })
}

/** Step 1 for one change; returns the code the owner's inbox got and the second it was asked at. */
export async function ask(
  change: { op: string; input?: unknown },
  ip?: string
) {
  const mails = testInbox.length
  const res = await platform("POST", "/code", { body: change, ip })
  if (res.status !== 200) return { res, code: undefined, at: undefined }
  await flushMail()
  const mail = testInbox.slice(mails).find((m) => m.to === INBOX)
  const { at } = askedSchema.parse(await res.clone().json())
  return { res, code: mail?.code, at }
}
