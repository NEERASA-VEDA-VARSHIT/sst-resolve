import { NextResponse } from "next/server";
import { db } from "@/db";
import { domains, scopes } from "@/db/schema";

export async function GET() {
    try {
        // Fetch all active domains
        const allDomains = await db.query.domains.findMany({
            where: (domains, { eq }) => eq(domains.is_active, true),
            orderBy: (domains, { asc }) => [asc(domains.id)],
        });

        // Fetch all active scopes
        const allScopes = await db.query.scopes.findMany({
            where: (scopes, { eq }) => eq(scopes.is_active, true),
            orderBy: (scopes, { asc }) => [asc(scopes.id)],
        });

        return NextResponse.json({
            success: true,
            domains: allDomains,
            scopes: allScopes,
        });
    } catch (error) {
        console.error("Error fetching domains:", error);
        return NextResponse.json(
            { error: "Failed to fetch domains" },
            { status: 500 }
        );
    }
}
