import { z } from "zod"

// The word typed before a restore is the viewer's language's (owner choice), so an Arabic admin never switches keyboards.
export const restoreConfirmSchema = (phrase: string) =>
  z.object({
    phrase: z
      .string()
      .trim()
      .refine((v) => v === phrase, "validation.restore_phrase"),
  })
export type RestoreConfirm = z.infer<ReturnType<typeof restoreConfirmSchema>>
