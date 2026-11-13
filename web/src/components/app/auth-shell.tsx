import type { ReactNode } from "react"

import { AuthCarousel } from "./auth-panel/auth-carousel"
import { BrandLogo } from "./brand-logo"
import { LanguageSwitcher } from "./language-switcher"

// Sign in, sign up, password reset and the first onboarding pages: the form on the page background (so fields are white), and from lg a pale blue side panel with the product carousel (not on onboarding). The panel is `display: none` below lg, so its one photo never loads on a phone. The form sits at a fixed top (aligned with the headline), so a taller form never moves it. The auth routes share one shell through their layout route, so the carousel keeps running between them; its own view-transition-name keeps the page cross fade off it.
export function AuthShell({
  action,
  carousel = true,
  children,
}: {
  // Onboarding has no side panel: its form is centred on the page.
  carousel?: boolean
  // Sits next to the language switch, e.g. onboarding's Save and exit.
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className={`grid min-h-dvh ${carousel ? "lg:grid-cols-2" : ""}`}>
      <div className="flex flex-col px-4 md:px-6">
        <header className="flex h-16 items-center justify-between gap-3">
          <BrandLogo />
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            {action}
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 pt-8 pb-12">
          {children}
        </main>
      </div>
      {carousel && (
        <aside className="sticky top-4 mx-4 my-4 hidden h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-md bg-[color-mix(in_srgb,var(--primary)_14%,var(--card))] [view-transition-name:auth-panel] lg:flex">
          <AuthCarousel />
        </aside>
      )}
    </div>
  )
}
