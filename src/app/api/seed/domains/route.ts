import { NextResponse } from "next/server";
import { db } from "@/db";
import { domains, scopes } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST() {
    try {
        console.log("🌱 Seeding domains and scopes...");

        // Insert domains using Drizzle ORM (only Hostel and College)
        const domainData = [
            { name: 'Hostel', description: 'Student hostel-related issues', is_active: true },
            { name: 'College', description: 'College infrastructure and facilities', is_active: true },
        ];

        for (const domain of domainData) {
            try {
                await db.insert(domains).values(domain).onConflictDoNothing();
            } catch {
                console.log(`Domain ${domain.name} might already exist, skipping...`);
            }
        }

        console.log("✅ Domains inserted");

        // Get hostel domain ID and insert scopes (Neeladri and Velankani)
        const hostelDomain = await db.query.domains.findFirst({
            where: eq(domains.name, 'Hostel'),
        });

        if (hostelDomain) {
            const scopeData = [
                { domain_id: hostelDomain.id, name: 'Neeladri', description: 'Neeladri Hostel', is_active: true },
                { domain_id: hostelDomain.id, name: 'Velankani', description: 'Velankani Hostel', is_active: true },
            ];

            for (const scope of scopeData) {
                try {
                    await db.insert(scopes).values(scope).onConflictDoNothing();
                } catch {
                    console.log(`Scope ${scope.name} might already exist, skipping...`);
                }
            }
            console.log("✅ Scopes inserted");
        }

        // Get all domains and scopes for response
        const allDomains = await db.query.domains.findMany({ orderBy: (domains, { asc }) => [asc(domains.id)] });
        const allScopes = await db.query.scopes.findMany({ orderBy: (scopes, { asc }) => [asc(scopes.id)] });

        return NextResponse.json({
            success: true,
            message: "Domains and scopes seeded successfully",
            domains: allDomains,
            scopes: allScopes,
        });
    } catch (error: unknown) {
        console.error("Error seeding domains:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json(
            { error: "Failed to seed domains", details: errorMessage },
            { status: 500 }
        );
    }
}
