import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, domains, scopes, categories, committees, hostels, batches, class_sections, roles } from "@/db";
import { eq } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";

/**
 * GET /api/admin/master-data
 * Fetch all master data needed for admin forms (domains, scopes, categories, committees)
 */
export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const role = await getUserRoleFromDB(userId);
        if (role !== "super_admin" && role !== "admin" && role !== "committee") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Fetch all master data in parallel
        const [domainsList, scopesList, categoriesList, committeesList, hostelsList, batchesList, classSectionsList, rolesList] = await Promise.all([
            db.select().from(domains),
            db.select().from(scopes),
            db.select().from(categories).where(eq(categories.active, true)),
            db.select().from(committees),
            db.select().from(hostels),
            db.select().from(batches),
            db.select().from(class_sections),
            db.select().from(roles),
        ]);

        // Format domains for dropdown (value/label format)
        // Filter out any empty string values to prevent Select.Item errors
        const formattedDomains = domainsList
            .filter(d => d.name && d.name.trim() !== "")
            .map(d => ({
                value: d.name,
                label: d.name,
            }));

        // Format roles for dropdown (value/label format)
        // Filter out any empty string values to prevent Select.Item errors
        const formattedRoles = rolesList
            .filter(r => r.name && r.name.trim() !== "")
            .map(r => ({
                value: r.name,
                label: r.name,
                description: r.description,
            }));

        // Format scopes for dropdown (value/label format)
        // Also extract unique scopes from staff data if needed
        // Filter out any empty string values to prevent Select.Item errors
        const formattedScopes = scopesList
            .filter(s => s.name && s.name.trim() !== "")
            .map(s => ({
                value: s.name,
                label: s.name,
            }));

        return NextResponse.json({
            domains: formattedDomains,
            scopes: formattedScopes,
            categories: categoriesList,
            committees: committeesList,
            hostels: hostelsList,
            batches: batchesList,
            class_sections: classSectionsList,
            roles: formattedRoles,
        });
    } catch (error) {
        console.error("Error fetching master data:", error);
        return NextResponse.json(
            { error: "Failed to fetch master data" },
            { status: 500 }
        );
    }
}