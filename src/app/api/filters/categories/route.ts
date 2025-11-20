import { NextResponse } from "next/server";
import { getCategoriesHierarchy } from "@/lib/filters/getCategoriesHierarchy";

export const dynamic = "force-dynamic";

/**
 * GET /api/filters/categories
 * Fetch all active categories, subcategories, sub-subcategories, and dynamic fields for filters
 */
export async function GET() {
  try {
    const categories = await getCategoriesHierarchy();

    return NextResponse.json({
      categories,
    });
  } catch (error: any) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories", details: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}
