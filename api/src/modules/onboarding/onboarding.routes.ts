import { onboardingInputSchema } from "@sayaratak/shared/schemas/inputs"
import { userSchema } from "@sayaratak/shared/schemas/user"
import { Hono } from "hono"

import { validate } from "~/shared/http/validate"
import { spec } from "~/shared/openapi/registry"
import { requireUser } from "~/modules/auth/auth.middleware"

import { completeOnboarding } from "./onboarding.service"

export const onboardingRoutes = new Hono()

onboardingRoutes.post(
  "/onboarding/complete",
  spec({
    summary:
      "Finish onboarding once: take the role, create the business profile and start the free plan",
    access: "user",
    responses: { 200: userSchema },
    errors: ["unauthenticated", "banned", "forbidden", "conflict"],
    idempotent: true,
  }),
  requireUser,
  validate.json(onboardingInputSchema),
  async (c) => {
    const me = await completeOnboarding(c.get("user"), c.req.valid("json"))
    return c.json(me)
  }
)
