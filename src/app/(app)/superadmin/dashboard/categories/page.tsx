import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import { getOrCreateUser } from "@/lib/user-sync";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Settings, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { CategoryManager } from "@/components/admin/CategoryManager";

export default async function CategoriesPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  // Ensure user exists in database
  await getOrCreateUser(userId);

  // Get role from database (single source of truth)
  const role = await getUserRoleFromDB(userId);

  if (role !== "super_admin") {
    redirect("/student/dashboard");
  }

  // Fetch all categories - explicitly select columns to avoid Drizzle issues
  let allCategories = [];
  try {
    allCategories = await db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        description: categories.description,
        icon: categories.icon,
        color: categories.color,
        sla_hours: categories.sla_hours,
        domain_id: categories.domain_id,
        scope_id: categories.scope_id,
        default_admin_id: categories.default_admin_id,
        committee_id: categories.committee_id,
        parent_category_id: categories.parent_category_id,
        active: categories.active,
        display_order: categories.display_order,
        created_at: categories.created_at,
        updated_at: categories.updated_at,
      })
      .from(categories)
      .where(eq(categories.active, true))
      .orderBy(asc(categories.display_order), desc(categories.created_at));
  } catch (error) {
    console.error('[Super Admin Categories] Error fetching categories:', error);
    // Continue with empty array
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Category Builder
          </h1>
          <p className="text-muted-foreground">
            Manage categories, subcategories, and dynamic form fields. Build flexible ticket forms like Google Forms.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/superadmin/dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Categories
          </CardTitle>
          <CardDescription>
            Create and manage ticket categories. Each category can have subcategories with custom form fields.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CategoryManager initialCategories={allCategories} />
        </CardContent>
      </Card>
    </div>
  );
}

