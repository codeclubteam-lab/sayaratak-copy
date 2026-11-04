const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz"
const ID_LENGTH = 8

/** A new id in the mock's `prefix-xxxxxxxx` shape (A5), from a secure random source. */
export function newId(prefix: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(ID_LENGTH))
  // 256 is not a multiple of 36, so the first 4 letters come up a little more often; ids only
  // need to be unique, not uniform.
  const suffix = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join(
    ""
  )
  return `${prefix}-${suffix}`
}

const LISTING_ID_LENGTH = 5

/** A listing id: `l` and five base36 characters, the end of every listing slug (A5). */
export function newListingId() {
  const bytes = crypto.getRandomValues(new Uint8Array(LISTING_ID_LENGTH))
  return `l${Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("")}`
}
