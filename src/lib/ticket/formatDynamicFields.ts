/**
 * Extract and format dynamic fields from ticket metadata
 * Handles field matching, label formatting, and value display transformation
 */

type FieldDefinition = {
  slug: string;
  name: string;
  field_type: string;
  options?: Array<{ value: string; label: string }>;
};

type DynamicField = {
  key: string;
  value: any;
  label: string;
  fieldType: string;
};

/**
 * System fields that should never be displayed as dynamic fields
 */
const SYSTEM_FIELDS = [
  'subcategory',
  'subSubcategory',
  'subcategoryId',
  'subSubcategoryId',
  'slackMessageTs',
  'slackChannel',
  'originalEmailMessageId',
  'originalEmailSubject',
  'tatDate',
  'comments',
  'images',
  'profile',
  'used_field_ids',
  'dynamic_fields',
];

/**
 * Profile/contact field patterns that should be excluded
 * (displayed separately in Student Information section)
 */
const PROFILE_FIELD_PATTERNS = [
  'roomnumber',
  'roomno',
  'contactname',
  'fullname',
  'contactemail',
  'contactphone',
  'phonenumber',
  'mobile',
  'contactrollno',
  'rollnumber',
  'hostel',
  'batchyear',
  'classsection',
];

/**
 * Normalize a field name for comparison (remove separators, lowercase)
 */
function normalizeFieldName(name: string): string {
  return name.toLowerCase().replace(/[_-\s]/g, '');
}

/**
 * Check if a key represents a profile field
 */
function isProfileField(key: string): boolean {
  const normalized = normalizeFieldName(key);
  return PROFILE_FIELD_PATTERNS.some(pattern => 
    normalized === pattern || 
    normalized.includes(pattern) || 
    pattern.includes(normalized)
  );
}

/**
 * Format a raw key into a human-readable label
 */
function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1') // camelCase to spaces
    .replace(/[_-]/g, ' ') // snake_case/kebab-case to spaces
    .replace(/^./, str => str.toUpperCase()) // capitalize first letter
    .trim();
}

/**
 * Find field definition by matching slug or name
 */
function findFieldDefinition(
  key: string,
  fieldDefs: FieldDefinition[]
): FieldDefinition | undefined {
  const normalizedKey = key.toLowerCase().replace(/\s+/g, '-');
  
  return fieldDefs.find(
    f => f.slug === key || 
         f.name === key || 
         f.slug === normalizedKey
  );
}

/**
 * Resolve the display value for a select field
 */
function resolveSelectValue(
  rawValue: any,
  fieldDef: FieldDefinition,
  categorySchema: any
): any {
  if (!fieldDef || !rawValue) {
    return rawValue;
  }
  
  try {
    if (!fieldDef.options || fieldDef.options.length === 0) {
      // Try to find options from full schema
      if (categorySchema?.subcategories && Array.isArray(categorySchema.subcategories)) {
        const fieldWithOptions = categorySchema.subcategories
          .flatMap((sc: any) => Array.isArray(sc?.fields) ? sc.fields : [])
          .find((f: any) => f && (f.slug === fieldDef.slug || f.name === fieldDef.name));
        
        if (fieldWithOptions?.options && Array.isArray(fieldWithOptions.options)) {
          const option = fieldWithOptions.options.find(
            (opt: any) => 
              opt && (opt.value === String(rawValue) || opt.label === String(rawValue))
          );
          
          if (option?.label) return option.label;
        }
      }
    } else {
      // Use options from field definition
      const option = fieldDef.options.find(
        opt => opt && (opt.value === String(rawValue) || opt.label === String(rawValue))
      );
      
      if (option?.label) return option.label;
    }
  } catch (error) {
    console.warn('[resolveSelectValue] Error resolving select value:', error);
  }
  
  return rawValue;
}

/**
 * Extract all field definitions from category schema
 */
function extractFieldDefinitions(categorySchema: any): FieldDefinition[] {
  const fieldDefs: FieldDefinition[] = [];
  
  if (!categorySchema || !categorySchema.subcategories) {
    return fieldDefs;
  }
  
  try {
    categorySchema.subcategories.forEach((subcat: any) => {
      if (!subcat || !subcat.fields || !Array.isArray(subcat.fields)) {
        return;
      }
      
      subcat.fields.forEach((field: any) => {
        if (!field || typeof field !== 'object') {
          return;
        }
        
        fieldDefs.push({
          slug: field.slug || '',
          name: field.name || '',
          field_type: field.field_type || 'text',
          options: Array.isArray(field.options) ? field.options : [],
        });
      });
    });
  } catch (error) {
    console.warn('[extractFieldDefinitions] Error processing schema:', error);
  }
  
  return fieldDefs;
}

/**
 * Main function: Extract and format dynamic fields from metadata
 */
export function extractDynamicFields(
  metadata: any,
  categorySchema: any
): DynamicField[] {
  // Guard against null/undefined metadata
  if (!metadata || typeof metadata !== 'object') {
    return [];
  }
  
  const dynamicFields: DynamicField[] = [];
  
  try {
    const fieldDefs = extractFieldDefinitions(categorySchema);
    
    // Use Object.keys with additional safety
    const metadataKeys = Object.keys(metadata);
    
    metadataKeys.forEach(key => {
      // Skip system fields
      if (SYSTEM_FIELDS.includes(key)) return;
      
      // Skip profile fields
      if (isProfileField(key)) return;
      
      // Skip empty values
      const value = metadata[key];
      if (value === null || value === undefined || value === '') return;
      
      // Skip nested objects (except arrays)
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return;
      }
      
      // Find field definition
      const fieldDef = findFieldDefinition(key, fieldDefs);
      
      // Determine label
      const label = fieldDef?.name || formatLabel(key);
      
      // Determine field type
      const fieldType = fieldDef?.field_type || 'text';
      
      // Resolve display value (especially for select fields)
      let displayValue = value;
      if (fieldType === 'select' && fieldDef) {
        displayValue = resolveSelectValue(value, fieldDef, categorySchema);
      }
      
      dynamicFields.push({
        key,
        value: displayValue,
        label,
        fieldType,
      });
    });
  } catch (error) {
    console.error('[extractDynamicFields] Error extracting fields:', error);
  }
  
  return dynamicFields;
}
