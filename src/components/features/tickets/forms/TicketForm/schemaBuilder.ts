/**
 * Schema building utilities for TicketForm
 * Builds hierarchical category -> subcategory -> fields structure
 */

import type { Category, Subcategory, DynamicField, ProfileFieldConfig, CategorySchema } from "./types";

type FieldOption = {
  id: number;
  field_id?: number;
  label?: string;
  option_label?: string;
  value?: string;
  option_value?: string;
};

export function buildCategorySchemas(
  categories: Category[],
  subcategories: Subcategory[],
  dynamicFields: DynamicField[],
  profileFields: ProfileFieldConfig[],
  fieldOptions: FieldOption[]
): CategorySchema[] {
  // Group subcategories by category_id
  const subsByCat = new Map<number, Subcategory[]>();
  for (const s of subcategories || []) {
    type SubcategoryWithId = {
      category_id?: number;
      categoryId?: number;
      [key: string]: unknown;
    };
    const catId = (s as SubcategoryWithId).category_id ?? (s as SubcategoryWithId).categoryId ?? null;
    if (catId == null) continue;
    const arr = subsByCat.get(catId) || [];
    arr.push(s);
    subsByCat.set(catId, arr);
  }

  // Map fields by subcategory_id
  const fieldsBySub = new Map<number, DynamicField[]>();
  for (const f of dynamicFields || []) {
    type FieldWithId = {
      subcategory_id?: number;
      subCategoryId?: number;
      category_field_subcategory_id?: number;
      [key: string]: unknown;
    };
    const subId = (f as FieldWithId).subcategory_id ?? (f as FieldWithId).subCategoryId ?? (f as FieldWithId).category_field_subcategory_id ?? null;
    if (subId == null) continue;
    const arr = fieldsBySub.get(subId) || [];
    arr.push(f);
    fieldsBySub.set(subId, arr);
  }

  // Map options by field_id
  const optionsByField = new Map<number, Array<{ id: number; label: string; value: string }>>();
  for (const opt of (fieldOptions || []) as FieldOption[]) {
    const fieldId = opt.field_id;
    if (fieldId == null) continue;
    
    const optValue = opt.value || opt.option_value || '';
    if (!optValue || optValue.trim() === '') continue;
    
    const arr = optionsByField.get(fieldId) || [];
    
    const isDuplicate = arr.some(existing => {
      if (opt.id && existing.id && opt.id === existing.id) return true;
      const existingKey = existing.id ? `id:${existing.id}` : `val:${existing.value}|label:${existing.label}`;
      const newKey = opt.id ? `id:${opt.id}` : `val:${optValue}|label:${opt.label || opt.option_label || optValue}`;
      return existingKey === newKey;
    });
    
    if (!isDuplicate) {
      arr.push({
        id: opt.id,
        label: opt.label || opt.option_label || optValue,
        value: optValue,
      });
      optionsByField.set(fieldId, arr);
    }
  }

  // Build final schema structure
  return (categories || []).map((c) => {
    const categoryId = typeof c === 'object' && c !== null && 'id' in c ? (c as { id: number }).id : null;
    const rawSubs = categoryId ? subsByCat.get(categoryId) || [] : [];
    const subs = rawSubs.map((s) => {
      const subcategoryId = typeof s === 'object' && s !== null && 'id' in s ? (s as { id: number }).id : null;
      const rawFields = subcategoryId ? fieldsBySub.get(subcategoryId) || [] : [];
      const fields = rawFields.map((f) => {
        const fieldOptions = (f as DynamicField).options && Array.isArray((f as DynamicField).options) && (f as DynamicField).options!.length > 0
          ? (f as DynamicField).options!
          : (optionsByField.get(f.id) || []);
        
        return {
          ...f,
          placeholder: f.placeholder ?? null,
          help_text: f.help_text ?? null,
          options: fieldOptions,
        };
      });
      return {
        ...s,
        fields: fields.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
      } as Subcategory;
    }).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

    type ProfileField = {
      category_id?: number;
      [key: string]: unknown;
    };
    type Category = {
      id?: number;
      [key: string]: unknown;
    };
    const catProfileFields = (profileFields || []).filter((pf: ProfileField) => {
      if (pf.category_id) return pf.category_id === (c as Category).id;
      return true;
    }).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

    return { category: c, subcategories: subs, profileFields: catProfileFields };
  });
}
