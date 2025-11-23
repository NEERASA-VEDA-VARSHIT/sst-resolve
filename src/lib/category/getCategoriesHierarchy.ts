import { db } from "@/db";
import { categories, subcategories, sub_subcategories, category_fields, field_options } from "@/db/schema";
import { eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";

export const getCategoriesHierarchy = unstable_cache(
  async () => {
    // Fetch all data in parallel for performance (without orderBy)
    const [
        activeCategories,
        activeSubcategories,
        allSubSubcategories,
        activeFields,
        activeOptions
    ] = await Promise.all([
        db
            .select({
                id: categories.id,
                name: categories.name,
                slug: categories.slug,
                display_order: categories.display_order,
            })
            .from(categories)
            .where(eq(categories.active, true)),
        db
            .select({
                id: subcategories.id,
                category_id: subcategories.category_id,
                name: subcategories.name,
                slug: subcategories.slug,
                display_order: subcategories.display_order,
            })
            .from(subcategories)
            .where(eq(subcategories.active, true)),
        db
            .select({
                id: sub_subcategories.id,
                subcategory_id: sub_subcategories.subcategory_id,
                name: sub_subcategories.name,
                slug: sub_subcategories.slug,
                display_order: sub_subcategories.display_order,
            })
            .from(sub_subcategories),
        db
            .select({
                id: category_fields.id,
                subcategory_id: category_fields.subcategory_id,
                name: category_fields.name,
                slug: category_fields.slug,
                field_type: category_fields.field_type,
                display_order: category_fields.display_order,
            })
            .from(category_fields)
            .where(eq(category_fields.active, true)),
        db
            .select({
                field_id: field_options.field_id,
                label: field_options.label,
                value: field_options.value,
                display_order: field_options.display_order,
            })
            .from(field_options)
            .where(eq(field_options.active, true))
    ]);

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

    const sortedSubSubcategories = allSubSubcategories.sort((a, b) => {
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
                const subs = sortedSubSubcategories.filter(ss => ss.subcategory_id === sub.id);
                const fields = sortedFields.filter(f => f.subcategory_id === sub.id);

                return {
                    value: sub.slug || '',
                    label: sub.name || '',
                    id: sub.id,
                    sub_subcategories: subs.map(ss => ({
                        value: ss.slug || '',
                        label: ss.name || '',
                        id: ss.id
                    })),
                    fields: fields.map(f => ({
                        id: f.id,
                        name: f.name || '',
                        slug: f.slug || '',
                        type: f.field_type || 'text',
                        options: sortedOptions
                            .filter(o => o.field_id === f.id)
                            .map(o => ({ label: o.label || '', value: o.value || '' }))
                    }))
                };
            }),
        };
    });

    return categoriesWithSubcategories;
  },
  ["categories-hierarchy"],
  {
    revalidate: 300, // Cache for 5 minutes
    tags: ["categories"],
  }
);
