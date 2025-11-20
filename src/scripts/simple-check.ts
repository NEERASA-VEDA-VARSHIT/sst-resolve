
import { db } from "@/db";
import { sub_subcategories } from "@/db/schema";
import { count } from "drizzle-orm";

async function main() {
    try {
        const result = await db.select({ count: count() }).from(sub_subcategories);
        console.log("Total sub-subcategories:", result[0].count);

        const all = await db.select().from(sub_subcategories).limit(5);
        console.log("Sample data:", JSON.stringify(all, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

main().then(() => process.exit(0));
