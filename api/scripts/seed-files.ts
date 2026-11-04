import { mkdir } from "node:fs/promises"

import { DEMO_DIR, demoFile, demoUrl } from "~/shared/files/demo"

import type { buildSeed } from "../../web/src/mocks/seed"

type Seed = ReturnType<typeof buildSeed>

const WEB_PUBLIC = new URL("../../web/public/", import.meta.url)

/**
 * Writes the files behind the seeded private uploads into the demo folder: the mock's drawn
 * receipts (their date follows the seed clock, so they are written on every run) and copies of
 * web's verification document SVGs.
 */
export async function writeDemoFiles(data: Seed) {
  await mkdir(DEMO_DIR, { recursive: true })
  const writes = [...data.uploads.values()].map((upload) =>
    write(`/demo/${upload.name}`, upload.bytes)
  )
  const docs = new Set(
    data.verifications.flatMap((v) => v.documents.map((d) => d.url))
  )
  for (const url of docs)
    writes.push(write(demoUrl(url), Bun.file(new URL(`.${url}`, WEB_PUBLIC))))
  await Promise.all(writes)
}

async function write(url: string, body: ArrayBuffer | Blob) {
  const file = demoFile(url)
  if (!file) throw new Error(`not a demo file name: ${url}`)
  await Bun.write(file, body)
}
