import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { subcategories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { getOrCreateUser } from "@/lib/auth/user-sync";
import { invalidateCategorySchemaCache } from "@/lib/cache/cache-invalidation";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const subcategoryId = parseInt(id);
    if (isNaN(subcategoryId)) {
      return NextResponse.json({ error: "Invalid subcategory ID" }, { status: 400 });
    }

    const body = await request.json();
    const updateData: Partial<typeof subcategories.$inferInsert> & { updated_at: Date } = { updated_at: new Date() };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.display_order !== undefined) updateData.display_order = body.display_order;
    if (body.active !== undefined) updateData.is_active = body.active;
    if (body.assigned_admin_id !== undefined) {
      updateData.assigned_admin_id = body.assigned_admin_id === null || body.assigned_admin_id === "" ? null : String(body.assigned_admin_id);
    }

    const [updated] = await db
      .update(subcategories)
      .set(updateData)
      .where(eq(subcategories.id, subcategoryId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Subcategory not found" }, { status: 404 });
    }

    // Invalidate category schema cache after subcategory update
    if (updated.category_id) {
      await invalidateCategorySchemaCache(updated.category_id).catch(err => 
        console.warn('Failed to invalidate cache:', err)
      );
    }

    return NextResponse.json(updated);
  } catch (error: unknown) {
    console.error("Error updating subcategory:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "23505") {
      return NextResponse.json({ error: "Subcategory slug already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const subcategoryId = parseInt(id);
    if (isNaN(subcategoryId)) {
      return NextResponse.json({ error: "Invalid subcategory ID" }, { status: 400 });
    }

    const [updated] = await db
      .update(subcategories)
      .set({ is_active: false, updated_at: new Date() })
      .where(eq(subcategories.id, subcategoryId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Subcategory not found" }, { status: 404 });
    }

    // Invalidate category schema cache after subcategory deletion
    if (updated.category_id) {
      await invalidateCategorySchemaCache(updated.category_id).catch(err => 
        console.warn('Failed to invalidate cache:', err)
      );
    }

    return NextResponse.json({ message: "Subcategory deleted successfully" });
  } catch (error) {
    console.error("Error deleting subcategory:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

