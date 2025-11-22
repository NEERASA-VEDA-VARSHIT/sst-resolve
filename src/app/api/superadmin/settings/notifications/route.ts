import { NextResponse } from "next/server";
import { db, notification_settings } from "@/db";
import { eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { invalidateSlackConfigCache } from "@/lib/slack-config";

export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // Fetch settings (singleton row)
        const settings = await db.select({
            id: notification_settings.id,
            email_enabled: notification_settings.email_enabled,
            slack_enabled: notification_settings.slack_enabled,
            tat_reminders_enabled: notification_settings.tat_reminders_enabled,
            committee_notifications_enabled: notification_settings.committee_notifications_enabled,
            slack_config: notification_settings.slack_config,
            updated_by: notification_settings.updated_by,
            updated_at: notification_settings.updated_at,
        }).from(notification_settings).limit(1);

        if (settings.length === 0) {
            // Return defaults if no settings exist
            return NextResponse.json({
                slack_enabled: true,
                email_enabled: true,
                tat_reminders_enabled: true,
                committee_notifications_enabled: true,
                slack_config: {},
            });
        }

        return NextResponse.json(settings[0]);
    } catch (error) {
        console.error("Error fetching notification settings:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const body = await req.json();
        const { settings, slackConfig } = body;

        // Check if settings exist
        const existingSettings = await db.select({
            id: notification_settings.id,
        }).from(notification_settings).limit(1);

        if (existingSettings.length === 0) {
            // Create new settings
            await db.insert(notification_settings).values({
                slack_enabled: settings.slack_enabled,
                email_enabled: settings.email_enabled,
                tat_reminders_enabled: settings.tat_reminders_enabled,
                committee_notifications_enabled: settings.committee_notifications_enabled,
                slack_config: slackConfig,
            });
        } else {
            // Update existing settings
            await db
                .update(notification_settings)
                .set({
                    slack_enabled: settings.slack_enabled,
                    email_enabled: settings.email_enabled,
                    tat_reminders_enabled: settings.tat_reminders_enabled,
                    committee_notifications_enabled: settings.committee_notifications_enabled,
                    slack_config: slackConfig,
                    updated_at: new Date(),
                })
                .where(eq(notification_settings.id, existingSettings[0].id));
        }

        // Invalidate cache so new settings take effect immediately
        invalidateSlackConfigCache();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error updating notification settings:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
