import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { headers } from "next/headers";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import { getOrCreateUser } from "@/lib/user-sync";

/**
 * Clerk Webhook Handler
 * Auto-creates/updates user records in database when users sign up or update their profile
 * 
 * Events handled:
 * - user.created: Creates user record in database
 * - user.updated: Updates user record in database
 * - user.deleted: Optionally handle user deletion (soft delete or hard delete)
 * 
 * Setup in Clerk Dashboard:
 * 1. Go to Webhooks section
 * 2. Add endpoint: https://your-domain.com/api/webhooks/clerk
 * 3. Subscribe to: user.created, user.updated, user.deleted
 * 4. Copy signing secret and add to .env as CLERK_WEBHOOK_SECRET
 */

export async function POST(request: NextRequest) {
	try {
		// Get the Svix headers for verification
		const headerPayload = await headers();
		const svix_id = headerPayload.get("svix-id");
		const svix_timestamp = headerPayload.get("svix-timestamp");
		const svix_signature = headerPayload.get("svix-signature");

		// If there are no headers, error out
		if (!svix_id || !svix_timestamp || !svix_signature) {
			return NextResponse.json(
				{ error: "Error occurred -- no svix headers" },
				{ status: 400 }
			);
		}

		// Get the body
		const payload = await request.json();
		const body = JSON.stringify(payload);

		// Get the webhook secret from environment variables
		const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

		if (!webhookSecret) {
			console.error("CLERK_WEBHOOK_SECRET is not set");
			return NextResponse.json(
				{ error: "Webhook secret not configured" },
				{ status: 500 }
			);
		}

		// Create a new Svix instance with the secret
		const wh = new Webhook(webhookSecret);

		// Verify the payload with the headers
		let evt: { type: string; data: Record<string, unknown> };
		try {
			evt = wh.verify(body, {
				"svix-id": svix_id,
				"svix-timestamp": svix_timestamp,
				"svix-signature": svix_signature,
			}) as { type: string; data: Record<string, unknown> };
		} catch (err) {
			console.error("Error verifying webhook:", err);
			return NextResponse.json(
				{ error: "Error occurred -- webhook verification failed" },
				{ status: 400 }
			);
		}

		// Handle the webhook event
		const eventType = evt.type;
		const eventData = evt.data;

		const typedEventData = eventData as ClerkUserEventData;
		
		console.log(`[Clerk Webhook] Received event: ${eventType}`, {
			userId: typedEventData.id,
			email: Array.isArray(typedEventData.email_addresses) ? typedEventData.email_addresses[0]?.email_address : undefined,
		});

		switch (eventType) {
			case "user.created":
				await handleUserCreated(typedEventData);
				break;

			case "user.updated":
				await handleUserUpdated(typedEventData);
				break;

			case "user.deleted":
				await handleUserDeleted(typedEventData);
				break;

			default:
				console.log(`[Clerk Webhook] Unhandled event type: ${eventType}`);
		}

		return NextResponse.json({ received: true });
	} catch (error) {
		console.error("[Clerk Webhook] Error processing webhook:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}

/**
 * Handle user.created event
 * Creates user record in database when user signs up
 */
type ClerkUserEventData = {
	id: string;
	email_addresses?: Array<{ email_address: string }>;
	first_name?: string;
	last_name?: string;
	phone_numbers?: Array<{ phone_number: string }>;
};

async function handleUserCreated(eventData: ClerkUserEventData) {
	try {
		const clerkUserId = eventData.id;

		// Check if user already exists (idempotency)
		const [existingUser] = await db
			.select()
			.from(users)
			.where(eq(users.clerk_id, clerkUserId))
			.limit(1);

		if (existingUser) {
			console.log(`[Clerk Webhook] User ${clerkUserId} already exists, skipping creation`);
			return;
		}

		// Create user record (role will be assigned via user_roles table in getOrCreateUser)
		// Use getOrCreateUser which handles role assignment automatically
		const newUser = await getOrCreateUser(clerkUserId);

		console.log(`[Clerk Webhook] Created user record: ${newUser.id} for Clerk user: ${clerkUserId} with default role: student`);
	} catch (error) {
		console.error("[Clerk Webhook] Error creating user:", error);
		throw error;
	}
}

/**
 * Handle user.updated event
 * Updates user record in database when user updates their profile
 */
async function handleUserUpdated(eventData: ClerkUserEventData) {
	try {
		const clerkUserId = eventData.id;

		// Use sync utility to update user
		await getOrCreateUser(clerkUserId);

		console.log(`[Clerk Webhook] Updated user record for Clerk user: ${clerkUserId}`);
	} catch (error) {
		console.error("[Clerk Webhook] Error updating user:", error);
		throw error;
	}
}

/**
 * Handle user.deleted event
 * Implements soft delete: marks user as deleted but keeps data for audit/history
 * 
 * Note: We use soft delete to preserve:
 * - Ticket history (tickets.created_by references users.id)
 * - Student records (students.user_id references users.id)
 * - Audit trails and analytics
 * 
 * If you need hard delete, uncomment the hard delete option below.
 */
async function handleUserDeleted(eventData: ClerkUserEventData) {
	try {
		const clerkUserId = eventData.id;

		// Find user by clerk_id
		const [existingUser] = await db
			.select()
			.from(users)
			.where(eq(users.clerk_id, clerkUserId))
			.limit(1);

		if (!existingUser) {
			console.log(`[Clerk Webhook] User ${clerkUserId} not found in database, skipping deletion`);
			return;
		}

		// Option 1: Soft delete (RECOMMENDED) - Clear clerk_id to mark as deleted
		// This preserves data but prevents authentication
		await db
			.update(users)
			.set({
				clerk_id: `DELETED_${clerkUserId}_${Date.now()}`, // Prefix to mark as deleted, keep unique
				updated_at: new Date(),
			})
			.where(eq(users.id, existingUser.id));

		console.log(`[Clerk Webhook] Soft deleted user: ${clerkUserId} (database record preserved)`);

		// Option 2: Hard delete (NOT RECOMMENDED - breaks referential integrity)
		// ⚠️ WARNING: This will fail if there are foreign key constraints
		// Uncomment only if you want to completely remove user data
		// await db.delete(users).where(eq(users.clerk_id, clerkUserId));
		// console.log(`[Clerk Webhook] Hard deleted user: ${clerkUserId}`);
	} catch (error) {
		console.error("[Clerk Webhook] Error handling user deletion:", error);
		// Don't throw - webhook should still return success even if deletion fails
		// This prevents Clerk from retrying the webhook
	}
}

