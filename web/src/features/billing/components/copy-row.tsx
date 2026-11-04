import { CopyButton } from "@/components/app/copy-button"

// A label, a value isolated for account numbers and codes, and a copy button. Sits inside a `dl`.
export function CopyRow({
  label,
  value,
  copyLabel,
}: {
  label: string
  value: string
  copyLabel: string
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-1 text-ui font-medium">
        <bdi className="min-w-0 break-words num">{value}</bdi>
        <CopyButton value={value} label={copyLabel} />
      </dd>
    </div>
  )
}
