import { useState } from "react"

import { ApiError } from "@/lib/api/client"
import { uploadMedia } from "@/lib/api/upload"
import { useT } from "@/lib/i18n/use-t"
import { processVideo, type ProcessedVideo } from "@/lib/video-process"
import type { Media } from "@sayaratak/shared/schemas/listing"
import { Button } from "@/components/ui/button"
import { RemoveButton } from "@/components/app/remove-button"
import { Progress } from "@/components/ui/progress"
import { GallerySlide } from "./gallery-slide"
import { UploadDropzone } from "./upload-dropzone"

type State = {
  status: "idle" | "working" | "failed" | "error"
  progress: number
  error?: string
  job?: ProcessedVideo
}
const idle: State = { status: "idle", progress: 0 }

// One video of at most 30 MB and 60 s. Uploads the file and its poster frame together.
export function VideoUploader({
  value,
  onChange,
  label,
}: {
  value: Media | null
  onChange: (media: Media | null) => void
  label?: string
}) {
  const { t } = useT()
  const [state, setState] = useState<State>(idle)
  const retryJob = state.job

  async function run(source: File | ProcessedVideo) {
    setState({ status: "working", progress: 0 })
    try {
      const job = source instanceof File ? await processVideo(source) : source
      setState((s) => ({ ...s, job }))
      const form = new FormData()
      form.set("file", job.file)
      form.set("poster", job.poster, "poster.webp")
      form.set("width", String(job.width))
      form.set("height", String(job.height))
      form.set("placeholderColor", job.placeholderColor)
      const media = await uploadMedia(form, (progress) =>
        setState((s) => ({ ...s, progress }))
      )
      setState(idle)
      onChange(media)
    } catch (error) {
      const key =
        error instanceof ApiError
          ? error.fields?.file
          : error instanceof Error
            ? error.message
            : undefined
      setState((s) =>
        key?.startsWith("validation.")
          ? { status: "error", progress: 0, error: key }
          : { ...s, status: "failed" }
      )
    }
  }

  return (
    <div className="flex max-w-sm flex-col items-start gap-2">
      {label && <span className="text-ui font-medium">{label}</span>}
      {value && state.status === "idle" ? (
        <>
          <div className="w-full">
            <GallerySlide
              media={value}
              alt={label ?? ""}
              sizes="384px"
              className="aspect-video w-full"
            />
          </div>
          <RemoveButton
            variant="ghost"
            title={t("common.remove_video_title")}
            onConfirm={() => onChange(null)}
          >
            {t("common.remove")}
          </RemoveButton>
        </>
      ) : state.status === "working" ? (
        <Progress
          value={state.progress}
          aria-label={t("common.uploading")}
          className="w-full"
        />
      ) : (
        <>
          <UploadDropzone
            accept="video/*"
            onFiles={([file]) => file && void run(file)}
            className="aspect-video w-full rounded-lg"
          >
            {t("common.add_video")}
          </UploadDropzone>
          <p className="text-caption text-muted-foreground">
            {t("common.video_hint")}
          </p>
          {state.status !== "idle" && (
            <div role="alert" className="flex items-center gap-2">
              <span className="text-ui text-destructive">
                {t(state.error ?? "common.upload_failed")}
              </span>
              {retryJob && (
                <Button variant="ghost" onClick={() => void run(retryJob)}>
                  {t("common.retry")}
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
