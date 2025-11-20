import { db, ticket_statuses } from "@/db";

async function seedTicketStatuses() {
    try {
        console.log("🌱 Seeding ticket statuses...");

        // Check if statuses already exist
        const existing = await db.select().from(ticket_statuses).limit(1);
        if (existing.length > 0) {
            console.log("✅ Ticket statuses already seeded. Skipping...");
            process.exit(0);
        }

        // Insert initial statuses
        await db.insert(ticket_statuses).values([
            {
                value: "OPEN",
                label: "Open",
                description: "New ticket, not yet assigned",
                progress_percent: 10,
                badge_color: "default",
                is_active: true,
                is_final: false,
                display_order: 1,
            },
            {
                value: "IN_PROGRESS",
                label: "In Progress",
                description: "POC is actively working on the ticket",
                progress_percent: 50,
                badge_color: "secondary",
                is_active: true,
                is_final: false,
                display_order: 2,
            },
            {
                value: "AWAITING_STUDENT",
                label: "Awaiting Student",
                description: "Waiting for student response",
                progress_percent: 70,
                badge_color: "outline",
                is_active: true,
                is_final: false,
                display_order: 3,
            },
            {
                value: "REOPENED",
                label: "Reopened",
                description: "Ticket was reopened by student",
                progress_percent: 30,
                badge_color: "destructive",
                is_active: true,
                is_final: false,
                display_order: 4,
            },
            {
                value: "ESCALATED",
                label: "Escalated",
                description: "Ticket has been escalated",
                progress_percent: 60,
                badge_color: "destructive",
                is_active: true,
                is_final: false,
                display_order: 5,
            },
            {
                value: "RESOLVED",
                label: "Resolved",
                description: "Ticket has been resolved",
                progress_percent: 100,
                badge_color: "default",
                is_active: true,
                is_final: true,
                display_order: 6,
            },
        ]);

        console.log("✅ Successfully seeded 6 ticket statuses");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error seeding ticket statuses:", error);
        process.exit(1);
    }
}

seedTicketStatuses();
