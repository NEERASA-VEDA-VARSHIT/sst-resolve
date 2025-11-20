import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { eq, asc, desc } from "drizzle-orm";

// GET: Fetch all active categories (for ticket creation dropdown)
export async function GET(request: NextRequest) {
  try {
    const allCategories = await db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        description: categories.description,
        icon: categories.icon,
        color: categories.color,
        sla_hours: categories.sla_hours,
      })
      .from(categories)
      .where(eq(categories.active, true))
      .orderBy(asc(categories.display_order), desc(categories.created_at));

    return NextResponse.json(allCategories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

