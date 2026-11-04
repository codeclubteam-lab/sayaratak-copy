import { env } from "~/env"

import { cloudinaryStore } from "./cloudinary"
import { fakeStore } from "./fake"
import type { MediaMime } from "./sniff"

/** Where a file lives: public CDN delivery, or private and streamed by the API (A8). */
export type Delivery = "public" | "private"

export type StoredFile = {
  publicId: string
  /** Read by the file host from the stored file, never from the client. */
  width: number
  height: number
  placeholderColor: string | null
}

export type PutFile = {
  bytes: Uint8Array<ArrayBuffer>
  mime: MediaMime
  delivery: Delivery
  /** Folder under the environment's root, such as `images` or `receipts`. */
  folder: string
}

export type FileStore = {
  cloudName: string
  put(file: PutFile): Promise<StoredFile>
  /** A private file's bytes, fetched server side (A8). */
  read(file: {
    publicId: string
    mime: string
  }): Promise<Uint8Array<ArrayBuffer>>
  remove(file: {
    publicId: string
    mime: string
    delivery: Delivery
  }): Promise<void>
}

/**
 * Cloudinary when `CLOUDINARY_URL` is set, else an in-memory fake (A13: only
 * mail and files are faked). Tests use the fake unless `CLOUDINARY_LIVE=1`,
 * which runs the live check of 4.2 against the owner's account.
 */
export const files: FileStore =
  env.CLOUDINARY_URL &&
  (env.NODE_ENV !== "test" || Bun.env.CLOUDINARY_LIVE === "1")
    ? cloudinaryStore(env.CLOUDINARY_URL)
    : fakeStore()
