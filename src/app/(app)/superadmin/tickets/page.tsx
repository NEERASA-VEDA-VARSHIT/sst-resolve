import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, tickets } from "@/db";
import { desc, sql, and, count } from "drizzle-orm";
import Link from "next/link";
import { TicketCard } from "@/components/layout/TicketCard";
import { AdminTicketFilters } from "@/components/admin/AdminTicketFilters";
import { Card, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";

export default async function SuperAdminAllTicketsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  // Ensure user exists in database
  await getOrCreateUser(userId);

  // Get role from database (single source of truth)
  const role = await getUserRoleFromDB(userId);
  if (role !== "super_admin") redirect("/student/dashboard");

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const params = resolvedSearchParams || {};
  const category = (typeof params["category"] === "string" ? params["category"] : params["category"]?.[0]) || "";
  const subcategory = (typeof params["subcategory"] === "string" ? params["subcategory"] : params["subcategory"]?.[0]) || "";
  const location = (typeof params["location"] === "string" ? params["location"] : params["location"]?.[0]) || "";
  const tat = (typeof params["tat"] === "string" ? params["tat"] : params["tat"]?.[0]) || "";
  const status = (typeof params["status"] === "string" ? params["status"] : params["status"]?.[0]) || "";
  const createdFrom = (typeof params["from"] === "string" ? params["from"] : params["from"]?.[0]) || "";
  const createdTo = (typeof params["to"] === "string" ? params["to"] : params["to"]?.[0]) || "";
  const user = (typeof params["user"] === "string" ? params["user"] : params["user"]?.[0]) || "";
  const sort = (typeof params["sort"] === "string" ? params["sort"] : params["sort"]?.[0]) || "newest";
  const page = parseInt((typeof params["page"] === "string" ? params["page"] : params["page"]?.[0]) || "1", 10);
  const limit = Math.min(50, Math.max(5, parseInt((typeof params["limit"] === "string" ? params["limit"] : params["limit"]?.[0]) || "20", 10)));
  const offset = (page - 1) * limit;

  // Build server-side where conditions (simple, case-insensitive where possible)
  const whereClauses: any[] = [];
  // Note: status, category, subcategory filters disabled due to schema changes
  // These would require joins with ticket_statuses and categories tables
  // and subcategory is stored in metadata JSON

  // if (status) {
  //   // Would need: JOIN ticket_statuses WHERE ticket_statuses.value = status
  //   whereClauses.push(sql`${tickets.status_id} = ${statusId}`);
  // }
  // if (category) {
  //   // Would need: JOIN categories WHERE categories.name = category
  //   whereClauses.push(sql`${tickets.category_id} = ${categoryId}`);
  // }
  // if (subcategory) {
  //   // Subcategory is in metadata->>'subcategory'
  //   whereClauses.push(sql`${tickets.metadata}->>'subcategory' ILIKE ${"%" + subcategory + "%"}`);
  // }

  if (location) {
    whereClauses.push(sql`LOWER(${tickets.location}) LIKE ${"%" + location.toLowerCase() + "%"}`);
  }
  // if (user) {
  //   // user_number doesn't exist - would need to join users table
  //   whereClauses.push(sql`${tickets.created_by} = ${userId}`);
  // }
  if (createdFrom) {
    const from = new Date(createdFrom);
    from.setHours(0, 0, 0, 0);
    whereClauses.push(sql`${tickets.created_at} >= ${from}`);
  }
  if (createdTo) {
    const to = new Date(createdTo);
    to.setHours(23, 59, 59, 999);
    whereClauses.push(sql`${tickets.created_at} <= ${to}`);
  }

  let allTickets: any[] = [];
  let total = 0;
  try {
    // total count with same filters
    const totalQuery = whereClauses.length > 0
      ? db.select({ total: count() }).from(tickets).where(and(...whereClauses))
      : db.select({ total: count() }).from(tickets);

    const [totalRow] = await totalQuery;
    total = totalRow?.total || 0;

    // fetch page
    const rowsQuery = whereClauses.length > 0
      ? db.select({
        id: tickets.id,
        created_at: tickets.created_at,
        updated_at: tickets.updated_at,
        status_id: tickets.status_id,
        category_id: tickets.category_id,
        created_by: tickets.created_by,
        assigned_to: tickets.assigned_to,
        description: tickets.description,
        location: tickets.location,
        metadata: tickets.metadata,
        escalation_level: tickets.escalation_level,
        resolved_at: tickets.resolved_at,
        acknowledged_at: tickets.acknowledged_at,
        resolution_due_at: tickets.resolution_due_at,
        rating: tickets.rating,
      }).from(tickets).where(and(...whereClauses)).orderBy(desc(tickets.created_at)).limit(limit).offset(offset)
      : db.select({
        id: tickets.id,
        created_at: tickets.created_at,
        updated_at: tickets.updated_at,
        status_id: tickets.status_id,
        category_id: tickets.category_id,
        created_by: tickets.created_by,
        assigned_to: tickets.assigned_to,
        description: tickets.description,
        location: tickets.location,
        metadata: tickets.metadata,
        escalation_level: tickets.escalation_level,
        resolved_at: tickets.resolved_at,
        acknowledged_at: tickets.acknowledged_at,
        resolution_due_at: tickets.resolution_due_at,
        rating: tickets.rating,
      }).from(tickets).orderBy(desc(tickets.created_at)).limit(limit).offset(offset);

    allTickets = await rowsQuery;
  } catch (error) {
    console.error('[Super Admin All Tickets] Error fetching tickets:', error);
    throw new Error('Failed to load tickets');
  }

  if (tat) {
    const now = new Date();
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);
    allTickets = allTickets.filter(t => {
      // Use authoritative due_at field first, fallback to metadata
      const metadata = (t.metadata as any) || {};
      const tatDate = t.due_at || (metadata?.tatDate ? new Date(metadata.tatDate) : null);
      const hasTat = !!tatDate && !isNaN(tatDate.getTime());

      if (tat === "has") return hasTat;
      if (tat === "none") return !hasTat;
      if (tat === "due") return hasTat && tatDate && tatDate.getTime() < now.getTime();
      if (tat === "upcoming") return hasTat && tatDate && tatDate.getTime() >= now.getTime();
      if (tat === "today") return hasTat && tatDate && tatDate.getTime() >= startOfToday.getTime() && tatDate.getTime() <= endOfToday.getTime();
      return true;
    });
  }

  if (sort === "oldest") allTickets = [...allTickets].reverse();

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  const buildHref = (newPage: number) => {
    const qp: Record<string, string> = {};
    for (const k of Object.keys(params)) {
      const v = params[k as keyof typeof params];
      if (typeof v === "string") qp[k] = v;
      else if (Array.isArray(v) && v.length > 0) qp[k] = String(v[0]);
    }
    qp.page = String(newPage);
    qp.limit = String(limit);
    const search = new URLSearchParams(qp).toString();
    return `/superadmin/tickets?${search}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            All Tickets
          </h1>
          <p className="text-muted-foreground">
            Complete view of all tickets across the system
          </p>
        </div>
      </div>

      <AdminTicketFilters />

      <div className="flex justify-between items-center pt-4">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <FileText className="w-6 h-6" />
          Tickets ({allTickets.length})
        </h2>
      </div>

      {allTickets.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold mb-1">No tickets found</p>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              All system tickets will appear here. Use the filters above to search for specific tickets.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {allTickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} basePath="/superadmin/dashboard" />
          ))}
        </div>
      )}

      {/* Pagination controls */}
      {total > 0 && (
        <div className="flex items-center justify-between pt-4">
          <div className="text-sm text-muted-foreground">
            Showing {Math.min(total, (page - 1) * limit + 1)} - {Math.min(page * limit, total)} of {total} tickets
          </div>
          <div className="flex items-center gap-2">
            <Link href={hasPrev ? buildHref(page - 1) : '#'} className={`px-3 py-1 border rounded ${!hasPrev ? 'opacity-50 pointer-events-none' : ''}`}>
              Previous
            </Link>
            <span className="text-sm">Page {page} of {totalPages}</span>
            <Link href={hasNext ? buildHref(page + 1) : '#'} className={`px-3 py-1 border rounded ${!hasNext ? 'opacity-50 pointer-events-none' : ''}`}>
              Next
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}


