import type { ReactNode } from "react"
import { useMatch } from "@tanstack/react-router"

// Error and not-found pages render inside the public layout's <main> when it is up, and bring their own landmark when it is not.
export function StatePanel({
  title,
  body,
  children,
  role,
}: {
  title: string
  body?: string
  children?: ReactNode
  role?: "alert"
}) {
  const inLayout = useMatch({
    from: "/$locale/_public",
    shouldThrow: false,
    select: (match) => match.status === "success",
  })
  const Root = inLayout ? "div" : "main"
  return (
    <Root
      role={role}
      className={`flex flex-col items-start gap-4 py-12 md:py-16 ${inLayout ? "" : "mx-auto w-full max-w-[1200px] px-4 md:px-6"}`}
    >
      <h1 className="text-page font-semibold">{title}</h1>
      {body && <p className="text-body text-muted-foreground">{body}</p>}
      {children && <div className="flex flex-wrap gap-3">{children}</div>}
    </Root>
  )
}
