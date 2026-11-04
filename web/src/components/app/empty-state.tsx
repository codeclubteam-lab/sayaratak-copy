import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

// The one empty state of the app, on the shadcn Empty: icon tile, title, optional sentence, optional action, all centered.
// `level` is the heading level of the title: 2 for a page or pane, 3 inside a titled section. Pass `className` for the size (`h-64`) or a tighter `py-6`.
// The type roles sit on inner spans, because `cn` reads a role next to a text size as a clash.
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  level = 2,
  wide = false,
  className,
}: {
  icon: LucideIcon
  title: string
  body?: string
  action?: ReactNode
  level?: 2 | 3
  // Lets the action grow past the 24 rem column (a row of suggestion chips).
  wide?: boolean
  className?: string
}) {
  return (
    <Empty className={cn("py-12", className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon aria-hidden="true" strokeWidth={1.5} />
        </EmptyMedia>
        {/* tracking-normal undoes the primitive's tracking-tight: letter spacing breaks Arabic joining (A5). */}
        <EmptyTitle
          role="heading"
          aria-level={level}
          className="tracking-normal"
        >
          <span className="text-title font-semibold">{title}</span>
        </EmptyTitle>
        {body && (
          <EmptyDescription>
            <span className="text-body">{body}</span>
          </EmptyDescription>
        )}
      </EmptyHeader>
      {action && (
        <EmptyContent className={wide ? "max-w-none" : undefined}>
          {action}
        </EmptyContent>
      )}
    </Empty>
  )
}
