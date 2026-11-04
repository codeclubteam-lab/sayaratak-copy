import { averageColor } from "./image-process"

export const MAX_VIDEO_BYTES = 30 * 1024 * 1024
export const MAX_VIDEO_SECONDS = 60
const POSTER_WIDTH = 640

export type ProcessedVideo = {
  file: File
  poster: Blob
  width: number
  height: number
  placeholderColor: string
}

const once = (target: HTMLVideoElement, event: string) =>
  new Promise<void>((resolve, reject) => {
    target.addEventListener(event, () => resolve(), { once: true })
    target.addEventListener(
      "error",
      () => reject(new Error("validation.video_type")),
      { once: true }
    )
  })

// Checks size and length from the metadata, then grabs the frame at 1 s as a poster.
// Errors carry a `validation.*` key as their message.
export async function processVideo(file: File): Promise<ProcessedVideo> {
  if (!file.type.startsWith("video/")) throw new Error("validation.video_type")
  if (file.size > MAX_VIDEO_BYTES) throw new Error("validation.video_size")
  const video = document.createElement("video")
  video.preload = "metadata"
  video.muted = true
  const url = URL.createObjectURL(file)
  try {
    video.src = url
    await once(video, "loadedmetadata")
    if (video.duration > MAX_VIDEO_SECONDS)
      throw new Error("validation.video_length")
    video.currentTime = Math.min(1, video.duration)
    await once(video, "seeked")
    const scale = Math.min(1, POSTER_WIDTH / video.videoWidth)
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height)
    const poster = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.8)
    )
    if (!poster) throw new Error("validation.video_type")
    return {
      file,
      poster,
      width: video.videoWidth,
      height: video.videoHeight,
      placeholderColor: averageColor(canvas),
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}
