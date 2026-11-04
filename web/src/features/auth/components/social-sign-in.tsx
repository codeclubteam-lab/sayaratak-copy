import { useState } from "react"

import { Separator } from "@/components/ui/separator"
import { useT } from "@/lib/i18n/use-t"
import { MockOAuthDialog } from "./mock-oauth-dialog"
import { SocialButtons, type Provider } from "./social-buttons"

// "or", then Google and Facebook. Shared by log in and sign up; a new social account goes to onboarding like an email sign up.
export function SocialSignIn({ onDone }: { onDone: () => void }) {
  const { t } = useT()
  const [provider, setProvider] = useState<Provider | null>(null)
  return (
    <>
      <div className="flex items-center gap-3 text-ui text-muted-foreground">
        <Separator className="flex-1" />
        {t("auth.or")}
        <Separator className="flex-1" />
      </div>
      <SocialButtons onSelect={setProvider} />
      <MockOAuthDialog
        provider={provider}
        onClose={() => setProvider(null)}
        onDone={onDone}
      />
    </>
  )
}
