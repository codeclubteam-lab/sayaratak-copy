import { ChevronDownIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import { useLogin } from "../queries"

// Seed accounts, all with the demo password. Shown only when VITE_DEMO is "true", folded so they do not outweigh the real form.
const accounts = [
  { label: "auth.demo_user", email: "user@demo.sy" },
  { label: "auth.demo_dealer", email: "dealer@demo.sy" },
  { label: "auth.demo_workshop", email: "workshop@demo.sy" },
  { label: "auth.demo_mechanic", email: "mechanic@demo.sy" },
  { label: "auth.demo_admin", email: "admin@demo.sy" },
] as const

export function DemoAccounts({ onDone }: { onDone: () => void }) {
  const { t } = useT()
  const login = useLogin()
  if (import.meta.env.VITE_DEMO !== "true") return null
  return (
    <details className="group">
      <summary className="mx-auto flex min-h-11 w-fit cursor-pointer list-none items-center gap-1 rounded-lg px-2 text-ui text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:min-h-10 [&::-webkit-details-marker]:hidden">
        {t("auth.demo_accounts")}
        <ChevronDownIcon
          aria-hidden="true"
          className="size-4 transition-transform duration-(--dur-fast) ease-(--ease-standard) group-open:rotate-180"
        />
      </summary>
      <div className="grid grid-cols-2 gap-2 pt-2">
        {accounts.map(({ label, email }) => (
          <Button
            key={email}
            type="button"
            variant="outline"
            disabled={login.isPending}
            onClick={() =>
              login.mutate(
                { email, password: "Demo1234" },
                { onSuccess: onDone }
              )
            }
          >
            {t(label)}
          </Button>
        ))}
      </div>
      {login.isError && (
        <p role="alert" className="pt-2 text-ui text-destructive">
          {errorText(t, login.error)}
        </p>
      )}
    </details>
  )
}
