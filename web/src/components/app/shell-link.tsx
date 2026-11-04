import type { ReactNode } from "react"
import { useLocation } from "@tanstack/react-router"

import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"

// Native links also reach the documented URLs before their later-phase routes exist.
export function ShellLink({
  path,
  children,
  className = "text-ui inline-flex min-h-11 items-center rounded-lg font-medium hover:text-primary md:min-h-10",
  label,
  newTab,
  onClick,
}: {
  path: string
  children: ReactNode
  className?: string
  label?: string
  newTab?: boolean
  onClick?: () => void
}) {
  const { locale } = useT()
  const pathname = useLocation({ select: (location) => location.pathname })
  const href = localeHref(path, locale)
  const active = pathname === href.split(/[?#]/)[0]
  return (
    <a
      href={href}
      aria-label={label}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noopener" : undefined}
      aria-current={active ? "page" : undefined}
      className={`${className} ${active ? "text-primary" : ""}`}
      onClick={onClick}
    >
      {children}
    </a>
  )
}
