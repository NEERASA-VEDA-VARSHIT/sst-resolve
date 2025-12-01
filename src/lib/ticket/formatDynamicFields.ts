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
  value: unknown;
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
  'tat',
  'tatSetAt',
  'tatSetBy',
  'tatExtensions',
  'tatPauseStart',
  'tatPausedDuration',
  'lastReminderDate',
  'comments',
  'images',
  'profile',
  'used_field_ids',
  'dynamic_fields',
  'browser',
  'device',
  'userAgent',
  'extra',
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
    .replace(/([A-Z])/g, ' $1') // camelCase to spaces (e.g., "issueType" -> "issue Type")
    .replace(/[_-]/g, ' ') // snake_case/kebab-case to spaces
    .replace(/\b\w/g, str => str.toUpperCase()) // capitalize first letter of each word
    .trim();
}

/**
 * Find field definition by matching slug or name
 */
function findFieldDefinition(
  key: string,
  fieldDefs: FieldDefinition[]
): FieldDefinition | undefined {
  // Normalize key for comparison (lowercase, replace spaces/hyphens/underscores)
  const normalizedKey = key.toLowerCase().replace(/[\s_-]/g, '-');
  
  return fieldDefs.find(f => {
    if (!f) return false;
    
    // Exact matches
    if (f.slug === key || f.name === key) return true;
    
    // Normalized slug match
    const normalizedSlug = (f.slug || '').toLowerCase().replace(/[\s_-]/g, '-');
    if (normalizedSlug === normalizedKey) return true;
    
    // Normalized name match
    const normalizedName = (f.name || '').toLowerCase().replace(/[\s_-]/g, '-');
    if (normalizedName === normalizedKey) return true;
    
    // Partial match (for camelCase like "issueType" matching "Issue Type")
    const keyWords = normalizedKey.split('-');
    const slugWords = normalizedSlug.split('-');
    const nameWords = normalizedName.split('-');
    
    // Check if all key words are in slug or name
    const matchesSlug = keyWords.length > 0 && keyWords.every(word => slugWords.includes(word));
    const matchesName = keyWords.length > 0 && keyWords.every(word => nameWords.includes(word));
    
    return matchesSlug || matchesName;
  });
}

/**
 * Resolve the display value for a select field
 */
function resolveSelectValue(
  rawValue: unknown,
  fieldDef: FieldDefinition,
  categorySchema: Record<string, unknown>
): unknown {
  if (!fieldDef || !rawValue) {
    return rawValue;
  }
  
  try {
    if (!fieldDef.options || fieldDef.options.length === 0) {
      // Try to find options from full schema
      if (categorySchema?.subcategories && Array.isArray(categorySchema.subcategories)) {
        type Subcategory = {
          fields?: Array<{ slug?: string; name?: string; options?: Array<{ value?: string; label?: string }> }>;
        };
        type Field = {
          slug?: string;
          name?: string;
          options?: Array<{ value?: string; label?: string }>;
        };
        const fieldWithOptions = categorySchema.subcategories
          .flatMap((sc: Subcategory) => Array.isArray(sc?.fields) ? sc.fields : [])
          .find((f: Field) => f && (f.slug === fieldDef.slug || f.name === fieldDef.name));
        
        if (fieldWithOptions?.options && Array.isArray(fieldWithOptions.options)) {
          type Option = { value?: string; label?: string };
          const rawValueStr = String(rawValue).toLowerCase().trim();
          
          // Try exact match first
          let option = fieldWithOptions.options.find(
            (opt: Option) => 
              opt && (opt.value?.toLowerCase() === rawValueStr || opt.label?.toLowerCase() === rawValueStr)
          );
          
          // If no exact match, try partial match (for incomplete values like "nu")
          if (!option) {
            option = fieldWithOptions.options.find(
              (opt: Option) => 
                opt && (
                  opt.value?.toLowerCase().startsWith(rawValueStr) ||
                  opt.label?.toLowerCase().startsWith(rawValueStr) ||
                  rawValueStr.startsWith(opt.value?.toLowerCase() || '') ||
                  rawValueStr.startsWith(opt.label?.toLowerCase() || '')
                )
            );
          }
          
          if (option?.label) return option.label;
        }
      }
    } else {
      // Use options from field definition
      const rawValueStr = String(rawValue).toLowerCase().trim();
      
      // Try exact match first
      let option = fieldDef.options.find(
        opt => opt && (opt.value?.toLowerCase() === rawValueStr || opt.label?.toLowerCase() === rawValueStr)
      );
      
      // If no exact match, try partial match (for incomplete values)
      if (!option) {
        option = fieldDef.options.find(
          opt => opt && (
            opt.value?.toLowerCase().startsWith(rawValueStr) ||
            opt.label?.toLowerCase().startsWith(rawValueStr) ||
            rawValueStr.startsWith(opt.value?.toLowerCase() || '') ||
            rawValueStr.startsWith(opt.label?.toLowerCase() || '')
          )
        );
      }
      
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
type CategorySchema = {
  subcategories?: Array<{
    fields?: Array<{
      slug?: string;
      name?: string;
      field_type?: string;
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};

function extractFieldDefinitions(categorySchema: CategorySchema): FieldDefinition[] {
  const fieldDefs: FieldDefinition[] = [];
  
  if (!categorySchema || !categorySchema.subcategories) {
    return fieldDefs;
  }
  
  try {
    categorySchema.subcategories.forEach((subcat) => {
      if (!subcat || !subcat.fields || !Array.isArray(subcat.fields)) {
        return;
      }
      
      subcat.fields.forEach((field) => {
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
  metadata: Record<string, unknown>,
  categorySchema: Record<string, unknown>
): DynamicField[] {
  // Guard against null/undefined metadata
  if (!metadata || typeof metadata !== 'object') {
    return [];
  }
  
  // Guard against null/undefined categorySchema
  if (!categorySchema || typeof categorySchema !== 'object' || Array.isArray(categorySchema)) {
    return [];
  }
  
  const dynamicFields: DynamicField[] = [];
  const processedKeys = new Set<string>();
  
  try {
    const fieldDefs = extractFieldDefinitions(categorySchema);
    
    // First, check metadata.dynamic_fields (new format with field_id)
    if (metadata.dynamic_fields && typeof metadata.dynamic_fields === 'object' && !Array.isArray(metadata.dynamic_fields)) {
      const dynamicFieldsObj = metadata.dynamic_fields as Record<string, { field_id?: number; value?: unknown }>;
      
      Object.keys(dynamicFieldsObj).forEach(key => {
        const fieldData = dynamicFieldsObj[key];
        if (!fieldData || typeof fieldData !== 'object') return;
        
        const value = fieldData.value;
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
        let displayValue: unknown = value;
        if (fieldType === 'select' && fieldDef) {
          displayValue = resolveSelectValue(value, fieldDef, categorySchema);
        }
        
        dynamicFields.push({
          key,
          value: displayValue,
          label,
          fieldType,
        });
        
        processedKeys.add(key);
      });
    }
    
    // Then, check top-level metadata keys (backward compatibility)
    const metadataKeys = Object.keys(metadata);
    
    metadataKeys.forEach(key => {
      // Skip if already processed from dynamic_fields
      if (processedKeys.has(key)) return;
      
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
      let displayValue: unknown = value;
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
