import type { FileStore } from "./store"

// What the fake reports for every image: a 3:2 photo and a neutral color, so
// tests can tell the stored values from what a client sent.
export const FAKE_SIZE = { width: 1200, height: 800 }
export const FAKE_COLOR = "#7a8580"
const FAKE_CLOUD = "fake-cloud"

/** Files kept in memory, for tests and for development without a Cloudinary account. */
export function fakeStore(): FileStore & {
  saved: Map<string, Uint8Array<ArrayBuffer>>
} {
  const saved = new Map<string, Uint8Array<ArrayBuffer>>()
  let next = 0
  return {
    cloudName: FAKE_CLOUD,
    saved,
    put(file) {
      next += 1
      const publicId = `sayaratak/test/${file.folder}/f${next}`
      saved.set(publicId, file.bytes)
      return Promise.resolve({
        publicId,
        ...FAKE_SIZE,
        placeholderColor: FAKE_COLOR,
      })
    },
    read(file) {
      const bytes = saved.get(file.publicId)
      if (!bytes) return Promise.reject(new Error("file not found"))
      return Promise.resolve(bytes)
    },
    remove(file) {
      saved.delete(file.publicId)
      return Promise.resolve()
    },
  }
}
