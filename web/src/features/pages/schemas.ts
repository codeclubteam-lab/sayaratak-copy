import type { z } from "zod"

import { contactInputSchema } from "@sayaratak/shared/schemas/inputs"

// The form and the API take the same shape (A8 `POST /contact`).
export const contactFormSchema = contactInputSchema
export type ContactForm = z.input<typeof contactFormSchema>
