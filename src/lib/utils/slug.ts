/**
 * Slug generation utilities
 * Centralized slug generation to replace duplicate implementations across dialogs
 */

export type SlugSeparator = "-" | "_";

/**
 * Generate a URL-friendly slug from a string
 * @param name - The string to convert to a slug
 * @param separator - The separator to use (default: "-")
 * @returns A URL-friendly slug
 */
export function generateSlug(name: string, separator: SlugSeparator = "-"): string {
  if (!name) return "";
  
  const pattern = separator === "_" ? /[^a-z0-9]+/g : /[^a-z0-9]+/g;
  const trimPattern = separator === "_" ? /(^_|_$)/g : /(^-|-$)/g;
  
  return name
    .toLowerCase()
    .replace(pattern, separator)
    .replace(trimPattern, "");
}

/**
 * Validate if a string is a valid slug
 * @param slug - The slug to validate
 * @returns True if valid, false otherwise
 */
export function validateSlug(slug: string): boolean {
  if (!slug) return false;
  // Slug should only contain lowercase letters, numbers, hyphens, and underscores
  return /^[a-z0-9_-]+$/.test(slug);
}

/**
 * Slugify a string (alias for generateSlug with default separator)
 * @param name - The string to slugify
 * @returns A URL-friendly slug
 */
export function slugify(name: string): string {
  return generateSlug(name, "-");
}
