import { keepPreviousData, queryOptions } from "@tanstack/react-query"
import { z } from "zod"

import { ApiError, apiFetch } from "@/lib/api/client"
import { useApiMutation } from "@/lib/api/mutation"
import { keys } from "@/lib/api/query-keys"
import { pageOf } from "@sayaratak/shared/schemas/fields"
import {
  paymentSchema,
  planSchema,
  promotionPriceSchema,
  promotionSchema,
} from "@sayaratak/shared/schemas/billing"
import type { promotionInputSchema } from "@sayaratak/shared/schemas/inputs"
import { userSchema } from "@sayaratak/shared/schemas/user"
import {
  checkoutSchema,
  meSubscriptionSchema,
  myPromotionsSchema,
} from "@sayaratak/shared/schemas/responses"

export const billingQueries = {
  plans: (audience?: string) =>
    queryOptions({
      queryKey: keys.billing.plans(audience),
      queryFn: ({ signal }) =>
        apiFetch("/plans", {
          query: { audience },
          schema: z.array(planSchema),
          signal,
        }),
      staleTime: 5 * 60_000,
    }),
  subscription: queryOptions({
    queryKey: keys.billing.subscription,
    queryFn: ({ signal }) =>
      apiFetch("/me/subscription", { schema: meSubscriptionSchema, signal }),
  }),
  // `item` is `plan:<planId>` or `promotion:<promotionId>`.
  checkout: (item: string) =>
    queryOptions({
      queryKey: keys.billing.checkout(item),
      queryFn: ({ signal }) =>
        apiFetch("/checkout", {
          query: { item },
          schema: checkoutSchema,
          signal,
        }),
      // An unknown, foreign or paid item stays that way: the page says so at once.
      retry: (count, error) =>
        !(error instanceof ApiError && error.status < 500) && count < 1,
    }),
  payments: (filters: Record<string, unknown> = {}) =>
    queryOptions({
      queryKey: keys.billing.payments(filters),
      queryFn: ({ signal }) =>
        apiFetch("/me/payments", {
          query: filters,
          schema: pageOf(paymentSchema),
          signal,
        }),
      placeholderData: keepPreviousData,
    }),
  promotionPrices: queryOptions({
    queryKey: keys.billing.promotionPrices,
    queryFn: ({ signal }) =>
      apiFetch("/promotion-prices", {
        schema: z.array(promotionPriceSchema),
        signal,
      }),
    staleTime: 5 * 60_000,
  }),
  promotions: queryOptions({
    queryKey: keys.billing.promotions,
    queryFn: ({ signal }) =>
      apiFetch("/me/promotions", {
        schema: myPromotionsSchema,
        signal,
      }).then((r) => r.items),
  }),
}

// Bankak transfer: the receipt goes up with the form, an admin approves it later.
export const useCreatePayment = () =>
  useApiMutation(
    (v: {
      itemType: "plan" | "promotion" | "campaign"
      itemId: string
      transactionRef: string
      payerName: string
      receipt: File
    }) => {
      const form = new FormData()
      for (const [key, value] of Object.entries(v)) form.set(key, value)
      return apiFetch("/payments", {
        method: "POST",
        form,
        schema: paymentSchema,
      })
    },
    // A plan receipt clears the account's waiting plan.
    [keys.billing.all, keys.counts, keys.me]
  )
export const useCreatePromotion = () =>
  useApiMutation(
    (body: z.input<typeof promotionInputSchema>) =>
      apiFetch("/promotions", {
        method: "POST",
        body,
        schema: promotionSchema,
      }),
    // A credit Featured starts at once, so listings show the badge and the credit count drops.
    [keys.billing.all, keys.listings.all]
  )

// "Keep the free plan": the plan picked in onboarding stops waiting for payment.
export const useKeepFreePlan = () =>
  useApiMutation(
    () => apiFetch("/me/chosen-plan", { method: "DELETE", schema: userSchema }),
    [keys.me]
  )
