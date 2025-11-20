import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { sub_subcategories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";

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
    const subSubcategoryId = parseInt(id);
    if (isNaN(subSubcategoryId)) {
      return NextResponse.json({ error: "Invalid sub-subcategory ID" }, { status: 400 });
    }

    const body = await request.json();
    const updateData: any = { updated_at: new Date() };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.display_order !== undefined) updateData.display_order = body.display_order;
    if (body.active !== undefined) updateData.active = body.active;

    const [updated] = await db
      .update(sub_subcategories)
      .set(updateData)
      .where(eq(sub_subcategories.id, subSubcategoryId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Sub-subcategory not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Error updating sub-subcategory:", error);
    if (error.code === "23505") {
      return NextResponse.json({ error: "Sub-subcategory slug already exists" }, { status: 400 });
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
    const subSubcategoryId = parseInt(id);
    if (isNaN(subSubcategoryId)) {
      return NextResponse.json({ error: "Invalid sub-subcategory ID" }, { status: 400 });
    }

    const [updated] = await db
      .update(sub_subcategories)
      .set({ active: false, updated_at: new Date() })
      .where(eq(sub_subcategories.id, subSubcategoryId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Sub-subcategory not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Sub-subcategory deleted successfully" });
  } catch (error) {
    console.error("Error deleting sub-subcategory:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

