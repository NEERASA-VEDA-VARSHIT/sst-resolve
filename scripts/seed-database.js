const { neon } = require("@neondatabase/serverless");
const { config } = require("dotenv");
const { readFileSync } = require("fs");
const { join } = require("path");

// Load environment variables
config({ path: ".env.local" });

async function seedDatabase() {
    const sql = neon(process.env.DATABASE_URL);

    console.log("🌱 Starting database seeding...\n");

    try {
        // 1. Seed Roles
        console.log("📝 Seeding roles...");
        const rolesSQL = readFileSync(
            join(process.cwd(), "migrations", "seed_roles.sql"),
            "utf-8"
        );
        await sql(rolesSQL);
        console.log("✅ Roles seeded successfully\n");

        // 2. Seed Ticket Statuses
        console.log("📊 Seeding ticket statuses...");
        const statusesSQL = readFileSync(
            join(process.cwd(), "migrations", "seed_ticket_statuses.sql"),
            "utf-8"
        );
        await sql(statusesSQL);
        console.log("✅ Ticket statuses seeded successfully\n");

        // 3. Seed Domains & Scopes
        console.log("🏢 Seeding domains and scopes...");
        const domainsSQL = readFileSync(
            join(process.cwd(), "migrations", "seed_domains_scopes.sql"),
            "utf-8"
        );
        await sql(domainsSQL);
        console.log("✅ Domains and scopes seeded successfully\n");

        console.log("🎉 Database seeding completed!\n");

        // Verify seeding
        console.log("📋 Verification:");
        const roles = await sql`SELECT name FROM roles ORDER BY id`;
        console.log(`   - ${roles.length} roles created`);

        const statuses = await sql`SELECT value FROM ticket_statuses ORDER BY display_order`;
        console.log(`   - ${statuses.length} ticket statuses created`);

        const domains = await sql`SELECT name FROM domains ORDER BY id`;
        console.log(`   - ${domains.length} domains created`);

        const scopes = await sql`SELECT name FROM scopes ORDER BY id`;
        console.log(`   - ${scopes.length} scopes created\n`);

        process.exit(0);
    } catch (error) {
        console.error("❌ Seeding failed:", error);
        process.exit(1);
    }
}

seedDatabase();
