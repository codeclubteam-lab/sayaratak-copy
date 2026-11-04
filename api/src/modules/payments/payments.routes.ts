import { paymentSchema } from "@sayaratak/shared/schemas/billing"
import { pageOf } from "@sayaratak/shared/schemas/fields"
import { paymentFormSchema } from "@sayaratak/shared/schemas/inputs"
import { checkoutSchema } from "@sayaratak/shared/schemas/responses"
import { Hono } from "hono"
import { bodyLimit } from "hono/body-limit"

import { fail } from "~/shared/http/errors"
import { pageParams } from "~/shared/http/page"
import { rateLimit } from "~/shared/http/rate-limit"
import { validate } from "~/shared/http/validate"
import { spec } from "~/shared/openapi/registry"
import { requireUser } from "~/modules/auth/auth.middleware"

import { getCheckout } from "./payments.checkout.service"
import { listMyPayments } from "./payments.service"
import { submitReceipt } from "./payments.submit.service"

export const paymentsRoutes = new Hono()

const PAGE_SIZE = { default: 20, max: 100 }
// One receipt of 5 MB plus the multipart overhead; a bigger body is refused before it is read.
const BODY_MAX_BYTES = 6 * 1024 * 1024

paymentsRoutes.get(
  "/me/payments",
  spec({
    summary: "The account's payments, newest first",
    access: "user",
    responses: { 200: pageOf(paymentSchema) },
    errors: ["unauthenticated", "banned"],
  }),
  requireUser,
  async (c) =>
    c.json(
      await listMyPayments(c.get("user"), pageParams(c.req.query(), PAGE_SIZE))
    )
)

paymentsRoutes.post(
  "/payments",
  bodyLimit({
    maxSize: BODY_MAX_BYTES,
    onError: () => fail.validation({ file: "validation.file_size_5mb" }),
  }),
  spec({
    summary:
      "Send a Bankak receipt (multipart `itemType`, `itemId`, `payerName`, `transactionRef`, `receipt`) for a plan, promotion or campaign",
    access: "user",
    responses: { 200: paymentSchema },
    errors: [
      "unauthenticated",
      "banned",
      "forbidden",
      "not_found",
      "validation",
      "exists",
      "payment_pending",
      "too_many_attempts",
    ],
    idempotent: true,
  }),
  requireUser,
  rateLimit("payments"),
  validate.form(paymentFormSchema),
  async (c) => c.json(await submitReceipt(c.get("user"), c.req.valid("form")))
)

paymentsRoutes.get(
  "/checkout",
  spec({
    summary:
      "Checkout details for `item=plan:<id>`, `promotion:<id>` or `campaign:<id>`: price, reference, Bankak account and any receipt under review",
    access: "user",
    responses: { 200: checkoutSchema },
    errors: ["unauthenticated", "banned", "forbidden", "not_found", "exists"],
  }),
  requireUser,
  async (c) => c.json(await getCheckout(c.get("user"), c.req.query("item")))
)
