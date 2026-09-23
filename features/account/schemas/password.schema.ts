import { z } from "zod"

/**
 * The same schema validates the form and the service (§6).
 *
 * The current password is required even though the session already proves who
 * this is: a session can be a borrowed laptop, and re-typing the old password
 * is what stops someone who walks up to an unlocked screen from locking the
 * owner out of their own console.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z
      .string()
      .min(10, "Use at least 10 characters")
      .max(200, "That is longer than we can store"),
    confirmPassword: z.string().min(1, "Type it a second time"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Those two do not match",
    path: ["confirmPassword"],
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: "Pick something different from your current password",
    path: ["newPassword"],
  })

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
