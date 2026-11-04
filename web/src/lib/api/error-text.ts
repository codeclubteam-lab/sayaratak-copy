import type { TFunction } from "i18next"

import { ApiError } from "./client"

// The A12 table in short: the codes a person can act on get their own message, the rest the generic one.
export function errorText(t: TFunction, error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "already_reviewed") return t("reviews.already_reviewed")
    if (error.code === "bump_wait") return t("billing.bump_wait")
    if (error.code === "forbidden") return t("error.forbidden")
    if (error.code === "in_use") return t("admin.in_use")
    if (error.code === "offline") return t("error.offline")
    if (error.code === "payment_pending") return t("billing.payment_pending")
  }
  return t("toast.error_save")
}
