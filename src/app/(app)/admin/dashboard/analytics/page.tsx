import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { tickets, categories, users, domains, scopes, ticket_statuses } from "@/db/schema";
import { eq, or, isNull, desc, sql, and, gte } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  FileText,
  Activity,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getOrCreateUser } from "@/lib/user-sync";
import { getUserRoleFromDB } from "@/lib/db-roles";

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; period?: string }>;
}) {
  const resolvedSearch = searchParams ? await searchParams : {};
  const page = Number(resolvedSearch?.page) || 1;
  const period = resolvedSearch?.period || "all";

  const { userId } = await auth();
  if (!userId) redirect("/");

  const dbUser = await getOrCreateUser(userId);
  if (!dbUser) redirect("/");

  const role = await getUserRoleFromDB(userId);
  if (role !== "admin" && role !== "super_admin") {
    redirect("/");
  }

  const [currentStaff] = await db
    .select({
      id: users.id,
      full_name: sql<string>`TRIM(CONCAT(COALESCE(${users.first_name}, ''), ' ', COALESCE(${users.last_name}, '')))`,
      email: users.email,
      domain: domains.name,
      scope: scopes.name,
    })
    .from(users)
    .leftJoin(domains, eq(users.primary_domain_id, domains.id))
    .leftJoin(scopes, eq(users.primary_scope_id, scopes.id))
    .where(eq(users.id, dbUser.id))
    .limit(1);

  if (!currentStaff) {
    redirect("/");
  }

  // Time filter
  let timeFilter;
  const now = new Date();
  if (period === "7d") {
    const date = new Date(now);
    date.setDate(now.getDate() - 7);
    timeFilter = gte(tickets.created_at, date);
  } else if (period === "30d") {
    const date = new Date(now);
    date.setDate(now.getDate() - 30);
    timeFilter = gte(tickets.created_at, date);
  }

  let assignmentFilter: ReturnType<typeof eq> | ReturnType<typeof or> = eq(tickets.assigned_to, currentStaff.id);
  if (currentStaff.domain) {
    const domainFilter = and(isNull(tickets.assigned_to), eq(categories.name, currentStaff.domain));
    if (domainFilter) {
      assignmentFilter = or(assignmentFilter, domainFilter);
    }
  }

  let whereClause: ReturnType<typeof eq> | ReturnType<typeof or> | ReturnType<typeof and> = assignmentFilter;
  if (timeFilter) {
    whereClause = and(whereClause, timeFilter);
  }

  const [totalRes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tickets)
    .leftJoin(categories, eq(tickets.category_id, categories.id))
    .where(whereClause);
  const totalTickets = Number(totalRes?.count || 0);

  const statusRes = await db
    .select({
      status: ticket_statuses.value,
      count: sql<number>`count(*)`,
    })
    .from(tickets)
    .leftJoin(categories, eq(tickets.category_id, categories.id))
    .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
    .where(whereClause)
    .groupBy(ticket_statuses.value);

  const openTickets = statusRes
    .filter((row) => ["OPEN", "IN_PROGRESS", "REOPENED", "AWAITING_STUDENT"].includes(row.status || ""))
    .reduce((sum, row) => sum + Number(row.count || 0), 0);
  const resolvedTickets = statusRes
    .filter((row) => ["RESOLVED", "CLOSED"].includes(row.status || ""))
    .reduce((sum, row) => sum + Number(row.count || 0), 0);
  const resolutionRate = totalTickets > 0 ? (resolvedTickets / totalTickets) * 100 : 0;

  const [escalatedRes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tickets)
    .leftJoin(categories, eq(tickets.category_id, categories.id))
    .where(and(whereClause, sql`${tickets.escalation_level} > 0`));
  const escalatedTickets = Number(escalatedRes?.count || 0);

  const catRes = await db
    .select({
      name: sql<string>`COALESCE(${tickets.metadata}->>'subcategory', ${categories.name})`,
      status: ticket_statuses.value,
      count: sql<number>`count(*)`,
    })
    .from(tickets)
    .leftJoin(categories, eq(tickets.category_id, categories.id))
    .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
    .where(whereClause)
    .groupBy(sql`COALESCE(${tickets.metadata}->>'subcategory', ${categories.name})`, ticket_statuses.value);

  const categoryStatsMap: Record<string, { name: string; total: number; resolved: number; open: number; inProgress: number }> =
    {};
  catRes.forEach((row) => {
    const name = row.name || "Unknown";
    if (!categoryStatsMap[name]) {
      categoryStatsMap[name] = { name, total: 0, resolved: 0, open: 0, inProgress: 0 };
    }
    const countValue = Number(row.count || 0);
    categoryStatsMap[name].total += countValue;
    if (["RESOLVED", "CLOSED"].includes(row.status || "")) {
      categoryStatsMap[name].resolved += countValue;
    } else if (row.status === "OPEN") {
      categoryStatsMap[name].open += countValue;
    } else {
      categoryStatsMap[name].inProgress += countValue;
    }
  });
  const categoryStats = Object.values(categoryStatsMap).sort((a, b) => b.total - a.total);

  const pageSize = 10;
  const offset = (page - 1) * pageSize;
  const paginatedTickets = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      status: ticket_statuses.value,
      created_at: tickets.created_at,
      category_name: categories.name,
    })
    .from(tickets)
    .leftJoin(categories, eq(tickets.category_id, categories.id))
    .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
    .where(whereClause)
    .limit(pageSize)
    .offset(offset)
    .orderBy(desc(tickets.created_at));

  const totalPages = Math.ceil(totalTickets / pageSize);
  const staffName = currentStaff.full_name?.trim() || currentStaff.email || "Admin";

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">Analytics</h1>
          <p className="text-muted-foreground text-sm">Performance metrics for {staffName}</p>
        </div>
      <div className="flex items-center gap-2">
        <Button variant={period === "7d" ? "default" : "outline"} size="sm" asChild>
          <Link href="?period=7d">7 Days</Link>
        </Button>
        <Button variant={period === "30d" ? "default" : "outline"} size="sm" asChild>
          <Link href="?period=30d">30 Days</Link>
        </Button>
        <Button variant={period === "all" ? "default" : "outline"} size="sm" asChild>
          <Link href="?period=all">All Time</Link>
        </Button>
        <Button variant="outline" size="sm" asChild className="ml-2">
          <Link href="/admin/dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Link>
        </Button>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
            <FileText className="w-4 h-4" /> Total Tickets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{totalTickets}</div>
          <div className="text-xs text-muted-foreground mt-1">In selected period</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
            <Activity className="w-4 h-4" /> Open
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-blue-600">{openTickets}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Resolved
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-600">{resolvedTickets}</div>
          <div className="text-xs text-muted-foreground mt-1">{resolutionRate.toFixed(1)}% rate</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> Escalated
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-red-600">{escalatedTickets}</div>
        </CardContent>
      </Card>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Category Breakdown</CardTitle>
        <CardDescription>Ticket distribution by category</CardDescription>
      </CardHeader>
      <CardContent>
        {categoryStats.length > 0 ? (
          <div className="space-y-4">
            {categoryStats.map((cat) => {
              const catResolutionRate = cat.total > 0 ? Math.round((cat.resolved / cat.total) * 100) : 0;
              return (
                <div key={cat.name} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-semibold">{cat.name}</p>
                    <Badge variant="outline">{cat.total} tickets</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Open</p>
                      <p className="text-lg font-semibold">{cat.open}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">In Progress</p>
                      <p className="text-lg font-semibold">{cat.inProgress}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Resolved</p>
                      <p className="text-lg font-semibold">{cat.resolved}</p>
                    </div>
                  </div>
                  <Progress value={catResolutionRate} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">{catResolutionRate}% resolution rate</p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No subcategory data available for this period.</p>
            <p className="text-xs mt-1">Tickets might be assigned to parent categories only.</p>
          </div>
        )}
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Ticket History</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedTickets.length > 0 ? (
              paginatedTickets.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono">#{t.id}</TableCell>
                  <TableCell>{t.title || "No Title"}</TableCell>
                  <TableCell>{t.category_name || "Uncategorized"}</TableCell>
                  <TableCell>
                    <Badge variant={["RESOLVED", "CLOSED"].includes(t.status || "") ? "default" : "secondary"}>
                      {t.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{t.created_at?.toLocaleDateString() || "-"}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                  No tickets found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} asChild>
                <Link href={`?page=${page - 1}&period=${period}`}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                </Link>
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} asChild>
                <Link href={`?page=${page + 1}&period=${period}`}>
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  </div>
  );
}
