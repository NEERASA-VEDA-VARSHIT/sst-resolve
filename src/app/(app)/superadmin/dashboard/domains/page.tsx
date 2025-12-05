import { db } from "@/db";
import { eq } from "drizzle-orm";
import { DomainsManagement } from "@/components/admin/domains";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { hostels, class_sections, batches } from "@/db/schema";

// Use ISR - revalidate every 5 minutes (master data changes infrequently)
export const revalidate = 300;

export default async function DomainsPage() {
    // Fetch domains and scopes directly from database
    const allDomains = await db.query.domains.findMany({
        where: (domains, { eq }) => eq(domains.is_active, true),
        orderBy: (domains, { asc }) => [asc(domains.id)],
    });

    const allScopes = await db.query.scopes.findMany({
        where: (scopes, { eq }) => eq(scopes.is_active, true),
        orderBy: (scopes, { asc }) => [asc(scopes.id)],
    });

    // Fetch master data for scope form dropdowns
    const activeHostels = await db.query.hostels.findMany({
        where: (hostels, { eq }) => eq(hostels.is_active, true),
        orderBy: (hostels, { asc }) => [asc(hostels.id)],
    });

    const activeClassSections = await db.query.class_sections.findMany({
        where: (class_sections, { eq }) => eq(class_sections.is_active, true),
        orderBy: (class_sections, { asc }) => [asc(class_sections.id)],
    });

    const activeBatches = await db.query.batches.findMany({
        where: (batches, { eq }) => eq(batches.is_active, true),
        orderBy: (batches, { asc }) => [asc(batches.batch_year)],
    });

    const masterData = {
        hostels: activeHostels.map(h => ({ id: h.id, name: h.name })),
        classSections: activeClassSections.map(s => ({ id: s.id, name: s.name })),
        batches: activeBatches.map(b => ({ id: b.id, batch_year: b.batch_year })),
    };

    return (
        <div className="container mx-auto py-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Domains & Scopes Management</h1>
                    <p className="text-muted-foreground">
                        Manage operational domains and their scopes
                    </p>
                </div>
                <Button variant="outline" asChild>
                    <Link href="/superadmin/dashboard/master-data">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Master Data
                    </Link>
                </Button>
            </div>

            <DomainsManagement 
                initialDomains={allDomains}
                initialScopes={allScopes}
                masterData={masterData}
            />
        </div>
    );
}
