import { normalizeDigits } from "./digits"

// Readable URL: Arabic letters kept, harakat and tatweel dropped, Latin lowercased, 60 characters of words, then the short id.
export function makeListingSlug(title: string, city: string, id: string) {
  const words = normalizeDigits(`${title} ${city}`)
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .slice(0, 60)
    .replace(/^-|-$/g, "")
  return words ? `${words}-${id}` : id
}

// The id is whatever follows the last hyphen; the words in front only matter for SEO.
export const parseListingId = (slug: string) =>
  slug.slice(slug.lastIndexOf("-") + 1)

// The slug of a list entry (a city, a make, a part category) from its English name:
// "Land Cruiser Prado" gives "land-cruiser-prado". Letters and digits only, so an Arabic-only
// name gives "" and the caller falls back to its own word.
export const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
