
import { db } from "@/db";
import { categories, subcategories, sub_subcategories } from "@/db/schema";
import { eq } from "drizzle-orm";

async function main() {
    console.log("Fetching hierarchy...");

    const cats = await db.select().from(categories).where(eq(categories.active, true));
    console.log(`Found ${cats.length} active categories.`);

    for (const cat of cats) {
        console.log(`\nCategory: ${cat.name} (${cat.slug})`);

        const subs = await db.select().from(subcategories).where(eq(subcategories.category_id, cat.id));
        console.log(`  Found ${subs.length} subcategories.`);

        for (const sub of subs) {
            const subSubs = await db.select().from(sub_subcategories).where(eq(sub_subcategories.subcategory_id, sub.id));
            console.log(`    Subcategory: ${sub.name} (${sub.slug}) - Has ${subSubs.length} sub-subcategories`);
            if (subSubs.length > 0) {
                subSubs.forEach(ss => console.log(`      - ${ss.name} (${ss.slug})`));
            }
        }
    }
}

main().catch(console.error).finally(() => process.exit(0));
