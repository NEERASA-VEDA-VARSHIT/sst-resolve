/**
 * Centralized form validation utilities
 * Replaces duplicate validation logic across 15+ files
 */

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: unknown) => string | null;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Validate a single field value
 */
export function validateField(
  value: unknown,
  rules: ValidationRule,
  fieldName: string
): string | null {
  // Required check
  if (rules.required) {
    if (value === null || value === undefined || value === "") {
      return `${fieldName} is required`;
    }
  }

  // Skip other validations if value is empty and not required
  if (!value || (typeof value === "string" && value.trim() === "")) {
    return null;
  }

  const stringValue = String(value);

  // Min length check
  if (rules.minLength && stringValue.length < rules.minLength) {
    return `${fieldName} must be at least ${rules.minLength} characters`;
  }

  // Max length check
  if (rules.maxLength && stringValue.length > rules.maxLength) {
    return `${fieldName} must be no more than ${rules.maxLength} characters`;
  }

  // Pattern check
  if (rules.pattern && !rules.pattern.test(stringValue)) {
    return `${fieldName} format is invalid`;
  }

  // Custom validation
  if (rules.custom) {
    const customError = rules.custom(value);
    if (customError) {
      return customError;
    }
  }

  return null;
}

/**
 * Validate multiple fields
 */
export function validateForm(
  data: Record<string, unknown>,
  rules: Record<string, ValidationRule>
): ValidationResult {
  const errors: Record<string, string> = {};

  for (const [fieldName, fieldRules] of Object.entries(rules)) {
    const value = data[fieldName];
    const error = validateField(value, fieldRules, fieldName);
    if (error) {
      errors[fieldName] = error;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Common validation rules
 */
export const commonRules = {
  required: { required: true },
  email: {
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  slug: {
    required: true,
    pattern: /^[a-z0-9_-]+$/,
    minLength: 1,
    maxLength: 64,
  },
  name: {
    required: true,
    minLength: 1,
    maxLength: 255,
  },
  url: {
    pattern: /^https?:\/\/.+/,
  },
};

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  return commonRules.email.pattern!.test(email);
}

/**
 * Validate slug format
 */
export function isValidSlug(slug: string): boolean {
  return commonRules.slug.pattern!.test(slug);
}
