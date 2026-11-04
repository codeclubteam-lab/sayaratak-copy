import { mediaSchema, type Media } from "@sayaratak/shared/schemas/listing"
import { ApiError, buildUrl, errorFrom } from "./client"

// fetch has no upload progress, so uploads go through XMLHttpRequest.
export function uploadMedia(
  form: FormData,
  onProgress: (percent: number) => void
) {
  return new Promise<Media>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", buildUrl("/uploads"))
    xhr.withCredentials = true
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onerror = () => reject(new ApiError(0, "network"))
    xhr.onload = () => {
      let body: unknown
      try {
        body = JSON.parse(xhr.responseText)
      } catch {
        body = {}
      }
      if (xhr.status >= 400) return reject(errorFrom(xhr.status, body))
      resolve(mediaSchema.parse(body))
    }
    xhr.send(form)
  })
}
