import { okSchema } from "@sayaratak/shared/schemas/api"
import { pageOf } from "@sayaratak/shared/schemas/fields"
import {
  messageInputSchema,
  threadInputSchema,
} from "@sayaratak/shared/schemas/inputs"
import {
  messageSchema,
  threadSchema,
} from "@sayaratak/shared/schemas/messaging"
import { Hono } from "hono"
import { z } from "zod"

import { pageParams } from "~/shared/http/page"
import { rateLimit } from "~/shared/http/rate-limit"
import { validate } from "~/shared/http/validate"
import { spec } from "~/shared/openapi/registry"
import { requireUser } from "~/modules/auth/auth.middleware"

import {
  listMessages,
  markThreadRead,
  sendMessage,
} from "./messaging.messages.service"
import { listThreads, startThread } from "./messaging.threads.service"

export const messagingRoutes = new Hono()

const PAGE_SIZE = { default: 50, max: 100 }
const USER_ERRORS = ["unauthenticated", "banned"] as const
const THREAD_ERRORS = [...USER_ERRORS, "not_found", "forbidden"] as const

messagingRoutes.get(
  "/threads",
  spec({
    summary:
      "The account's conversations, the one with the newest message first",
    access: "user",
    responses: { 200: z.array(threadSchema) },
    errors: [...USER_ERRORS],
  }),
  requireUser,
  async (c) => c.json(await listThreads(c.get("user")))
)

messagingRoutes.post(
  "/threads",
  spec({
    summary:
      "Write the first message about a listing or a business; asking again about the same one reuses the thread. 422 for your own",
    access: "user",
    responses: { 200: threadSchema },
    errors: [...USER_ERRORS, "validation", "not_found", "too_many_attempts"],
    idempotent: true,
  }),
  requireUser,
  rateLimit("threads"),
  validate.json(threadInputSchema),
  async (c) => c.json(await startThread(c.get("user"), c.req.valid("json")))
)

messagingRoutes.get(
  "/threads/:id/messages",
  spec({
    summary:
      "A page of the conversation, oldest first. `before=<message id>` with `limit` pages back from that message",
    access: "user",
    responses: { 200: pageOf(messageSchema) },
    errors: [...THREAD_ERRORS],
  }),
  requireUser,
  async (c) => {
    const query = c.req.query()
    return c.json(
      await listMessages(c.get("user"), {
        threadId: c.req.param("id"),
        before: query.before || undefined,
        page: pageParams(query, PAGE_SIZE),
      })
    )
  }
)

messagingRoutes.post(
  "/threads/:id/messages",
  spec({
    summary: "Write to the other person in a conversation",
    access: "user",
    responses: { 200: messageSchema },
    errors: [...THREAD_ERRORS, "validation", "too_many_attempts"],
    idempotent: true,
  }),
  requireUser,
  rateLimit("messages"),
  validate.json(messageInputSchema),
  async (c) =>
    c.json(
      await sendMessage(c.get("user"), {
        threadId: c.req.param("id"),
        body: c.req.valid("json").body,
      })
    )
)

messagingRoutes.post(
  "/threads/:id/read",
  spec({
    summary: "Mark the other person's messages in the conversation read",
    access: "user",
    responses: { 200: okSchema },
    errors: [...THREAD_ERRORS],
  }),
  requireUser,
  async (c) => {
    await markThreadRead(c.get("user"), c.req.param("id"))
    return c.json({ ok: true })
  }
)
