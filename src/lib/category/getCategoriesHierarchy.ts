import { db } from "@/db";
import { categories, subcategories, category_fields, field_options } from "@/db/schema";
import { eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";

export const getCategoriesHierarchy = unstable_cache(
  async () => {
    try {
      // Fetch all data in parallel for performance (without orderBy)
      // Use Promise.allSettled to handle individual query failures gracefully
      const [
          categoriesResult,
          subcategoriesResult,
          fieldsResult,
          optionsResult
      ] = await Promise.allSettled([
          db
              .select({
                  id: categories.id,
                  name: categories.name,
                  slug: categories.slug,
                  display_order: categories.display_order,
              })
              .from(categories)
              .where(eq(categories.is_active, true)),
          db
              .select({
                  id: subcategories.id,
                  category_id: subcategories.category_id,
                  name: subcategories.name,
                  slug: subcategories.slug,
                  display_order: subcategories.display_order,
              })
              .from(subcategories)
              .where(eq(subcategories.is_active, true)),
          db
              .select({
                  id: category_fields.id,
                  subcategory_id: category_fields.subcategory_id,
                  name: category_fields.name,
                  slug: category_fields.slug,
                  field_type: category_fields.field_type,
                  required: category_fields.required,
                  placeholder: category_fields.placeholder,
                  help_text: category_fields.help_text,
                  validation_rules: category_fields.validation_rules,
                  display_order: category_fields.display_order,
              })
              .from(category_fields)
              .where(eq(category_fields.is_active, true)),
          db
              .select({
                  field_id: field_options.field_id,
                  label: field_options.label,
                  value: field_options.value,
                  display_order: field_options.display_order,
              })
              .from(field_options)
              .where(eq(field_options.is_active, true))
      ]);

      // Extract results, handling failures gracefully
      const activeCategories = categoriesResult.status === 'fulfilled' ? categoriesResult.value : [];
      const activeSubcategories = subcategoriesResult.status === 'fulfilled' ? subcategoriesResult.value : [];
      const activeFields = fieldsResult.status === 'fulfilled' ? fieldsResult.value : [];
      const activeOptions = optionsResult.status === 'fulfilled' ? optionsResult.value : [];

      // Log warnings for failed queries (but don't fail the entire operation)
      if (categoriesResult.status === 'rejected') {
        console.warn('[getCategoriesHierarchy] Failed to fetch categories:', categoriesResult.reason);
      }
      if (subcategoriesResult.status === 'rejected') {
        console.warn('[getCategoriesHierarchy] Failed to fetch subcategories:', subcategoriesResult.reason);
      }
      if (fieldsResult.status === 'rejected') {
        console.warn('[getCategoriesHierarchy] Failed to fetch category fields:', fieldsResult.reason);
      }
      if (optionsResult.status === 'rejected') {
        console.warn('[getCategoriesHierarchy] Failed to fetch field options (continuing without options):', optionsResult.reason?.message || optionsResult.reason);
      }

    // Sort manually to avoid orderBy issues
    const sortedCategories = activeCategories.sort((a, b) => {
        if ((a.display_order || 0) !== (b.display_order || 0)) {
            return (a.display_order || 0) - (b.display_order || 0);
        }
        return (a.name || '').localeCompare(b.name || '');
    });

    const sortedSubcategories = activeSubcategories.sort((a, b) => {
        if ((a.display_order || 0) !== (b.display_order || 0)) {
            return (a.display_order || 0) - (b.display_order || 0);
        }
        return (a.name || '').localeCompare(b.name || '');
    });

    const sortedFields = activeFields.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    const sortedOptions = activeOptions.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

    // Construct the hierarchy
    const categoriesWithSubcategories = sortedCategories.map((category) => {
        const categorySubcategories = sortedSubcategories.filter(
            (sub) => sub.category_id === category.id
        );

        return {
            value: category.slug || '',
            label: category.name || '',
            id: category.id,
            subcategories: categorySubcategories.map((sub) => {
                const fields = sortedFields.filter(f => f.subcategory_id === sub.id);

                return {
                    value: sub.slug || '',
                    label: sub.name || '',
                    id: sub.id,
                    fields: fields.map(f => ({
                        id: f.id,
                        name: f.name || '',
                        slug: f.slug || '',
                        type: f.field_type || 'text',
                        required: f.required ?? false,
                        placeholder: f.placeholder || null,
                        help_text: f.help_text || null,
                        validation_rules: f.validation_rules || null,
                        display_order: f.display_order || 0,
                        options: sortedOptions
                            .filter(o => o.field_id === f.id)
                            .map(o => ({ label: o.label || '', value: o.value || '' }))
                    }))
                };
            }),
        };
    });

      return categoriesWithSubcategories;
    } catch (error) {
      console.error('[getCategoriesHierarchy] Unexpected error:', error);
      // Return empty array on complete failure to prevent breaking the app
      return [];
    }
  },
  ["categories-hierarchy"],
  {
    revalidate: 1800, // Cache for 30 minutes (categories don't change frequently)
    tags: ["categories"],
  }
);
