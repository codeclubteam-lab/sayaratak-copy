import { basename } from "node:path"

/**
 * Seeded private files (receipts, verification documents) live in `api/demo/`, written by
 * `db:seed` in development and test only. Their upload `url` is `/demo/<file name>`.
 */
export const DEMO_DIR = new URL("../../../demo/", import.meta.url)

const PREFIX = "/demo/"

/** The demo `url` of a file named like the last part of `source` (`/mock/doc-01.svg` gives `/demo/doc-01.svg`). */
export function demoUrl(source: string) {
  return PREFIX + basename(source)
}

/** The file behind a demo upload `url`, or null when the url is not a plain demo file name. */
export function demoFile(url: string) {
  const name = url.slice(PREFIX.length)
  // Only a bare name inside the folder: no sub-folder, no `..`, so a bad row cannot read outside it.
  if (!url.startsWith(PREFIX) || !name || name !== basename(name)) return null
  return Bun.file(new URL(name, DEMO_DIR))
}
