/**
 * API Routes for Notification Configuration Management
 * Super Admin only
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, notification_config, categories, subcategories } from "@/db";
import { eq, desc } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";

/**
 * GET - List all notification configurations
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = await getUserRoleFromDB(userId);
    if (role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch all notification configs with category/subcategory names
    // Note: scope_id column doesn't exist in the database (migration 0003 didn't include it)
    // Using Drizzle select but excluding scope_id from the query
    const configs = await db
      .select({
        id: notification_config.id,
        category_id: notification_config.category_id,
        subcategory_id: notification_config.subcategory_id,
        category_name: categories.name,
        subcategory_name: subcategories.name,
        enable_slack: notification_config.enable_slack,
        enable_email: notification_config.enable_email,
        slack_channel: notification_config.slack_channel,
        slack_cc_user_ids: notification_config.slack_cc_user_ids,
        email_recipients: notification_config.email_recipients,
        priority: notification_config.priority,
        is_active: notification_config.is_active,
        created_at: notification_config.created_at,
        updated_at: notification_config.updated_at,
      })
      .from(notification_config)
      .leftJoin(categories, eq(notification_config.category_id, categories.id))
      .leftJoin(subcategories, eq(notification_config.subcategory_id, subcategories.id))
      .orderBy(desc(notification_config.priority), desc(notification_config.created_at));

    // Transform the results to match the expected format (add scope_id as null for compatibility)
    const transformedConfigs = configs.map((row) => ({
      id: row.id,
      scope_id: null, // Column doesn't exist in DB
      category_id: row.category_id,
      subcategory_id: row.subcategory_id,
      scope_name: null,
      domain_name: null,
      category_name: row.category_name,
      subcategory_name: row.subcategory_name,
      enable_slack: row.enable_slack,
      enable_email: row.enable_email,
      slack_channel: row.slack_channel,
      slack_cc_user_ids: row.slack_cc_user_ids,
      email_recipients: row.email_recipients,
      priority: row.priority,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    return NextResponse.json({ configs: transformedConfigs });
  } catch (error) {
    console.error("[GET /api/superadmin/notification-config] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * POST - Create new notification configuration
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = await getUserRoleFromDB(userId);
    if (role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      // scope_id not used - column doesn't exist in DB
      category_id,
      subcategory_id,
      enable_slack = true,
      enable_email = true,
      slack_channel,
      slack_cc_user_ids,
      email_recipients,
      priority = 0,
    } = body;

    // Validate: if subcategory_id is provided, category_id must also be provided
    if (subcategory_id && !category_id) {
      return NextResponse.json(
        { error: "category_id is required when subcategory_id is provided" },
        { status: 400 }
      );
    }

    // Validate slack_cc_user_ids and email_recipients are arrays
    const validatedSlackCc = Array.isArray(slack_cc_user_ids)
      ? slack_cc_user_ids.filter((id): id is string => typeof id === "string")
      : [];
    const validatedEmailRecipients = Array.isArray(email_recipients)
      ? email_recipients.filter((email): email is string => typeof email === "string")
      : [];

    // Calculate priority based on specificity
    let calculatedPriority = priority;
    if (subcategory_id && category_id) {
      calculatedPriority = 20; // Category + Subcategory
    } else if (category_id) {
      calculatedPriority = 10; // Category only
    } else {
      calculatedPriority = 0; // Global default (scope_id not supported - column doesn't exist)
    }

    // Insert without scope_id since the column doesn't exist in the database
    const [newConfig] = await db
      .insert(notification_config)
      .values({
        category_id: category_id || null,
        subcategory_id: subcategory_id || null,
        enable_slack: enable_slack ?? true,
        enable_email: enable_email ?? true,
        slack_channel: slack_channel || null,
        slack_cc_user_ids: validatedSlackCc.length > 0 ? validatedSlackCc : null,
        email_recipients: validatedEmailRecipients.length > 0 ? validatedEmailRecipients : null,
        priority: calculatedPriority,
        is_active: true,
      })
      .returning();

    return NextResponse.json({ config: newConfig }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/superadmin/notification-config] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
