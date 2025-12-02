import { z } from "zod";

/**
 * Student-related validation schemas
 * Recreated based on how the API routes consume them.
 */

// Simple mobile validation: non-empty string, reasonable length
export const UpdateStudentMobileSchema = z.object({
  mobile: z
    .string()
    .trim()
    .min(8, "Mobile number is too short")
    .max(20, "Mobile number is too long"),
});

/**
 * Profile updates coming from the student (hostel & room).
 *
 * API passes { hostel_id, room_number } in and expects
 * an output object with { hostel_id, room_no }.
 */
export const UpdateStudentProfileSchema = z
  .object({
    hostel_id: z
      .number()
      .int()
      .positive()
      .nullable()
      .optional(),
    room_number: z
      .string()
      .trim()
      .max(16, "Room number is too long")
      .nullable()
      .optional(),
  })
  .transform((value) => ({
    hostel_id: value.hostel_id ?? null,
    room_no: value.room_number ?? null,
  }));

/**
 * Extended profile schema (for future use / admin flows).
 * Currently not directly used but kept for completeness.
 */
export const UpdateStudentProfileFullSchema = z.object({
  hostel_id: z.number().int().positive().nullable().optional(),
  batch_id: z.number().int().positive().nullable().optional(),
  class_section_id: z.number().int().positive().nullable().optional(),
  room_no: z.string().trim().max(16).nullable().optional(),
});

/**
 * Superadmin single-student update.
 * Used by /api/superadmin/students/[id].
 */
export const AdminUpdateStudentSchema = z
  .object({
    full_name: z.string().trim().max(255).optional(),
    phone: z
      .string()
      .trim()
      .min(8, "Mobile number is too short")
      .max(20, "Mobile number is too long")
      .optional(),
    hostel_id: z.number().int().positive().nullable().optional(),
    batch_id: z.number().int().positive().nullable().optional(),
    class_section_id: z.number().int().positive().nullable().optional(),
    room_no: z.string().trim().max(16).nullable().optional(),
    blood_group: z
      .string()
      .trim()
      .toUpperCase()
      .refine(
        (val) =>
          !val ||
          ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].includes(val),
        {
          message:
            "Blood group must be one of A+, A-, B+, B-, O+, O-, AB+, AB-",
        }
      )
      .nullable()
      .optional(),
  })
  .strict();

/**
 * Superadmin bulk-edit students.
 * Body shape: { student_ids: number[], updates: Partial<AdminUpdateStudentSchema> }
 */
export const BulkEditStudentsSchema = z.object({
  student_ids: z
    .array(z.number().int().positive())
    .min(1, "At least one student id is required"),
  updates: AdminUpdateStudentSchema.partial(),
});
