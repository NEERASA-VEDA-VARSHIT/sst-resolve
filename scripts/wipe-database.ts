import { neon } from "@neondatabase/serverless";

// This script completely wipes the database and creates a fresh schema
async function wipeDatabaseAndReset() {
    const sql = neon(process.env.DATABASE_URL!);

    console.log("🗑️  Dropping all tables...");

    // Drop public schema and recreate
    await sql`DROP SCHEMA public CASCADE`;
    await sql`CREATE SCHEMA public`;
    await sql`GRANT ALL ON SCHEMA public TO postgres`;
    await sql`GRANT ALL ON SCHEMA public TO public`;

    console.log("✅ Database completely wiped!");
    console.log("Now run: pnpm db:push");
}

wipeDatabaseAndReset().catch(console.error);
