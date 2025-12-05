/**
 * Field helper functions for TicketForm
 */

import type { DynamicField, FieldRules, TicketFormState } from "./types";

export function matchesRuleValue(value: unknown, ruleValue?: string | string[]): boolean {
  if (ruleValue == null) return false;
  const values = Array.isArray(value) ? value : [value];
  const targets = Array.isArray(ruleValue) ? ruleValue : [ruleValue];
  return values.some((val) =>
    targets.some(
      (target) => String(val ?? "").toLowerCase() === String(target ?? "").toLowerCase()
    )
  );
}

export function getDependencyValue(
  key: string | undefined,
  form: TicketFormState
): string | undefined {
  if (!key) return undefined;
  if (key.startsWith("profile.")) {
    const profileKey = key.slice("profile.".length);
    return form.profile?.[profileKey];
  }
  return form.details?.[key] as string | undefined;
}

export function isMultiSelectField(field: DynamicField): boolean {
  const rules = (field.validation_rules || {}) as FieldRules;
  if (rules?.multiSelect) return true;
  const type = (field.field_type || "").toLowerCase();
  return type === "multi_select" || type === "multiselect" || type === "select_multiple";
}

export function shouldDisplayField(
  field: DynamicField,
  form: TicketFormState
): boolean {
  const rules = (field.validation_rules || {}) as FieldRules;
  if (!rules.dependsOn) return true;
  const controllingValue = getDependencyValue(rules.dependsOn, form);

  if (rules.showWhenValue !== undefined) {
    return matchesRuleValue(controllingValue, rules.showWhenValue);
  }
  if (rules.hideWhenValue !== undefined) {
    return !matchesRuleValue(controllingValue, rules.hideWhenValue);
  }
  return true;
}

export function isFieldRequired(
  field: DynamicField,
  form: TicketFormState
): boolean {
  const rules = (field.validation_rules || {}) as FieldRules;
  if (rules.dependsOn && rules.requiredWhenValue !== undefined) {
    const controllingValue = getDependencyValue(rules.dependsOn, form);
    return matchesRuleValue(controllingValue, rules.requiredWhenValue);
  }
  return field.required;
}

export function isFieldValueFilled(field: DynamicField, value: unknown): boolean {
  if (isMultiSelectField(field)) {
    const arr = Array.isArray(value) ? value : value != null ? [value] : [];
    return arr.filter((v) => typeof v === "string" && v.trim() !== "").length > 0;
  }

  switch ((field.field_type || "").toLowerCase()) {
    case "boolean": {
      return (
        value === true ||
        value === false ||
        value === "true" ||
        value === "false"
      );
    }
    case "upload": {
      const images = Array.isArray(value)
        ? value
        : value
        ? [value]
        : [];
      return images.length > 0;
    }
    default: {
      if (value === undefined || value === null) return false;
      if (typeof value === "string") return value.trim() !== "";
      return true;
    }
  }
}
