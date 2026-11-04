import { useEffect, useRef, useState } from "react"
import { nanoid } from "nanoid"

import { ApiError } from "@/lib/api/client"
import { uploadMedia } from "@/lib/api/upload"
import { processImage, type ProcessedImage } from "@/lib/image-process"
import type { Media } from "@sayaratak/shared/schemas/listing"

// `failed` can be retried; `error` cannot (the file itself is the problem) and carries a validation key.
export type PendingUpload = {
  key: string
  progress: number
  status: "uploading" | "failed" | "error"
  error?: string
  preview?: string
  job?: ProcessedImage
}

// Resizes each file in the browser, uploads it with progress, and hands back the Media.
export function useImageUploads(onDone: (media: Media) => void) {
  const [items, setItems] = useState<PendingUpload[]>([])
  const previews = useRef(new Set<string>())
  const removed = useRef(new Set<string>())
  useEffect(() => {
    const urls = previews.current
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [])

  const patch = (key: string, change: Partial<PendingUpload>) =>
    setItems((all) => all.map((i) => (i.key === key ? { ...i, ...change } : i)))
  const drop = (key: string) => {
    removed.current.add(key)
    setItems((all) => all.filter((i) => i.key !== key))
  }

  async function run(key: string, source: File | ProcessedImage) {
    try {
      const job = source instanceof File ? await processImage(source) : source
      const preview = URL.createObjectURL(job.blob)
      previews.current.add(preview)
      patch(key, { job, preview, progress: 0, status: "uploading" })
      const form = new FormData()
      form.set("file", job.blob, `${key}.webp`)
      form.set("width", String(job.width))
      form.set("height", String(job.height))
      form.set("placeholderColor", job.placeholderColor)
      const media = await uploadMedia(form, (progress) =>
        patch(key, { progress })
      )
      if (removed.current.has(key)) return
      drop(key)
      onDone(media)
    } catch (error) {
      if (removed.current.has(key)) return
      const fileError =
        error instanceof ApiError
          ? error.fields?.file
          : error instanceof Error
            ? error.message
            : undefined
      if (fileError?.startsWith("validation."))
        patch(key, { status: "error", error: fileError })
      else patch(key, { status: "failed" })
    }
  }

  return {
    items,
    add(files: File[]) {
      for (const file of files) {
        const key = nanoid()
        setItems((all) => [...all, { key, progress: 0, status: "uploading" }])
        void run(key, file)
      }
    },
    retry(key: string) {
      const job = items.find((i) => i.key === key)?.job
      if (!job) return
      patch(key, { status: "uploading", progress: 0 })
      void run(key, job)
    },
    dismiss: drop,
  }
}
