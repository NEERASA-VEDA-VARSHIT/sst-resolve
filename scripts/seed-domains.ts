import 'dotenv/config';
import { db } from "@/db";
import { domains, scopes } from "@/db/schema";
import { sql } from "drizzle-orm";

async function seedDomains() {
    console.log("🌱 Seeding domains and scopes...\n");

    try {
        // Insert domains
        console.log("📝 Inserting domains...");
        await db.execute(sql`
      INSERT INTO domains (name, description, is_active)
      VALUES 
        ('Hostel', 'Student hostel-related issues', true),
        ('College', 'College infrastructure and facilities', true),
      ON CONFLICT (name) DO NOTHING
    `);

        console.log("✅ Domains inserted\n");

        // Get hostel domain ID
        const hostelDomains = await db.execute(sql`
      SELECT id FROM domains WHERE name = 'Hostel'
    `);

        if (hostelDomains.rows.length > 0) {
            const hostelId = hostelDomains.rows[0].id;

            console.log("📝 Inserting scopes for Hostel domain...");
            await db.execute(sql`
        INSERT INTO scopes (domain_id, name, description, is_active)
        VALUES 
          (${hostelId}, 'Neeladri', 'Neeladri Hostel', true),
          (${hostelId}, 'Velankani', 'Velankani Hostel', true)
        ON CONFLICT (domain_id, name) DO NOTHING
      `);
            console.log("✅ Scopes inserted\n");
        }

        // Verify
        const allDomains = await db.execute(sql`SELECT * FROM domains ORDER BY id`);
        console.log("📊 Current domains:");
        for (const domain of allDomains.rows) {
            console.log(`   - ID ${domain.id}: ${domain.name} (${domain.description})`);
        }

        const allScopes = await db.execute(sql`SELECT * FROM scopes ORDER BY id`);
        if (allScopes.rows.length > 0) {
            console.log("\n📊 Current scopes:");
            for (const scope of allScopes.rows) {
                console.log(`   - ID ${scope.id}: ${scope.name} (Domain ID: ${scope.domain_id})`);
            }
        }

        console.log("\n✅ Seeding completed successfully!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error seeding domains:", error);
        process.exit(1);
    }
}

seedDomains();
