import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

// Short fields side by side: two columns from `sm`, three from `lg` when `cols` is 3. A long field (title, description, a chip group) takes the whole row with `col-span-full` on it.
export function FieldGrid({
  cols = 2,
  className,
  children,
}: {
  cols?: 2 | 3
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "grid items-start gap-4 sm:grid-cols-2",
        cols === 3 && "lg:grid-cols-3",
        className
      )}
    >
      {children}
    </div>
  )
}
