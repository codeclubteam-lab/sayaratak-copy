import { ApiError } from "~/shared/http/errors"
import { type Executor, transaction } from "~/shared/db/tx"
import {
  adminInputSchema,
  createPlatformAdmin,
} from "~/modules/auth/auth.platform.service"

export { adminInputSchema }
type AdminInput = Parameters<typeof adminInputSchema.parse>[0]

/**
 * Creates the platform's one admin with a password and two-factor on (the email code step, A6), and
 * one audit row. Throws when the input breaks the shared rules, the email is taken or the platform
 * already has its admin.
 */
export async function createAdmin(ex: Executor, input: AdminInput) {
  const parsed = adminInputSchema.parse(input)
  try {
    const admin = await createPlatformAdmin(ex, parsed, {
      reason: "create-admin CLI",
    })
    return admin.id
  } catch (error) {
    if (!(error instanceof ApiError)) throw error
    if (error.code === "exists")
      throw new Error(`an account with ${parsed.email} exists`)
    throw new Error("an admin already exists")
  }
}

// Echo off while the password is typed. `stty` needs the terminal on stdin; when stdin is not a
// terminal (a pipe) there is nothing to hide and the call does nothing.
function askHidden(question: string) {
  Bun.spawnSync(["stty", "-echo"], { stdin: "inherit" })
  try {
    return prompt(question) ?? ""
  } finally {
    Bun.spawnSync(["stty", "echo"], { stdin: "inherit" })
    process.stdout.write("\n")
  }
}

if (import.meta.main) {
  const email = process.argv[2]
  if (!email) {
    process.stderr.write("usage: bun run create-admin <email>\n")
    process.exit(1)
  }
  const name = prompt("Name:") ?? ""
  const password = askHidden("Password:")
  if (askHidden("Password again:") !== password) {
    process.stderr.write("The passwords do not match\n")
    process.exit(1)
  }
  const parsed = adminInputSchema.safeParse({ email, name, password })
  if (!parsed.success) {
    // Shared schemas carry i18n keys as messages; the keys read well enough in a terminal.
    for (const issue of parsed.error.issues)
      process.stderr.write(`${issue.path.join(".")}: ${issue.message}\n`)
    process.exit(1)
  }
  const id = await transaction((tx) => createAdmin(tx, parsed.data))
  process.stdout.write(`Admin ${id} created for ${parsed.data.email}\n`)
  process.exit(0)
}
