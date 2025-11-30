import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

/**
 * GET /api/filters/locations
 * Fetch location options based on category and subcategory
 * For Hostel: fetches from hostel_enum
 * For College/Mess: fetches from category fields or subcategories
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const subcategory = searchParams.get("subcategory");

    let locations: string[] = [];

    if (category === "Hostel") {
      // Fetch hostel enum values from database
      try {
        const result = await db.execute(sql`
          SELECT unnest(enum_range(NULL::hostel_enum))::text AS hostel
          ORDER BY hostel;
        `);

        // Extract hostels from result (format may vary by Drizzle version)
        type ResultRow = { hostel: string };
        type ResultWithRows = { rows?: ResultRow[] };
        const hostels = Array.isArray(result) 
          ? (result as unknown as ResultRow[]).map((row: ResultRow) => row.hostel)
          : (result as ResultWithRows).rows?.map((row: ResultRow) => row.hostel) || [];
        
        locations = hostels;
      } catch (error) {
        console.error("Error fetching hostel enum:", error);
        // Fallback to empty array
        locations = [];
      }
    } else if (category === "College" && subcategory === "Mess Quality Issues") {
      // For College Mess Quality Issues, fetch vendors from field_options
      // Vendors are stored as options for a "vendor" field
      try {
        const { categories, subcategories: subcategoriesTable, category_fields, field_options } = await import("@/db");
        const { eq, and } = await import("drizzle-orm");
        const { asc } = await import("drizzle-orm");
        
        // Find College category
        const [collegeCategory] = await db
          .select({ id: categories.id })
          .from(categories)
          .where(eq(categories.name, "College"))
          .limit(1);

        if (collegeCategory) {
          // Find Mess Quality Issues subcategory
          const [messSubcategory] = await db
            .select({ id: subcategoriesTable.id })
            .from(subcategoriesTable)
            .where(
              and(
                eq(subcategoriesTable.category_id, collegeCategory.id),
                eq(subcategoriesTable.name, "Mess Quality Issues")
              )
            )
            .limit(1);

          if (messSubcategory) {
            // Find the "vendor" field for this subcategory
            const [vendorField] = await db
              .select({ id: category_fields.id })
              .from(category_fields)
              .where(
                and(
                  eq(category_fields.subcategory_id, messSubcategory.id),
                  eq(category_fields.slug, "vendor")
                )
              )
              .limit(1);

            if (vendorField) {
              // Get vendor options from field_options
              const vendorOptions = await db
                .select({ 
                  label: field_options.label,
                  value: field_options.value 
                })
                .from(field_options)
                .where(
                  and(
                    eq(field_options.field_id, vendorField.id),
                    eq(field_options.is_active, true)
                  )
                )
                .orderBy(asc(field_options.display_order), asc(field_options.label));

              locations = vendorOptions.map(v => v.label);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching college mess vendors:", error);
        locations = [];
      }
    }

    return NextResponse.json({ locations });
  } catch (error) {
    console.error("Error fetching locations:", error);
    return NextResponse.json(
      { error: "Failed to fetch locations" },
      { status: 500 }
    );
  }
}

