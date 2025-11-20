/**
 * Category Schema Cache Invalidation Utility
 * 
 * Call these functions after admin updates to category/subcategory/field configurations
 * to ensure the cached schema is refreshed
 */

/**
 * Invalidate category schema cache after admin updates
 * @param categoryId - The category ID to invalidate
 * @returns Promise<boolean> - true if successful
 */
export async function invalidateCategorySchemaCache(categoryId: number): Promise<boolean> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/categories/${categoryId}/schema`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    return response.ok;
  } catch (error) {
    console.error('Failed to invalidate category schema cache:', error);
    return false;
  }
}

/**
 * Invalidate cache for multiple categories at once
 * @param categoryIds - Array of category IDs to invalidate
 */
export async function invalidateMultipleCategoryCaches(categoryIds: number[]): Promise<void> {
  await Promise.all(categoryIds.map(id => invalidateCategorySchemaCache(id)));
}
