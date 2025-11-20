import { db } from "@/db";
import { categories, subcategories, sub_subcategories, category_fields, field_options } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function getCategoriesHierarchy() {
    // Fetch all data in parallel for performance
    const [
        activeCategories,
        activeSubcategories,
        allSubSubcategories,
        activeFields,
        activeOptions
    ] = await Promise.all([
        db
            .select()
            .from(categories)
            .where(eq(categories.active, true))
            .orderBy(asc(categories.display_order), asc(categories.name)),
        db
            .select()
            .from(subcategories)
            .where(eq(subcategories.active, true))
            .orderBy(asc(subcategories.display_order), asc(subcategories.name)),
        db
            .select({
                id: sub_subcategories.id,
                subcategory_id: sub_subcategories.subcategory_id,
                name: sub_subcategories.name,
                slug: sub_subcategories.slug,
                display_order: sub_subcategories.display_order,
            })
            .from(sub_subcategories)
            .orderBy(asc(sub_subcategories.display_order), asc(sub_subcategories.name)),
        db
            .select()
            .from(category_fields)
            .where(eq(category_fields.active, true))
            .orderBy(asc(category_fields.display_order)),
        db
            .select()
            .from(field_options)
            .where(eq(field_options.active, true))
            .orderBy(asc(field_options.display_order))
    ]);

    // Construct the hierarchy
    const categoriesWithSubcategories = activeCategories.map((category) => {
        const categorySubcategories = activeSubcategories.filter(
            (sub) => sub.category_id === category.id
        );

        return {
            value: category.slug || '',
            label: category.name || '',
            id: category.id,
            subcategories: categorySubcategories.map((sub) => {
                const subs = allSubSubcategories.filter(ss => ss.subcategory_id === sub.id);
                const fields = activeFields.filter(f => f.subcategory_id === sub.id);

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
                        options: activeOptions
                            .filter(o => o.field_id === f.id)
                            .map(o => ({ label: o.label || '', value: o.value || '' }))
                    }))
                };
            }),
        };
    });

    return categoriesWithSubcategories;
}
