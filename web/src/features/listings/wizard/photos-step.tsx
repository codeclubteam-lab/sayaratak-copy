import { useQuery } from "@tanstack/react-query"
import { useFormContext } from "react-hook-form"

import { FieldError } from "@/components/app/field-error"
import { ImageUploader } from "@/components/app/image-uploader"
import { VideoUploader } from "@/components/app/video-uploader"
import { meQuery } from "@/features/auth/me-query"
import { useT } from "@/lib/i18n/use-t"
import type { Media } from "@sayaratak/shared/schemas/listing"
import { PhotosSignIn } from "./photos-sign-in"
import { useStepFields } from "./use-step-fields"

const tips = {
  vehicle: ["front", "back", "interior", "odometer"],
  part: ["part_whole", "part_label", "part_wear"],
}

// Step `photos`. Signed out, it asks for sign in first: uploads need an account. The form keeps one `media` list, photos first and the video last, so the cover is always a photo. Each uploader changes only its own part, read from the form when it finishes, because uploads end in any order.
export function PhotosStep() {
  const { t } = useT()
  const { data: me } = useQuery(meQuery)
  const { getValues } = useFormContext()
  const { values, error, set } = useStepFields()
  const current = (): Media[] => getValues("media") ?? []
  const media: Media[] = values.media ?? []
  const images = media.filter((m) => m.type === "image")
  const video = media.find((m) => m.type === "video") ?? null
  return (
    <>
      {me ? (
        <>
          <div className="flex flex-col gap-1">
            <ImageUploader
              mode="multi"
              min={3}
              max={20}
              label={t("post.photos_label")}
              value={images}
              onChange={(next) =>
                set("media", [
                  ...next,
                  ...current().filter((m) => m.type === "video"),
                ])
              }
            />
            <FieldError message={error("media")} />
          </div>
          <VideoUploader
            label={t("post.video_label")}
            value={video}
            onChange={(next) =>
              set("media", [
                ...current().filter((m) => m.type === "image"),
                ...(next ? [next] : []),
              ])
            }
          />
        </>
      ) : (
        <div className="flex flex-col gap-1">
          <PhotosSignIn />
          <FieldError message={error("media")} />
        </div>
      )}
      <section className="flex flex-col gap-2">
        <h2 className="text-ui font-medium">{t("post.tips_title")}</h2>
        <ul className="list-disc ps-5 text-ui text-muted-foreground">
          {tips[values.kind === "part" ? "part" : "vehicle"].map((tip) => (
            <li key={tip}>{t(`post.tip_${tip}`)}</li>
          ))}
        </ul>
      </section>
    </>
  )
}
