/**
 * API Routes for Individual Notification Configuration
 * Super Admin only
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, notification_config } from "@/db";
import { eq } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";

/**
 * GET - Get single notification configuration
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = await getUserRoleFromDB(userId);
    if (role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const configId = parseInt(id, 10);

    if (isNaN(configId)) {
      return NextResponse.json({ error: "Invalid config ID" }, { status: 400 });
    }

    const [config] = await db
      .select()
      .from(notification_config)
      .where(eq(notification_config.id, configId))
      .limit(1);

    if (!config) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    return NextResponse.json({ config });
  } catch (error) {
    console.error("[GET /api/superadmin/notification-config/[id]] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update notification configuration
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = await getUserRoleFromDB(userId);
    if (role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const configId = parseInt(id, 10);

    if (isNaN(configId)) {
      return NextResponse.json({ error: "Invalid config ID" }, { status: 400 });
    }

    const body = await request.json();
    const {
      scope_id,
      category_id,
      subcategory_id,
      enable_slack,
      enable_email,
      slack_channel,
      slack_cc_user_ids,
      email_recipients,
      priority,
      is_active,
    } = body;

    // Validate: if subcategory_id is provided, category_id must also be provided
    if (subcategory_id !== undefined && subcategory_id !== null && !category_id) {
      return NextResponse.json(
        { error: "category_id is required when subcategory_id is provided" },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date(),
    };

    if (scope_id !== undefined) updateData.scope_id = scope_id || null;
    if (category_id !== undefined) updateData.category_id = category_id || null;
    if (subcategory_id !== undefined) updateData.subcategory_id = subcategory_id || null;
    if (enable_slack !== undefined) updateData.enable_slack = enable_slack;
    if (enable_email !== undefined) updateData.enable_email = enable_email;
    if (slack_channel !== undefined) updateData.slack_channel = slack_channel || null;
    if (slack_cc_user_ids !== undefined) {
      const validated = Array.isArray(slack_cc_user_ids)
        ? slack_cc_user_ids.filter((id): id is string => typeof id === "string")
        : [];
      updateData.slack_cc_user_ids = validated.length > 0 ? validated : null;
    }
    if (email_recipients !== undefined) {
      const validated = Array.isArray(email_recipients)
        ? email_recipients.filter((email): email is string => typeof email === "string")
        : [];
      updateData.email_recipients = validated.length > 0 ? validated : null;
    }
    if (priority !== undefined) updateData.priority = priority;
    if (is_active !== undefined) updateData.is_active = is_active;

    const [updatedConfig] = await db
      .update(notification_config)
      .set(updateData)
      .where(eq(notification_config.id, configId))
      .returning();

    if (!updatedConfig) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    return NextResponse.json({ config: updatedConfig });
  } catch (error) {
    console.error("[PATCH /api/superadmin/notification-config/[id]] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete notification configuration (soft delete by setting is_active = false)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = await getUserRoleFromDB(userId);
    if (role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const configId = parseInt(id, 10);

    if (isNaN(configId)) {
      return NextResponse.json({ error: "Invalid config ID" }, { status: 400 });
    }

    const [updatedConfig] = await db
      .update(notification_config)
      .set({
        is_active: false,
        updated_at: new Date(),
      })
      .where(eq(notification_config.id, configId))
      .returning();

    if (!updatedConfig) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/superadmin/notification-config/[id]] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
