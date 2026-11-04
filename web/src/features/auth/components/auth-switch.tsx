import { ShellLink } from "@/components/app/shell-link"
import { Button } from "@/components/ui/button"
import { withRedirect } from "../destination"

export type AuthSwitchTarget = {
  // The dialog swaps views in place; the pages link to each other and keep the `redirect`.
  onSwitch?: () => void
  redirect?: string
}

const linkClass =
  "inline-flex min-h-11 items-center text-ui font-medium text-primary underline md:min-h-10"

// "New here? Create an account" under the log in form, and the reverse under sign up.
export function AuthSwitch({
  text,
  label,
  path,
  onSwitch,
  redirect,
}: AuthSwitchTarget & { text: string; label: string; path: string }) {
  return (
    <p className="flex flex-wrap items-center justify-center gap-x-1 text-ui text-muted-foreground">
      {text}
      {onSwitch ? (
        <Button
          type="button"
          variant="link"
          className="px-0"
          onClick={onSwitch}
        >
          {label}
        </Button>
      ) : (
        <ShellLink path={withRedirect(path, redirect)} className={linkClass}>
          {label}
        </ShellLink>
      )}
    </p>
  )
}
