import { z } from "zod";

// Roll number validation pattern (xxbcsxxxxx)
const rollNoPattern = /^\d{2}bcs\d{5}$/i;

// Phone number validation (Indian format)
const phonePattern = /^(\+91)?[6-9]\d{9}$/;

// Email validation
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Zod schema for ticket form validation
 * Replaces manual validateForm() logic with type-safe validation
 */
export const ticketFormSchema = z.object({
  // Basic ticket details
  categoryId: z.number({
    message: "Category is required and must be a valid number",
  }).positive("Please select a valid category"),
  
  description: z.string()
    .min(10, "Description must be at least 10 characters")
    .max(1000, "Description must not exceed 1000 characters"),
  
  // Optional fields
  subcategoryId: z.number().positive().nullable().optional(),
  subSubcategoryId: z.number().positive().nullable().optional(),
  location: z.string().optional(),
  
  // Profile fields (dynamic validation)
  profile: z.record(z.string(), z.any()).optional(),
  
  // Dynamic subcategory fields
  details: z.record(z.string(), z.any()).optional(),
  
  // Legacy contact fields (optional, used if no profileFields config)
  contactRollNo: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  
  // Legacy category-specific fields
  roomNumber: z.string().optional(),
  batchYear: z.string().optional(),
  classSection: z.string().optional(),
});

/**
 * Dynamic field validator based on field configuration
 */
export function validateDynamicField(
  field: {
    slug: string;
    name: string;
    field_type: string;
    required: boolean;
    validation_rules?: Record<string, unknown> | null;
  },
  value: unknown
): { valid: boolean; error?: string } {
  // Special handling for boolean fields
  if (field.field_type === "boolean" && field.required) {
    const isBool = 
      value === true || 
      value === false || 
      value === "true" || 
      value === "false";
    
    if (!isBool) {
      return { valid: false, error: `${field.name} is required` };
    }
    return { valid: true };
  }
  
  // For non-boolean required fields
  if (field.required) {
    if (
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "")
    ) {
      return { valid: false, error: `${field.name} is required` };
    }
  }
  
  // Apply additional validation rules
  if (value !== undefined && value !== null && field.validation_rules) {
    type ValidationRules = {
      minLength?: number | null;
      maxLength?: number | null;
      pattern?: string | null;
      errorMessage?: string | null;
      min?: number | null;
      max?: number | null;
      [key: string]: unknown;
    };
    const rules = field.validation_rules as ValidationRules;
    
    if (typeof value === "string") {
      const minLength = typeof rules.minLength === 'number' ? rules.minLength : null;
      const maxLength = typeof rules.maxLength === 'number' ? rules.maxLength : null;
      const pattern = typeof rules.pattern === 'string' ? rules.pattern : null;
      const errorMessage = typeof rules.errorMessage === 'string' ? rules.errorMessage : null;
      
      if (minLength !== null && value.length < minLength) {
        return {
          valid: false,
          error: `${field.name} must be at least ${minLength} characters`,
        };
      }
      if (maxLength !== null && value.length > maxLength) {
        return {
          valid: false,
          error: `${field.name} must not exceed ${maxLength} characters`,
        };
      }
      if (pattern !== null && !new RegExp(pattern).test(value)) {
        return {
          valid: false,
          error: errorMessage || `${field.name} format is invalid`,
        };
      }
    }
    
    if (typeof value === "number") {
      const min = typeof rules.min === 'number' ? rules.min : null;
      const max = typeof rules.max === 'number' ? rules.max : null;
      
      if (min !== null && value < min) {
        return {
          valid: false,
          error: `${field.name} must be at least ${min}`,
        };
      }
      if (max !== null && value > max) {
        return {
          valid: false,
          error: `${field.name} must not exceed ${max}`,
        };
      }
    }
  }
  
  return { valid: true };
}

/**
 * Profile field validator
 */
export function validateProfileField(
  field: {
    field_name: string;
    storage_key: string;
    required: boolean;
  },
  value: unknown
): { valid: boolean; error?: string } {
  const fieldLabels: Record<string, string> = {
    rollNo: "Roll Number",
    name: "Full Name",
    email: "Email",
    phone: "Phone Number",
    hostel: "Hostel",
    roomNumber: "Room Number",
    batchYear: "Batch Year",
    classSection: "Class Section",
  };
  
  const label = fieldLabels[field.field_name] || field.field_name;
  
  if (field.required) {
    if (!value || (typeof value === "string" && !value.trim())) {
      return { valid: false, error: `${label} is required` };
    }
    
    // Additional validation for specific field types
    if (typeof value === "string" && value.trim()) {
      if (field.field_name === "rollNo" && !rollNoPattern.test(value)) {
        return {
          valid: false,
          error: "Roll number must be in format: xxbcsxxxxx (e.g., 24bcs10005)",
        };
      }
      
      if (field.field_name === "phone") {
        const cleaned = value.replace(/[\s\-+]/g, "");
        if (!phonePattern.test(cleaned)) {
          return {
            valid: false,
            error: "Invalid phone number format (should be 10 digits starting with 6-9)",
          };
        }
      }
      
      if (field.field_name === "email" && !emailPattern.test(value)) {
        return { valid: false, error: "Invalid email format" };
      }
    }
  }
  
  return { valid: true };
}

export type TicketFormData = z.infer<typeof ticketFormSchema>;
