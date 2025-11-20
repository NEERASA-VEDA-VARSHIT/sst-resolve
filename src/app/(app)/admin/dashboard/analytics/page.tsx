import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { tickets, categories, staff, users } from "@/db/schema";
import { eq, or, isNull, desc, sql, and, isNotNull, gte } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingUp, FileText, Clock, CheckCircle2, ArrowLeft, AlertCircle, BarChart3, Activity, Target, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getOrCreateUser } from "@/lib/user-sync";

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; period?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const dbUser = await getOrCreateUser(userId);
  if (!dbUser) redirect("/");

  // Await searchParams (Next.js 15 requirement)
  const { page: pageParam, period: periodParam } = await searchParams;
  const period = periodParam || "all";
  const page = Number(pageParam) || 1;

  // Get Staff ID
  const [currentStaff] = await db
    .select()
    .from(staff)
    .where(eq(staff.user_id, dbUser.id))
    .limit(1);

  if (!currentStaff) {
    return (
      <div className="p-8 space-y-4">
        <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
        <p>You are not registered as a staff member.</p>
        <Button asChild variant="outline">
          <Link href="/">Go Home</Link>
        </Button>
      </div>
    );
  }

  // --- Time Filter Logic ---
  let timeFilter = undefined;
  const now = new Date();

  if (period === "7d") {
    const date = new Date(now);
    date.setDate(date.getDate() - 7);
    timeFilter = gte(tickets.created_at, date);
  } else if (period === "30d") {
    const date = new Date(now);
    date.setDate(date.getDate() - 30);
    timeFilter = gte(tickets.created_at, date);
  }

  // Define the filter condition for this admin
  const whereClause = and(
    or(
      eq(tickets.assigned_to, currentStaff.id),
      // Include unassigned tickets in their domain
      and(isNull(tickets.assigned_to), eq(categories.name, currentStaff.domain))
    ),
    timeFilter
  );

  // 1. Total Count
  const [totalRes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tickets)
    .leftJoin(categories, eq(tickets.category_id, categories.id))
    .where(whereClause);
  const totalTickets = Number(totalRes?.count || 0);

  // 2. Status Counts
  const statusRes = await db
    .select({
      status: tickets.status,
      count: sql<number>`count(*)`
    })
    .from(tickets)
    .leftJoin(categories, eq(tickets.category_id, categories.id))
    .where(whereClause)
    .groupBy(tickets.status);

  const openTickets = statusRes
    .filter(r => ['OPEN', 'IN_PROGRESS', 'REOPENED', 'AWAITING_STUDENT'].includes(r.status))
    .reduce((acc, r) => acc + Number(r.count), 0);

  const resolvedTickets = statusRes
    .filter(r => ['RESOLVED', 'CLOSED'].includes(r.status))
    .reduce((acc, r) => acc + Number(r.count), 0);

  const resolutionRate = totalTickets > 0 ? (resolvedTickets / totalTickets) * 100 : 0;

  // 3. Escalated Count
  const [escalatedRes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tickets)
    .leftJoin(categories, eq(tickets.category_id, categories.id))
    .where(and(whereClause, sql`${tickets.escalation_level} > 0`));
  const escalatedTickets = Number(escalatedRes?.count || 0);

  // 4. Subcategory Stats (Grouped by Subcategory from Metadata or Category Name)
  const catRes = await db
    .select({
      name: sql<string>`COALESCE(${tickets.metadata}->>'subcategory', ${categories.name})`,
      status: tickets.status,
      count: sql<number>`count(*)`
    })
    .from(tickets)
    .leftJoin(categories, eq(tickets.category_id, categories.id))
    .where(whereClause)
    .groupBy(sql`COALESCE(${tickets.metadata}->>'subcategory', ${categories.name})`, tickets.status);

  const categoryStatsMap: Record<string, { name: string; total: number; resolved: number; open: number; inProgress: number }> = {};
  catRes.forEach(r => {
    const name = r.name || "Unknown";
    if (!categoryStatsMap[name]) categoryStatsMap[name] = { name, total: 0, resolved: 0, open: 0, inProgress: 0 };
    const count = Number(r.count);
    categoryStatsMap[name].total += count;

    if (['RESOLVED', 'CLOSED'].includes(r.status)) {
      categoryStatsMap[name].resolved += count;
    } else if (r.status === 'OPEN') {
      categoryStatsMap[name].open += count;
    } else {
      // IN_PROGRESS, REOPENED, AWAITING_STUDENT
      categoryStatsMap[name].inProgress += count;
    }
  });
  const categoryStats = Object.values(categoryStatsMap).sort((a, b) => b.total - a.total);

  // 5. Paginated Ticket List
  const pageSize = 10;
  const offset = (page - 1) * pageSize;

  const paginatedTickets = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      status: tickets.status,
      created_at: tickets.created_at,
      category_name: categories.name,
    })
    .from(tickets)
    .leftJoin(categories, eq(tickets.category_id, categories.id))
    .where(whereClause)
    .limit(pageSize)
    .offset(offset)
    .orderBy(desc(tickets.created_at));

  const totalPages = Math.ceil(totalTickets / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">Analytics</h1>
          <p className="text-muted-foreground text-sm">
            Performance metrics for {currentStaff.full_name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={period === '7d' ? 'default' : 'outline'} size="sm" asChild>
            <Link href="?period=7d">7 Days</Link>
          </Button>
          <Button variant={period === '30d' ? 'default' : 'outline'} size="sm" asChild>
            <Link href="?period=30d">30 Days</Link>
          </Button>
          <Button variant={period === 'all' ? 'default' : 'outline'} size="sm" asChild>
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

      {/* Key Metrics Overview */}
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

      {/* Category Breakdown (Subcategories Only) - Matching Super Admin Style */}
      <Card>
        <CardHeader>
          <CardTitle>Category Breakdown</CardTitle>
          <CardDescription>Ticket distribution by category</CardDescription>
        </CardHeader>
        <CardContent>
          {categoryStats.length > 0 ? (
            <div className="space-y-4">
              {categoryStats.map(cat => {
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

      {/* Ticket List with Pagination */}
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
                paginatedTickets.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono">#{t.id}</TableCell>
                    <TableCell>{t.title || "No Title"}</TableCell>
                    <TableCell>{t.category_name}</TableCell>
                    <TableCell>
                      <Badge variant={['RESOLVED', 'CLOSED'].includes(t.status) ? "default" : "secondary"}>
                        {t.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{t.created_at?.toLocaleDateString()}</TableCell>
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

          {/* Pagination Controls */}
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
