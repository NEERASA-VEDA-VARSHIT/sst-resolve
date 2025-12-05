/**
 * Form validation logic for TicketForm
 */

import type {
  TicketFormState,
  CategorySchema,
  Subcategory,
  DynamicField,
} from "./types";
  // ProfileFieldConfig import removed
import { validateRollNo, validateEmail, validatePhone } from "./validation";
import {
  shouldDisplayField,
  isFieldRequired,
  isFieldValueFilled,
  isMultiSelectField,
} from "./fieldHelpers";

// Re-export for convenience
export { shouldDisplayField, isFieldRequired, isFieldValueFilled, isMultiSelectField } from "./fieldHelpers";

export function validateTicketForm(
  form: TicketFormState,
  currentSchema: CategorySchema | null,
  currentSubcategory: Subcategory | null
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!form.categoryId) {
    errors["category"] = "Category is required";
  }

  if (currentSchema && currentSchema.subcategories && currentSchema.subcategories.length > 0) {
    if (!form.subcategoryId) {
      errors["subcategory"] = "Subcategory is required";
    }
  }

  // Check if dynamic fields handle description
  const fieldsToCheck = currentSubcategory?.fields || [];
  const hasDynamicDescription = fieldsToCheck.some(
    (f) =>
      f.slug === "description" ||
      f.field_type === "textarea" ||
      f.name.toLowerCase().includes("description")
  );

  // Description - only validate if not handled by dynamic fields
  if (!hasDynamicDescription) {
    if (!form.description || String(form.description).trim().length < 10) {
      errors["description"] = "Please provide a clear description (at least 10 characters)";
    }
  }

  // Profile fields
  const pf = currentSchema?.profileFields || [];
  for (const f of pf) {
    if (f.required) {
      const fieldKey = f.storage_key || f.field_name;
      const val = form.profile[fieldKey];
      if (val === undefined || val === null || (typeof val === "string" && val.trim() === "")) {
        errors[fieldKey] = `${f.field_name} is required`;
      } else {
        if (f.field_name === "rollNo" && !validateRollNo(String(val))) {
          errors[fieldKey] = "Roll number must be in format xxbcsxxxxx (e.g., 24bcs10005)";
        }
        if (f.field_name === "email" && !validateEmail(String(val))) {
          errors[fieldKey] = "Invalid email format";
        }
        if (f.field_name === "phone" && !validatePhone(String(val))) {
          errors[fieldKey] = "Invalid phone number";
        }
      }
    }
  }

  // Dynamic subcategory fields
  const subFields = currentSubcategory?.fields || [];
  for (const field of subFields) {
    if (!shouldDisplayField(field, form)) continue;
    const fv = form.details[field.slug];
    const fieldIsRequired = isFieldRequired(field, form);

    if (fieldIsRequired && !isFieldValueFilled(field, fv)) {
      errors[field.slug] = `${field.name} is required`;
      continue;
    }

    if (!isFieldValueFilled(field, fv)) {
      continue;
    }

    const multiSelect = isMultiSelectField(field);
    if (multiSelect) {
      continue;
    }

    if (field.field_type === "boolean" || field.field_type === "upload") {
      continue;
    }

    type ValidationRules = {
      minLength?: number | null;
      maxLength?: number | null;
      pattern?: string | null;
      errorMessage?: string | null;
      min?: number | null;
      max?: number | null;
      [key: string]: unknown;
    };
    type FieldWithValidation = DynamicField & { validation_rules?: ValidationRules | null };
    const rules = (field as FieldWithValidation).validation_rules;

    if (rules && typeof fv === "string") {
      const minLength = typeof rules.minLength === "number" ? rules.minLength : null;
      const maxLength = typeof rules.maxLength === "number" ? rules.maxLength : null;
      const pattern = typeof rules.pattern === "string" ? rules.pattern : null;
      const errorMessage = typeof rules.errorMessage === "string" ? rules.errorMessage : null;

      if (minLength !== null && fv.length < minLength) {
        errors[field.slug] = `${field.name} must be at least ${minLength} characters`;
      }
      if (maxLength !== null && fv.length > maxLength) {
        errors[field.slug] = `${field.name} must be at most ${maxLength} characters`;
      }
      if (pattern !== null) {
        const re = new RegExp(pattern);
        if (!re.test(fv)) {
          errors[field.slug] = errorMessage || `${field.name} format is invalid`;
        }
      }
    }

    if (rules && (rules.min !== undefined || rules.max !== undefined)) {
      const num = Number(fv);
      const min = typeof rules.min === "number" ? rules.min : null;
      const max = typeof rules.max === "number" ? rules.max : null;
      if (min !== null && num < min) {
        errors[field.slug] = `${field.name} must be at least ${min}`;
      }
      if (max !== null && num > max) {
        errors[field.slug] = `${field.name} must be at most ${max}`;
      }
    }
  }

  return errors;
}

export function calculateFormProgress(
  form: TicketFormState,
  currentSchema: CategorySchema | null,
  currentSubcategory: Subcategory | null
): number {
  let total = 0,
    complete = 0;

  total++;
  if (form.categoryId) complete++;

  const subFields = currentSubcategory?.fields || [];
  const hasDynamicDescription = subFields.some(
    (f) =>
      f.slug === "description" ||
      f.field_type === "textarea" ||
      f.name.toLowerCase().includes("description")
  );

  if (!hasDynamicDescription) {
    total++;
    if (form.description && String(form.description).trim().length >= 10) complete++;
  }

  if (currentSchema && currentSchema.subcategories && currentSchema.subcategories.length > 0) {
    total++;
    if (form.subcategoryId) complete++;
  }

  const pf = currentSchema?.profileFields || [];
  for (const f of pf) {
    total++;
    const v = form.profile[f.storage_key];
    if (v !== undefined && v !== null && (typeof v !== "string" || v.trim() !== "")) complete++;
  }

  const sf = currentSubcategory?.fields || [];
  for (const f of sf) {
    if (!shouldDisplayField(f, form)) continue;
    if (!isFieldRequired(f, form)) continue;
    total++;
    const v = form.details[f.slug];
    if (isFieldValueFilled(f, v)) complete++;
  }

  return total === 0 ? 0 : Math.round((complete / total) * 100);
}
