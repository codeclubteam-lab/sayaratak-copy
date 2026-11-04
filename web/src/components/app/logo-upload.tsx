import type { Media } from "@sayaratak/shared/schemas/listing"
import { ImageUploader } from "./image-uploader"

// Forms store `media.id` and never call ImageUploader directly for this.
export function LogoUpload({
  value,
  onChange,
  label,
}: {
  value: Media | null
  onChange: (media: Media | null) => void
  label: string
}) {
  return (
    <ImageUploader
      mode="single"
      max={1}
      shape="square"
      label={label}
      value={value ? [value] : []}
      onChange={(next) => onChange(next[0] ?? null)}
    />
  )
}
