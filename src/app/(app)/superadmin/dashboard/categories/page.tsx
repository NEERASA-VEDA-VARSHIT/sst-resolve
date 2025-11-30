import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import { getOrCreateUser } from "@/lib/auth/user-sync";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, ArrowLeft } from "lucide-react";
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
  let allCategories: Array<{
    id: number;
    name: string;
    slug: string;
    description: string | null;
    icon: string | null;
    color: string | null;
    sla_hours: number;
    display_order: number;
    active: boolean;
    default_authority?: number | null;
    domain_id?: number | null;
    created_at: Date | null;
    updated_at: Date | null;
  }> = [];
  try {
    const categoriesData = await db
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
        parent_category_id: categories.parent_category_id,
        is_active: categories.is_active,
        display_order: categories.display_order,
        created_at: categories.created_at,
        updated_at: categories.updated_at,
      })
      .from(categories)
      .where(eq(categories.is_active, true))
      .orderBy(asc(categories.display_order), desc(categories.created_at));
    
    // Transform to match Category interface (map is_active to active, ensure numbers)
    allCategories = categoriesData.map(cat => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      icon: cat.icon,
      color: cat.color,
      sla_hours: cat.sla_hours ?? 48,
      display_order: cat.display_order ?? 0,
      active: cat.is_active,
      default_authority: null, // Note: default_admin_id is UUID, but interface expects number
      domain_id: cat.domain_id ?? null,
      created_at: cat.created_at,
      updated_at: cat.updated_at,
    }));
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

