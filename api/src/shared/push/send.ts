import { env } from "~/env"
import { log } from "~/shared/log/logger"

import { createFcm, type PushMessage, type PushResult } from "./fcm"

/**
 * The FCM sender, or null without `FCM_SERVICE_ACCOUNT` (dev logs the push
 * instead). Test mode never builds one: tests read `testPushes`.
 */
const fcm =
  env.FCM_SERVICE_ACCOUNT && env.NODE_ENV !== "test"
    ? createFcm(env.FCM_SERVICE_ACCOUNT)
    : null

/** Pushes sent while NODE_ENV is test, newest last (A13), after `flushPush()`. */
export const testPushes: PushMessage[] = []
/** Test knobs: a token in `testDead` is answered `dead`, one in `testBroken` fails. */
export const testDead = new Set<string>()
export const testBroken = new Set<string>()
const running = new Set<Promise<void>>()

/** Sends one push; throws when it could not be sent, so the outbox retries. */
export async function transmit(message: PushMessage): Promise<PushResult> {
  if (fcm) return fcm.send(message)
  if (env.NODE_ENV !== "test") {
    log.info("push_dev", { title: message.title, data: message.data })
    return "sent"
  }
  if (testBroken.has(message.token)) throw new Error("fcm_send_503")
  testPushes.push(message)
  return testDead.has(message.token) ? "dead" : "sent"
}

/**
 * Starts a delivery without waiting for it, as mail does (A9): no answer
 * waits on FCM. A failure is already logged and kept in the outbox by `work`.
 */
export function startPush(work: () => Promise<void>) {
  const started = work().catch((error) => log.error("push_failed", { error }))
  running.add(started)
  void started.finally(() => running.delete(started))
}

/** Waits for every delivery started so far. Tests call it before reading `testPushes`. */
export async function flushPush() {
  await Promise.all(running)
}
