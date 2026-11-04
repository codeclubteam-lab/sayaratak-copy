import type { Context, MiddlewareHandler } from "hono"
import { getCookie } from "hono/cookie"

import { db } from "~/shared/db/client"
import { fail } from "~/shared/http/errors"
import { clock } from "~/shared/time/clock"

import * as q from "./idempotency.queries"

const KEY_MAX_LENGTH = 255
const KEPT_MS = 24 * 3600 * 1000
// Longer than the longest request timeout (uploads, 60 s, A3): a key still
// running after this lost its server and a retry may take it over.
const STALE_MS = 61 * 1000

/**
 * A18: a POST that creates something runs once per `Idempotency-Key`. A retry
 * with the same body gets the stored answer, with another body 422
 * `idempotency_mismatch`, while the first still runs 409 `in_progress`. Only
 * 2xx answers are kept; on an error the key is freed so a retry runs again.
 * No header, or no owner to scope the key to, runs the request as normal.
 * Switched on per route by `spec({ idempotent: true })`.
 */
export const idempotency: MiddlewareHandler = async (c, next) => {
  const key = c.req.header("idempotency-key")
  const owner = ownerOf(c)
  if (!key || !owner) return next()
  if (key.length > KEY_MAX_LENGTH) {
    fail.validation({ "Idempotency-Key": "validation.too_long" })
  }

  const now = clock.now()
  const row = {
    owner,
    key,
    method: c.req.method,
    path: c.req.path,
    requestHash: await hashRequest(c),
    createdAt: now,
  }
  const isClaimed = await q.claimKey(db, row, {
    expiredBefore: new Date(now.getTime() - KEPT_MS),
    staleBefore: new Date(now.getTime() - STALE_MS),
  })
  if (!isClaimed) return replay(row)

  try {
    await next()
  } catch (error) {
    await q.deleteKey(db, row)
    throw error
  }
  await settle(c, row)
}

// The signed-in account first. The upload token predates the owner's choice
// that uploads need a session (2026-11-01); no route takes one any more, and
// 10.3 removes it with its tests.
function ownerOf(c: Context) {
  const userId = c.get("viewer")?.id
  if (userId) return `user:${userId}`
  const token = c.req.header("x-upload-token") ?? getCookie(c, "sy_upload")
  return token ? `upload:${token}` : undefined
}

async function replay(row: {
  owner: string
  key: string
  requestHash: string
}) {
  // Null when the first request failed and freed the key a moment ago; the
  // client retries and runs it again.
  const stored = await q.getKey(db, row.owner, row.key)
  if (stored && stored.requestHash !== row.requestHash) {
    fail.invalid("idempotency_mismatch")
  }
  if (!stored?.status) fail.conflict("in_progress")
  return new Response(JSON.stringify(stored.responseBody), {
    status: stored.status,
    headers: { "content-type": "application/json" },
  })
}

// Keeps a 2xx answer; frees the key on an error answer.
async function settle(
  c: Context,
  id: { owner: string; key: string; createdAt: Date }
) {
  const { status } = c.res
  if (status >= 200 && status < 300) {
    const body: unknown = await c.res.clone().json()
    await q.updateKeyResponse(db, id, { status, body })
  } else {
    await q.deleteKey(db, id)
  }
}

// Method, path and body. A multipart body is hashed by its fields, not its
// bytes: the boundary changes on every retry.
async function hashRequest(c: Context) {
  const hasher = new Bun.CryptoHasher("sha256")
  hasher.update(`${c.req.method} ${c.req.path}\n`)
  const type = c.req.header("content-type") ?? ""
  if (!type.startsWith("multipart/form-data")) {
    hasher.update(await c.req.text())
    return hasher.digest("hex")
  }
  const form = await c.req.formData()
  for (const name of new Set(form.keys())) {
    for (const value of form.getAll(name)) {
      hasher.update(`${name}\n`)
      if (typeof value === "string") hasher.update(value)
      else hasher.update(await value.arrayBuffer())
      hasher.update("\n")
    }
  }
  return hasher.digest("hex")
}
