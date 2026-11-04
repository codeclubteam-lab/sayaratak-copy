import { createFileRoute } from "@tanstack/react-router"

import { verificationRoute } from "@/features/verification/verification-routes"

export const Route = createFileRoute("/$locale/workshop/verification")(
  verificationRoute("workshop")
)
