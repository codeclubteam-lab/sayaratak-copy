import { useState, type ComponentProps, type ReactNode } from "react"
import { UploadIcon } from "lucide-react"

import { cn } from "@/lib/utils"

// A label around a visually hidden file input: keyboard, click and drop all work without script.
export function UploadDropzone({
  onFiles,
  multiple = false,
  accept = "image/*",
  inputProps,
  className,
  children,
}: {
  onFiles: (files: File[]) => void
  multiple?: boolean
  accept?: string
  // Id and aria attributes of the file input, when a `FormField` labels it.
  inputProps?: ComponentProps<"input">
  className?: string
  children: ReactNode
}) {
  const [over, setOver] = useState(false)
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        onFiles([...e.dataTransfer.files])
      }}
      className={cn(
        "flex min-h-11 cursor-pointer flex-col items-center justify-center gap-2 p-3 text-center text-ui has-focus-visible:ring-2 has-focus-visible:ring-ring",
        over ? "bg-accent" : "bg-muted",
        className
      )}
    >
      <input
        {...inputProps}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          onFiles([...(e.target.files ?? [])])
          e.target.value = ""
        }}
      />
      <UploadIcon aria-hidden className="size-5 text-muted-foreground" />
      <span className="text-muted-foreground">{children}</span>
    </label>
  )
}
