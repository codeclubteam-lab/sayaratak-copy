import { CircleCheckIcon, CircleIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { passwordSchema } from "@sayaratak/shared/schemas/fields"

// Each rule is a message of `passwordSchema`, so the hint and the validation cannot disagree.
const rules = [
  ["validation.password_min", "auth.password_rule_length"],
  ["validation.password_letter", "auth.password_rule_letter"],
  ["validation.password_digit", "auth.password_rule_digit"],
] as const
// Segment count, colour and word per strength: each met rule is one step, and 12 or more characters on top of all three is the fourth.
const levels = [
  { bar: "bg-muted", text: "text-muted-foreground", key: "" },
  {
    bar: "bg-destructive",
    text: "text-destructive",
    key: "auth.strength_weak",
  },
  { bar: "bg-warning", text: "text-warning", key: "auth.strength_fair" },
  { bar: "bg-primary", text: "text-primary", key: "auth.strength_good" },
  { bar: "bg-success", text: "text-success", key: "auth.strength_strong" },
]

export function PasswordHint({ value, id }: { value: string; id?: string }) {
  const { t } = useT()
  const failing = new Set(
    passwordSchema.safeParse(value).error?.issues.map((i) => i.message)
  )
  const met = value ? rules.length - failing.size : 0
  const score = met + (met === rules.length && value.length >= 12 ? 1 : 0)
  const level = levels[score] ?? levels[0]!
  return (
    <div id={id} aria-live="polite" className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div aria-hidden className="grid flex-1 grid-cols-4 gap-1">
          {[1, 2, 3, 4].map((n) => (
            <span
              key={n}
              className={`h-1 rounded-full motion-color ${n <= score ? level.bar : "bg-foreground/10"}`}
            />
          ))}
        </div>
        <span
          className={`min-w-12 text-end text-caption font-medium ${level.text}`}
        >
          {level.key && (
            <>
              <span className="sr-only">{t("auth.strength_label")} </span>
              {t(level.key)}
            </>
          )}
        </span>
      </div>
      <ul
        aria-label={t("auth.password_rules")}
        className="flex flex-wrap gap-x-4 gap-y-1 text-caption"
      >
        {rules.map(([rule, label]) => {
          const ok = Boolean(value) && !failing.has(rule)
          return (
            <li
              key={rule}
              className={`flex items-center gap-1.5 motion-color ${ok ? "text-success" : "text-muted-foreground"}`}
            >
              {ok ? (
                <CircleCheckIcon aria-hidden="true" className="size-3.5" />
              ) : (
                <CircleIcon aria-hidden="true" className="size-3.5" />
              )}
              {t(label)}
              <span className="sr-only">
                {t(ok ? "auth.password_rule_met" : "auth.password_rule_unmet")}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
