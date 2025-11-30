import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { getOrCreateUser } from "@/lib/auth/user-sync";
import type { InferSelectModel } from "drizzle-orm";

// PATCH: Update a category
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
    const categoryId = parseInt(id);
    if (isNaN(categoryId) || categoryId <= 0) {
      return NextResponse.json({ error: "Invalid category ID" }, { status: 400 });
    }

    const body = await request.json();
    type CategoryUpdate = Partial<InferSelectModel<typeof categories>> & {
      updated_at: Date;
    };
    const updateData: CategoryUpdate = {
      updated_at: new Date(),
    };

    // Validation and sanitization
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim().length === 0) {
        return NextResponse.json({ error: "Name must be a non-empty string" }, { status: 400 });
      }
      updateData.name = body.name.trim();
    }
    
    if (body.slug !== undefined) {
      if (typeof body.slug !== 'string' || body.slug.trim().length === 0) {
        return NextResponse.json({ error: "Slug must be a non-empty string" }, { status: 400 });
      }
      // Validate slug format
      if (!/^[a-z0-9_-]+$/.test(body.slug.trim())) {
        return NextResponse.json({ error: "Slug must contain only lowercase letters, numbers, hyphens, and underscores" }, { status: 400 });
      }
      updateData.slug = body.slug.trim();
    }
    
    if (body.description !== undefined) {
      updateData.description = body.description && typeof body.description === 'string' ? body.description.trim() || null : null;
    }
    
    if (body.icon !== undefined) {
      updateData.icon = body.icon && typeof body.icon === 'string' ? body.icon.trim() || null : null;
    }
    
    if (body.color !== undefined) {
      updateData.color = body.color && typeof body.color === 'string' ? body.color.trim() || null : null;
    }
    
    if (body.sla_hours !== undefined) {
      if (typeof body.sla_hours !== 'number' || body.sla_hours < 0) {
        return NextResponse.json({ error: "SLA hours must be a non-negative number" }, { status: 400 });
      }
      updateData.sla_hours = body.sla_hours;
    }
    
    if (body.display_order !== undefined) {
      if (typeof body.display_order !== 'number' || body.display_order < 0) {
        return NextResponse.json({ error: "Display order must be a non-negative number" }, { status: 400 });
      }
      updateData.display_order = body.display_order;
    }
    
    if (body.active !== undefined) {
      updateData.active = body.active === true;
    }
    
    if (body.domain_id !== undefined) {
      if (body.domain_id === null || body.domain_id === "") {
        return NextResponse.json({ error: "Domain ID cannot be empty" }, { status: 400 });
      }
      const parsedDomainId = parseInt(String(body.domain_id));
      if (isNaN(parsedDomainId) || parsedDomainId <= 0) {
        return NextResponse.json({ error: "Domain ID must be a positive integer" }, { status: 400 });
      }
      updateData.domain_id = parsedDomainId;
    }
    
    if (body.scope_id !== undefined) {
      updateData.scope_id = body.scope_id === null || body.scope_id === "" ? null : (() => {
        const parsed = parseInt(String(body.scope_id));
        if (isNaN(parsed) || parsed <= 0) {
          return null; // Invalid scope_id, set to null
        }
        return parsed;
      })();
    }
    
    if (body.default_admin_id !== undefined) {
      if (body.default_admin_id === null || body.default_admin_id === "") {
        updateData.default_admin_id = null;
      } else {
        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (typeof body.default_admin_id !== 'string' || !uuidRegex.test(body.default_admin_id)) {
          return NextResponse.json({ error: "Default admin ID must be a valid UUID format" }, { status: 400 });
        }
        updateData.default_admin_id = body.default_admin_id;
      }
    }

    const [updated] = await db
      .update(categories)
      .set(updateData)
      .where(eq(categories.id, categoryId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating category:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "23505") {
      return NextResponse.json({ error: "Category slug already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE: Delete a category (soft delete by setting active=false)
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
    const categoryId = parseInt(id);
    if (isNaN(categoryId) || categoryId <= 0) {
      return NextResponse.json({ error: "Invalid category ID" }, { status: 400 });
    }

    // Soft delete
    const [updated] = await db
      .update(categories)
      .set({ active: false, updated_at: new Date() })
      .where(eq(categories.id, categoryId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("Error deleting category:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

