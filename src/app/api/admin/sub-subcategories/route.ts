import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { sub_subcategories } from "@/db/schema";
import { eq, and, asc, desc } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";

// GET: Fetch sub-subcategories for a subcategory
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await getOrCreateUser(userId);
    const role = await getUserRoleFromDB(userId);
    
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const subcategoryId = searchParams.get("subcategory_id");

    if (!subcategoryId) {
      return NextResponse.json({ error: "subcategory_id is required" }, { status: 400 });
    }

    const subSubcats = await db
      .select()
      .from(sub_subcategories)
      .where(
        and(
          eq(sub_subcategories.subcategory_id, parseInt(subcategoryId)),
          eq(sub_subcategories.active, true)
        )
      )
      .orderBy(asc(sub_subcategories.display_order), desc(sub_subcategories.created_at));

    return NextResponse.json(subSubcats);
  } catch (error) {
    console.error("Error fetching sub-subcategories:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST: Create a new sub-subcategory
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await getOrCreateUser(userId);
    const role = await getUserRoleFromDB(userId);
    
    if (role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { subcategory_id, name, slug, description, display_order } = body;

    if (!subcategory_id || !name || !slug) {
      return NextResponse.json(
        { error: "subcategory_id, name, and slug are required" },
        { status: 400 }
      );
    }

    // Check if an inactive item with the same slug exists
    const [existingInactive] = await db
      .select()
      .from(sub_subcategories)
      .where(
        and(
          eq(sub_subcategories.subcategory_id, parseInt(subcategory_id)),
          eq(sub_subcategories.slug, slug),
          eq(sub_subcategories.active, false)
        )
      )
      .limit(1);

    if (existingInactive) {
      // Reactivate the existing item
      const [reactivated] = await db
        .update(sub_subcategories)
        .set({
          name,
          description: description || null,
          display_order: display_order || 0,
          active: true,
          updated_at: new Date(),
        })
        .where(eq(sub_subcategories.id, existingInactive.id))
        .returning();
      return NextResponse.json(reactivated, { status: 201 });
    }

    const [newSubSubcategory] = await db
      .insert(sub_subcategories)
      .values({
        subcategory_id: parseInt(subcategory_id),
        name,
        slug,
        description: description || null,
        display_order: display_order || 0,
        active: true,
      })
      .returning();

    return NextResponse.json(newSubSubcategory, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating sub-subcategory:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "23505") {
      return NextResponse.json(
        { error: "Sub-subcategory slug already exists for this subcategory" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

