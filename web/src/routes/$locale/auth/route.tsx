import { Outlet, createFileRoute } from "@tanstack/react-router"

import { AuthShell } from "@/components/app/auth-shell"

// One shell for log in, sign up and forgot, so its carousel stays mounted between them.
export const Route = createFileRoute("/$locale/auth")({
  component: () => (
    <AuthShell>
      <Outlet />
    </AuthShell>
  ),
})
