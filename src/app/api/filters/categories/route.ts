import { NextResponse } from "next/server";
import { getCategoriesHierarchy } from "@/lib/category/getCategoriesHierarchy";

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
  } catch (error: unknown) {
    console.error("Error fetching categories:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json(
      { error: "Failed to fetch categories", details: errorMessage, stack: errorStack },
      { status: 500 }
    );
  }
}
