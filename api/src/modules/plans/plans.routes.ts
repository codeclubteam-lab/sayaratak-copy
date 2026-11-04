import { planSchema } from "@sayaratak/shared/schemas/billing"
import { meSubscriptionSchema } from "@sayaratak/shared/schemas/responses"
import { userSchema } from "@sayaratak/shared/schemas/user"
import { z } from "zod"
import { Hono } from "hono"

import { publicCache } from "~/shared/http/cache"
import { spec } from "~/shared/openapi/registry"
import { requireUser } from "~/modules/auth/auth.middleware"

import {
  clearChosenPlan,
  getMySubscription,
  listPlans,
} from "./plans.subscription.service"

export const plansRoutes = new Hono()

plansRoutes.get(
  "/plans",
  spec({
    summary:
      "Enabled plans in list order; `audience` keeps one audience. Individuals have none while individual subscriptions are off",
    access: "public",
    responses: { 200: z.array(planSchema) },
  }),
  publicCache,
  async (c) => c.json(await listPlans(c.req.query("audience")))
)

plansRoutes.get(
  "/me/subscription",
  spec({
    summary:
      "The active (else pending) subscription with its plan, listing usage, Featured credits and the plan under review",
    access: "user",
    responses: { 200: meSubscriptionSchema },
    errors: ["unauthenticated", "banned"],
  }),
  requireUser,
  async (c) => c.json(await getMySubscription(c.get("user")))
)

plansRoutes.delete(
  "/me/chosen-plan",
  spec({
    summary: "Keep the free plan: forget the paid plan picked in onboarding",
    access: "user",
    responses: { 200: userSchema },
    errors: ["unauthenticated", "banned"],
  }),
  requireUser,
  async (c) => c.json(await clearChosenPlan(c.get("user")))
)
