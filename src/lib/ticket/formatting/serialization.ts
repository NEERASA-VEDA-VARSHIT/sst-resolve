/**
 * Serialization utilities for tickets and related data
 * Ensures all data is safe for JSON serialization (Next.js server components)
 */

/**
 * Convert Date objects to ISO strings for serialization
 */
export function convertDates(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  if (date instanceof Date) {
    return date.toISOString();
  }
  if (typeof date === 'string') {
    return date;
  }
  return null;
}

/**
 * Recursively sanitize objects for serialization
 * Removes undefined values and ensures all nested objects are serializable
 */
export function sanitizeForSerialization(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return null;
  }
  if (typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForSerialization).filter((item) => item !== undefined);
  }
  const sanitized: Record<string, unknown> = {};
  const objRecord = obj as Record<string, unknown>;
  for (const key in objRecord) {
    if (Object.prototype.hasOwnProperty.call(objRecord, key)) {
      const value = objRecord[key];
      if (value !== undefined) {
        sanitized[key] = sanitizeForSerialization(value);
      }
    }
  }
  return sanitized;
}

/**
 * Sanitize a single ticket for serialization
 */
export function sanitizeTicket(ticket: {
  id?: number | null;
  title?: string | null;
  description?: string | null;
  location?: string | null;
  status_id?: number | null;
  status?: string | null;
  category_id?: number | null;
  subcategory_id?: number | null;
  scope_id?: number | null;
  created_by?: string | null;
  assigned_to?: string | null;
  escalation_level?: number | null;
  acknowledgement_due_at?: Date | string | null;
  resolution_due_at?: Date | string | null;
  metadata?: unknown;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
  category_name?: string | null;
  creator_full_name?: string | null;
  creator_email?: string | null;
}) {
  // Ensure ticket is a valid object
  if (!ticket || typeof ticket !== 'object') {
    return null;
  }
  
  // Ensure metadata is a valid object (not null/undefined)
  let safeMetadata: Record<string, unknown> = {};
  try {
    if (ticket.metadata !== null && ticket.metadata !== undefined) {
      if (typeof ticket.metadata === 'object') {
        // Deep clone and ensure all values are serializable
        safeMetadata = JSON.parse(JSON.stringify(ticket.metadata));
      }
    }
  } catch {
    // If metadata can't be serialized, use empty object
    safeMetadata = {};
  }
  
  return {
    id: ticket.id ?? null,
    title: ticket.title ?? null,
    description: ticket.description ?? null,
    location: ticket.location ?? null,
    status_id: ticket.status_id ?? null,
    status: ticket.status ?? null,
    category_id: ticket.category_id ?? null,
    subcategory_id: ticket.subcategory_id ?? null,
    scope_id: ticket.scope_id ?? null,
    created_by: ticket.created_by ?? null,
    assigned_to: ticket.assigned_to ?? null,
    escalation_level: Number(ticket.escalation_level) || 0,
    acknowledgement_due_at: convertDates(ticket.acknowledgement_due_at),
    resolution_due_at: convertDates(ticket.resolution_due_at),
    metadata: safeMetadata,
    created_at: convertDates(ticket.created_at),
    updated_at: convertDates(ticket.updated_at),
    category_name: ticket.category_name ?? null,
    creator_name: ticket.creator_full_name ?? null,
    creator_email: ticket.creator_email ?? null,
  };
}

/**
 * Sanitize category hierarchy for serialization
 */
export function sanitizeCategoryHierarchy(
  categoryList: unknown[]
): Array<{
  value: string;
  label: string;
  id: number;
  subcategories: Array<{
    value: string;
    label: string;
    id: number;
    fields: Array<{
      id: number;
      name: string;
      slug: string;
      type: string;
      options: Array<{ label: string; value: string }>;
    }>;
  }>;
}> {
  if (!Array.isArray(categoryList)) {
    return [];
  }

  return categoryList
    .map((cat) => {
      if (!cat || typeof cat !== 'object') return null;
      const sanitized = sanitizeForSerialization({
        value: (cat as { value?: string }).value ?? '',
        label: (cat as { label?: string }).label ?? '',
        id: (cat as { id?: number }).id ?? 0,
        subcategories: Array.isArray((cat as { subcategories?: unknown[] }).subcategories)
          ? ((cat as { subcategories?: unknown[] }).subcategories || []).map((sub) => ({
              value: (sub as { value?: string }).value ?? '',
              label: (sub as { label?: string }).label ?? '',
              id: (sub as { id?: number }).id ?? 0,
              fields: Array.isArray((sub as { fields?: unknown[] }).fields)
                ? ((sub as { fields?: unknown[] }).fields || []).map((f) => ({
                    id: (f as { id?: number }).id ?? 0,
                    name: (f as { name?: string }).name ?? '',
                    slug: (f as { slug?: string }).slug ?? '',
                    type: (f as { type?: string }).type ?? 'text',
                    options: Array.isArray((f as { options?: unknown[] }).options)
                      ? ((f as { options?: unknown[] }).options || []).map((o) => ({
                          label: (o as { label?: string }).label ?? '',
                          value: (o as { value?: string }).value ?? '',
                        }))
                      : [],
                  }))
                : [],
            }))
          : [],
      });
      return sanitized;
    })
    .filter((cat): cat is NonNullable<typeof cat> => cat !== null) as Array<{
      value: string;
      label: string;
      id: number;
      subcategories: Array<{
        value: string;
        label: string;
        id: number;
        fields: Array<{
          id: number;
          name: string;
          slug: string;
          type: string;
          options: Array<{ label: string; value: string }>;
        }>;
      }>;
    }>;
}
