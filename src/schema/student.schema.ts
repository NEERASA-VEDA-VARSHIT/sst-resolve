import { z } from "zod";

/**
 * Hostel Enum
 */
export const HostelEnum = z.enum(["Neeladri", "Velankani", "NA"]);

/**
 * Update Student Profile Schema
 */
export const UpdateStudentProfileSchema = z.object({
  userNumber: z.string().min(1, "User number is required").optional(),
  fullName: z.string().optional(),
  email: z.string().email("Invalid email address").optional(),
  roomNumber: z.string().optional(),
  mobile: z.string().optional(),
  hostel: HostelEnum.optional(),
  whatsappNumber: z.string().optional(),
});

/**
 * Link User Number Schema
 */
export const LinkUserNumberSchema = z.object({
  userNumber: z.string().min(1, "User number is required"),
});

// Type exports
export type UpdateStudentProfileInput = z.infer<typeof UpdateStudentProfileSchema>;
export type LinkUserNumberInput = z.infer<typeof LinkUserNumberSchema>;
export type Hostel = z.infer<typeof HostelEnum>;

