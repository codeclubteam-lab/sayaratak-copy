import { createContext, useContext, useId, type ReactNode } from "react"

import { useT } from "@/lib/i18n/use-t"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { FieldError } from "./field-error"

export type ControlProps = {
  id: string
  "aria-invalid": boolean
  "aria-describedby": string | undefined
  "aria-required": true | undefined
}

// How a form marks its fields. "optional" (the default) writes "(Optional)" on the few optional ones; "required" writes an asterisk on the required ones and no text on the rest. A form where most fields are optional picks "required". "none" marks nothing, for a form where every field is optional (the search filters).
export const FieldMarks = createContext<"optional" | "required" | "none">(
  "optional"
)

// Label, control, hint and translated error wired together with ids. The control comes in as a render prop.
export function FormField({
  label,
  error,
  description,
  optional,
  className,
  children,
}: {
  label: string
  error?: string
  description?: string
  optional?: boolean
  className?: string
  children: (control: ControlProps) => ReactNode
}) {
  const { t } = useT()
  const id = useId()
  const marks = useContext(FieldMarks)
  const required = marks === "required" && !optional
  const describedBy =
    [error && `${id}-error`, description && `${id}-hint`]
      .filter(Boolean)
      .join(" ") || undefined
  return (
    <Field data-invalid={Boolean(error)} className={className}>
      <FieldLabel htmlFor={id}>
        {label}
        {marks === "optional"
          ? optional && (
              <span className="font-normal text-muted-foreground">
                ({t("form.optional")})
              </span>
            )
          : required && <span aria-hidden="true"> *</span>}
      </FieldLabel>
      {children({
        id,
        "aria-invalid": Boolean(error),
        "aria-describedby": describedBy,
        "aria-required": required || undefined,
      })}
      {description && (
        <FieldDescription id={`${id}-hint`}>{description}</FieldDescription>
      )}
      <FieldError id={`${id}-error`} message={error} />
    </Field>
  )
}
