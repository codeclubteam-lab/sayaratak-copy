import { useNavigate } from "@tanstack/react-router"
import { XIcon } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import type { User } from "@sayaratak/shared/schemas/user"

type Role = Exclude<User["role"], "admin">

// The first thing to do after onboarding, per role.
const firstStep: Record<Role, { href: string; key: string }> = {
  user: { href: "/post", key: "dashboard.overview_welcome_cta" },
  dealership: {
    href: "/dealer/inventory/new",
    key: "dashboard.welcome_cta_dealership",
  },
  workshop: {
    href: "/workshop/verification",
    key: "dashboard.welcome_cta_verify",
  },
  mechanic: {
    href: "/mechanic/verification",
    key: "dashboard.welcome_cta_verify",
  },
}

// Shown once after onboarding on the free plan (`?welcome=1`; a paid pick goes to its checkout instead). Closing it drops the param from the URL.
export function WelcomeNotice({ role = "user" }: { role?: Role }) {
  const { t, locale } = useT()
  const navigate = useNavigate()
  const step = firstStep[role]
  return (
    <section
      aria-labelledby="welcome-title"
      className="flex items-start gap-3 rounded-xl bg-accent p-4 text-accent-foreground sm:p-6"
    >
      <div className="flex min-w-0 flex-1 flex-col items-start gap-3">
        <h2 id="welcome-title" className="text-title font-semibold">
          {t("dashboard.welcome_title")}
        </h2>
        <p className="text-body">
          {role === "user"
            ? t("dashboard.overview_welcome")
            : t(`dashboard.welcome_ready_${role}`)}
        </p>
        <a href={localeHref(step.href, locale)} className={buttonVariants()}>
          {t(step.key)}
        </a>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t("common.close")}
        onClick={() =>
          void navigate({
            to: ".",
            search: (prev: Record<string, unknown>) => ({
              ...prev,
              welcome: undefined,
            }),
            replace: true,
            resetScroll: false,
          })
        }
      >
        <XIcon aria-hidden="true" />
      </Button>
    </section>
  )
}
