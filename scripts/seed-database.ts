import { db } from "@/db";
import { sql } from "drizzle-orm";
import { readFileSync } from "fs";
import { join } from "path";

async function seedDatabase() {
    console.log("🌱 Starting database seeding...\n");

    try {
        // 1. Seed Roles
        console.log("📝 Seeding roles...");
        const rolesSQL = readFileSync(
            join(process.cwd(), "migrations", "seed_roles.sql"),
            "utf-8"
        );
        await db.execute(sql.raw(rolesSQL));
        console.log("✅ Roles seeded successfully\n");

        // 2. Seed Ticket Statuses
        console.log("📊 Seeding ticket statuses...");
        const statusesSQL = readFileSync(
            join(process.cwd(), "migrations", "seed_ticket_statuses.sql"),
            "utf-8"
        );
        await db.execute(sql.raw(statusesSQL));
        console.log("✅ Ticket statuses seeded successfully\n");

        // 3. Seed Domains & Scopes
        console.log("🏢 Seeding domains and scopes...");
        const domainsSQL = readFileSync(
            join(process.cwd(), "migrations", "seed_domains_scopes.sql"),
            "utf-8"
        );
        await db.execute(sql.raw(domainsSQL));
        console.log("✅ Domains and scopes seeded successfully\n");

        console.log("🎉 Database seeding completed!\n");

        // Verify seeding
        console.log("📋 Verification:");
        const roles = await db.execute(sql`SELECT name FROM roles ORDER BY id`);
        console.log(`   - ${roles.rows.length} roles created`);

        const statuses = await db.execute(sql`SELECT value FROM ticket_statuses ORDER BY display_order`);
        console.log(`   - ${statuses.rows.length} ticket statuses created`);

        const domains = await db.execute(sql`SELECT name FROM domains ORDER BY id`);
        console.log(`   - ${domains.rows.length} domains created`);

        const scopes = await db.execute(sql`SELECT name FROM scopes ORDER BY id`);
        console.log(`   - ${scopes.rows.length} scopes created\n`);

        process.exit(0);
    } catch (error) {
        console.error("❌ Seeding failed:", error);
        process.exit(1);
    }
}

seedDatabase();
