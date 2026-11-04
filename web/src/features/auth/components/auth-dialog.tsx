import { useState } from "react"

import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-mobile"
import { closeAuthGate, resolveAuthGate, useAuthGate } from "../auth-gate"
import { AuthMode } from "./auth-heading"
import { LoginForm } from "./login-form"
import { SignupFlow } from "./signup-flow"

// Opened by `useRequireAuth` through the gate store: a 420 px dialog on desktop, a bottom sheet below md. Log in and sign up swap in place, so the gated action can replay after either.
export function AuthDialog() {
  const { open, reason } = useAuthGate()
  const mobile = useIsMobile()
  const [view, setView] = useState<"login" | "signup" | null>(null)
  const onOpenChange = (next: boolean) => {
    if (next) return
    closeAuthGate()
    setView(null)
  }
  const done = () => {
    setView(null)
    resolveAuthGate()
  }
  const body = (
    <AuthMode value="dialog">
      {view === "signup" ? (
        <SignupFlow onDone={done} autoFocus onSwitch={() => setView("login")} />
      ) : (
        <LoginForm
          onDone={done}
          reason={reason}
          autoFocus={view === "login"}
          onSwitch={() => setView("signup")}
        />
      )}
    </AuthMode>
  )
  return mobile ? (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto p-6">
        {body}
      </SheetContent>
    </Sheet>
  ) : (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] gap-0 overflow-y-auto p-6 sm:max-w-[400px]">
        {body}
      </DialogContent>
    </Dialog>
  )
}
