import { z } from "zod";

/**
 * LEGACY SCHEMAS - DEPRECATED
 * 
 * Student profiles are now admin-controlled via CSV upload.
 * Students can only update their mobile number.
 * These schemas are kept for backward compatibility only.
 */

/**
 * Hostel Enum (DEPRECATED - profiles are readonly for students)
 */
export const HostelEnum = z.enum(["Neeladri", "Velankani"]);

/**
 * Class Section Enum (DEPRECATED - profiles are readonly for students)
 */
export const ClassSectionEnum = z.enum(["A", "B", "C", "D"]);

/**
 * Update Mobile Number Schema (ACTIVE)
 * Students can only update their mobile number
 */
export const UpdateStudentMobileSchema = z.object({
  mobile: z.string()
    .min(10, "Mobile number must be 10 digits")
    .max(10, "Mobile number must be 10 digits")
    .regex(/^\d+$/, "Mobile number must contain only digits"),
});

/**
 * DEPRECATED: Update Student Profile Schema
 * All fields are now admin-controlled
 * Kept for backward compatibility only
 */
export const UpdateStudentProfileSchema = z.object({
  userNumber: z.string().min(1, "User number is required"),
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email address").min(1, "Email is required"),
  roomNumber: z.string().min(1, "Room number is required"),
  mobile: z.string().min(1, "Mobile number is required"),
  hostel: HostelEnum,
  classSection: ClassSectionEnum,
  batchYear: z.number().int().min(2020).max(2030),
  whatsappNumber: z.string().optional(),
});

/**
 * DEPRECATED: Link User Number Schema
 * Linking is now automatic via email matching (CSV upload)
 */
export const LinkUserNumberSchema = z.object({
  userNumber: z.string().min(1, "User number is required"),
});

// Type exports
export type UpdateStudentMobileInput = z.infer<typeof UpdateStudentMobileSchema>;
export type UpdateStudentProfileInput = z.infer<typeof UpdateStudentProfileSchema>; // DEPRECATED
export type LinkUserNumberInput = z.infer<typeof LinkUserNumberSchema>; // DEPRECATED
export type Hostel = z.infer<typeof HostelEnum>;


