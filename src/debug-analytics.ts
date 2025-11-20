
import 'dotenv/config';
import { db } from "@/db";
import { tickets, categories } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

async function main() {
    console.log("Fetching recent tickets...");
    const recentTickets = await db.select({
        id: tickets.id,
        title: tickets.title,
        category_id: tickets.category_id,
        category_name: categories.name,
        parent_id: categories.parent_category_id,
        legacy_subcategory: tickets.subcategory,
        metadata: tickets.metadata
    })
        .from(tickets)
        .leftJoin(categories, eq(tickets.category_id, categories.id))
        .orderBy(desc(tickets.created_at))
        .limit(5);

    console.log("Recent Tickets:", JSON.stringify(recentTickets, null, 2));

    console.log("Fetching all categories...");
    const allCategories = await db.select().from(categories);
    console.log("All Categories:", JSON.stringify(allCategories, null, 2));
}

main().catch(console.error);
