import { useEffect, useRef, useState } from "react"

import { useImageUploads } from "@/hooks/use-image-uploads"
import { useT } from "@/lib/i18n/use-t"
import { cn } from "@/lib/utils"
import type { Media } from "@sayaratak/shared/schemas/listing"
import { Button } from "@/components/ui/button"
import { RemoveButton } from "@/components/app/remove-button"
import { uploadBoxes, type ImageUploaderProps } from "./image-uploader"
import { MediaImage } from "./media-image"
import { MediaTile } from "./media-tile"
import { PendingUploadTile } from "./pending-upload-tile"
import { UploadDropzone } from "./upload-dropzone"

export function ImageUploaderImpl({
  mode,
  value,
  onChange,
  min = 0,
  max = mode === "single" ? 1 : 20,
  shape = "wide",
  label,
  cover = true,
}: ImageUploaderProps) {
  const { t } = useT()
  const single = mode === "single"
  // Uploads finish later, so they append to the newest value, not the one this render saw.
  const latest = useRef(value)
  useEffect(() => {
    latest.current = value
  })
  const commit = (next: Media[]) => {
    latest.current = next
    onChange(next)
  }
  const { items, add, retry, dismiss } = useImageUploads((media) =>
    commit(single ? [media] : [...latest.current, media])
  )
  const picker = useRef<HTMLInputElement>(null)
  const dragFrom = useRef<number | null>(null)
  const [announce, setAnnounce] = useState("")
  const room = single
    ? items.length
      ? 0
      : 1
    : Math.max(0, max - value.length - items.length)
  const take = (files: File[]) => add(files.slice(0, room))
  const move = (from: number, to: number) => {
    const next = [...value]
    const [moved] = next.splice(from, 1)
    if (!moved) return
    next.splice(to, 0, moved)
    commit(next)
    setAnnounce(t("common.count_of", { current: to + 1, max: next.length }))
  }

  if (single) {
    const current = value[0]
    const pending = items[0]
    return (
      <div
        className={cn(
          "flex flex-col items-start gap-2",
          shape === "wide" && "w-full max-w-lg"
        )}
      >
        {label && <span className="text-ui font-medium">{label}</span>}
        <div
          className={cn(
            "relative overflow-hidden bg-muted",
            uploadBoxes[shape]
          )}
        >
          {pending ? (
            <PendingUploadTile
              item={pending}
              onRetry={() => retry(pending.key)}
              onRemove={() => dismiss(pending.key)}
              className="size-full"
            />
          ) : current ? (
            <MediaImage
              src={current.url}
              placeholderColor={current.placeholderColor}
              alt={label ?? ""}
              className="size-full rounded-[inherit]"
            />
          ) : (
            <UploadDropzone onFiles={take} className="size-full">
              {t("common.upload_photo")}
            </UploadDropzone>
          )}
        </div>
        {current && !pending && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => picker.current?.click()}>
              {t("common.upload_change")}
            </Button>
            <input
              ref={picker}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                take([...(e.target.files ?? [])])
                e.target.value = ""
              }}
            />
            <RemoveButton
              variant="ghost"
              title={t("common.remove_photo_title")}
              onConfirm={() => commit([])}
            >
              {t("common.remove")}
            </RemoveButton>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        {label && <span className="text-ui font-medium">{label}</span>}
        <span className="text-caption text-muted-foreground" aria-live="polite">
          {t("common.count_of", { current: value.length, max })}
          {value.length < min && ` · ${t("common.count_min", { min })}`}
        </span>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {value.map((media, index) => (
          <li key={media.id}>
            <MediaTile
              media={media}
              index={index}
              count={value.length}
              cover={cover}
              onMove={(to) => move(index, to)}
              onRemove={() => commit(value.filter((m) => m.id !== media.id))}
              onDragStart={() => {
                dragFrom.current = index
              }}
              onDropHere={() => {
                if (dragFrom.current !== null) move(dragFrom.current, index)
                dragFrom.current = null
              }}
            />
          </li>
        ))}
        {items.map((item) => (
          <li key={item.key}>
            <PendingUploadTile
              item={item}
              onRetry={() => retry(item.key)}
              onRemove={() => dismiss(item.key)}
              className="aspect-[4/3] rounded-lg"
            />
          </li>
        ))}
        {room > 0 && (
          <li>
            <UploadDropzone
              multiple
              onFiles={take}
              className="aspect-[4/3] rounded-lg"
            >
              {value.length || items.length
                ? t("common.upload_photos")
                : t("common.upload_drop")}
            </UploadDropzone>
          </li>
        )}
      </ul>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  )
}
