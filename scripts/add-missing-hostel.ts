import 'dotenv/config';
import { db, hostels } from "@/db";
import { eq } from "drizzle-orm";

async function addMissingHostel() {
  console.log("🔍 Checking existing hostels...\n");

  try {
    // Get all existing hostels
    const existingHostels = await db
      .select()
      .from(hostels)
      .orderBy(hostels.name);

    console.log(`📊 Found ${existingHostels.length} hostel(s) in database:`);
    existingHostels.forEach(h => {
      console.log(`   - ${h.name} (ID: ${h.id}, Code: ${h.code || 'N/A'}, Active: ${h.is_active})`);
    });

    // Define the two hostels that should exist
    const requiredHostels = [
      { name: 'Neeladri', code: 'NEL' },
      { name: 'Velankani', code: 'VEL' }
    ];

    console.log("\n🔍 Checking which hostels are missing...\n");

    for (const hostel of requiredHostels) {
      const exists = existingHostels.find(h => 
        h.name.toLowerCase() === hostel.name.toLowerCase()
      );

      if (!exists) {
        console.log(`➕ Adding missing hostel: ${hostel.name}...`);
        try {
          const [newHostel] = await db
            .insert(hostels)
            .values({
              name: hostel.name,
              code: hostel.code,
              is_active: true,
            })
            .returning();

          console.log(`✅ Successfully added: ${newHostel.name} (ID: ${newHostel.id})\n`);
        } catch (error: any) {
          if (error.message?.includes('unique') || error.message?.includes('duplicate')) {
            console.log(`⚠️  Hostel '${hostel.name}' might already exist (check case sensitivity)\n`);
          } else {
            console.error(`❌ Error adding ${hostel.name}:`, error.message);
          }
        }
      } else {
        console.log(`✓ ${hostel.name} already exists (ID: ${exists.id})\n`);
      }
    }

    // Final check
    const finalHostels = await db
      .select()
      .from(hostels)
      .orderBy(hostels.name);

    console.log(`\n📊 Final count: ${finalHostels.length} hostel(s):`);
    finalHostels.forEach(h => {
      console.log(`   - ${h.name} (ID: ${h.id}, Code: ${h.code || 'N/A'}, Active: ${h.is_active})`);
    });

    console.log("\n✅ Done!");

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

addMissingHostel();

