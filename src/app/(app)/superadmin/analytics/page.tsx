import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, tickets, categories, users, roles, domains, scopes, ticket_statuses } from "@/db";
import { eq, sql } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    FileText, Clock, ArrowLeft, Zap, Target, Activity, Award, AlertTriangle, Shield,
    Globe, Building2, Layers, UserCheck
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getOrCreateUser } from "@/lib/auth/user-sync";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { Progress } from "@/components/ui/progress";
import { getAllTicketStatuses } from "@/lib/status/getTicketStatuses";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Force dynamic rendering since we use auth headers
export const dynamic = "force-dynamic";

export default async function SuperAdminAnalyticsPage() {
    try {
        const { userId } = await auth();
        if (!userId) redirect("/");

        const dbUser = await getOrCreateUser(userId);
        if (!dbUser) redirect("/");

        const role = await getUserRoleFromDB(userId);
        if (role !== 'super_admin') {
            redirect('/admin/dashboard/analytics');
        }

        // === SYSTEM-WIDE DATA COLLECTION ===

        // Fetch ALL tickets with comprehensive data
        const allTickets = await db
            .select({
                id: tickets.id,
                status: ticket_statuses.value,
                escalation_level: tickets.escalation_level,
                created_at: tickets.created_at,
                resolved_at: tickets.resolved_at,
                acknowledged_at: tickets.acknowledged_at,
                due_at: tickets.resolution_due_at,
                category_id: tickets.category_id,
                category_name: categories.name,
                location: tickets.location,
                rating: tickets.rating,
                rating_submitted: tickets.rating_submitted,
                assigned_to: tickets.assigned_to,
                created_by: tickets.created_by,
                admin_first_name: users.first_name,
                admin_last_name: users.last_name,
                admin_domain: domains.name,
                admin_scope: scopes.name
            })
            .from(tickets)
            .leftJoin(categories, eq(tickets.category_id, categories.id))
            .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
            .leftJoin(users, eq(tickets.assigned_to, users.id))
            .leftJoin(domains, eq(users.primary_domain_id, domains.id))
            .leftJoin(scopes, eq(users.primary_scope_id, scopes.id));

        // Fetch all staff members (admins, super_admins, committee)
        const allStaff = await db
            .select({
                id: users.id,
                first_name: users.first_name,
                last_name: users.last_name,
                domain: domains.name,
                scope: scopes.name,
                role: roles.name
            })
            .from(users)
            .leftJoin(roles, eq(users.role_id, roles.id))
            .leftJoin(domains, eq(users.primary_domain_id, domains.id))
            .leftJoin(scopes, eq(users.primary_scope_id, scopes.id))
            .where(sql`${roles.name} IN ('admin', 'super_admin', 'committee')`);

        // Fetch user counts by role
        await db
            .select({
                role: roles.name,
                count: sql<number>`count(*)`
            })
            .from(users)
            .leftJoin(roles, eq(users.role_id, roles.id))
            .groupBy(roles.name);

        // Fetch dynamic statuses
        const ticketStatuses = await getAllTicketStatuses();
        const activeStatuses = ticketStatuses.filter(s => s.is_active);
        const finalStatuses = new Set(ticketStatuses.filter(s => s.is_final).map(s => s.value));

        // Time periods
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        // const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

        // Last 7 days
        const last7Days = new Date(now);
        last7Days.setDate(now.getDate() - 7);

        // Last 30 days
        const last30Days = new Date(now);
        last30Days.setDate(now.getDate() - 30);

        // === CORE METRICS ===
        const totalTickets = allTickets.length;
        const openTickets = allTickets.filter(t => !finalStatuses.has(t.status || "")).length;
        const resolvedTickets = allTickets.filter(t => finalStatuses.has(t.status || ""));
        const unassignedTickets = allTickets.filter(t => !t.assigned_to).length;

        // === TIME-BASED METRICS ===
        const ticketsToday = allTickets.filter(t => t.created_at && t.created_at >= startOfToday);
        const ticketsThisWeek = allTickets.filter(t => t.created_at && t.created_at >= startOfWeek);
        const ticketsThisMonth = allTickets.filter(t => t.created_at && t.created_at >= startOfMonth);
        const ticketsLast7Days = allTickets.filter(t => t.created_at && t.created_at >= last7Days);
        const ticketsLast30Days = allTickets.filter(t => t.created_at && t.created_at >= last30Days);

        // const resolvedToday = resolvedTickets.filter(t => t.resolved_at && t.resolved_at >= startOfToday);
        const resolvedThisWeek = resolvedTickets.filter(t => t.resolved_at && t.resolved_at >= startOfWeek);
        const resolvedThisMonth = resolvedTickets.filter(t => t.resolved_at && t.resolved_at >= startOfMonth);

        // === PERFORMANCE METRICS ===
        const resolvedWithTime = resolvedTickets.filter(t => t.created_at && t.resolved_at);
        const avgResolutionHours = resolvedWithTime.length > 0
            ? resolvedWithTime.reduce((sum, t) => {
                const hours = (t.resolved_at!.getTime() - t.created_at!.getTime()) / (1000 * 60 * 60);
                return sum + hours;
            }, 0) / resolvedWithTime.length
            : 0;

        const acknowledgedTickets = allTickets.filter(t => t.created_at && t.acknowledged_at);
        const avgAckHours = acknowledgedTickets.length > 0
            ? acknowledgedTickets.reduce((sum, t) => {
                const hours = (t.acknowledged_at!.getTime() - t.created_at!.getTime()) / (1000 * 60 * 60);
                return sum + hours;
            }, 0) / acknowledgedTickets.length
            : 0;

        // === QUALITY METRICS ===
        const ratedTickets = allTickets.filter(t => t.rating_submitted && t.rating !== null);
        const avgRating = ratedTickets.length > 0
            ? ratedTickets.reduce((sum, t) => sum + (t.rating || 0), 0) / ratedTickets.length
            : 0;

        const highRatingTickets = ratedTickets.filter(t => (t.rating || 0) >= 4).length;
        // const lowRatingTickets = ratedTickets.filter(t => (t.rating || 0) <= 2).length;
        const satisfactionRate = ratedTickets.length > 0
            ? Math.round((highRatingTickets / ratedTickets.length) * 100)
            : 0;

        // === STAFF PERFORMANCE ===
        const staffPerformance = allStaff.map(staffMember => {
            const assignedTickets = allTickets.filter(t => t.assigned_to === staffMember.id);
            const staffResolved = assignedTickets.filter(t => finalStatuses.has(t.status || ""));
            const staffRated = assignedTickets.filter(t => t.rating_submitted && t.rating !== null);
            const staffAvgRating = staffRated.length > 0
                ? staffRated.reduce((sum, t) => sum + (t.rating || 0), 0) / staffRated.length
                : 0;

            return {
                id: staffMember.id,
                full_name: [staffMember.first_name, staffMember.last_name].filter(Boolean).join(" ") || "Unknown",
                domain: staffMember.domain,
                scope: staffMember.scope,
                assignedCount: assignedTickets.length,
                resolvedCount: staffResolved.length,
                resolutionRate: assignedTickets.length > 0 ? (staffResolved.length / assignedTickets.length) * 100 : 0,
                avgRating: staffAvgRating,
                ratedCount: staffRated.length,
            };
        }).sort((a, b) => b.assignedCount - a.assignedCount);

        // === DOMAIN ANALYSIS ===
        const hostelTickets = allTickets.filter(t => t.admin_domain === "Hostel");
        const collegeTickets = allTickets.filter(t => t.admin_domain === "College");

        const domainStats = {
            Hostel: {
                total: hostelTickets.length,
                resolved: hostelTickets.filter(t => finalStatuses.has(t.status || "")).length,
                pending: hostelTickets.filter(t => !finalStatuses.has(t.status || "")).length,
                avgRating: hostelTickets.filter(t => t.rating).length > 0
                    ? hostelTickets.filter(t => t.rating).reduce((sum, t) => sum + (t.rating || 0), 0) / hostelTickets.filter(t => t.rating).length
                    : 0,
            },
            College: {
                total: collegeTickets.length,
                resolved: collegeTickets.filter(t => finalStatuses.has(t.status || "")).length,
                pending: collegeTickets.filter(t => !finalStatuses.has(t.status || "")).length,
                avgRating: collegeTickets.filter(t => t.rating).length > 0
                    ? collegeTickets.filter(t => t.rating).reduce((sum, t) => sum + (t.rating || 0), 0) / collegeTickets.filter(t => t.rating).length
                    : 0,
            },
            Unassigned: {
                total: unassignedTickets,
                resolved: 0,
                pending: unassignedTickets,
                avgRating: 0,
            },
        };

        // === CATEGORY ANALYSIS ===
        type CategoryStat = {
            name: string;
            total: number;
            resolved: number;
            pending: number;
            escalated: number;
            avgRating: number;
            ratedCount: number;
        };
        const categoryStats = Object.values(
            allTickets.reduce((acc, ticket) => {
                const categoryName = ticket.category_name || "Uncategorized";
                if (!acc[categoryName]) {
                    acc[categoryName] = {
                        name: categoryName,
                        total: 0,
                        resolved: 0,
                        pending: 0,
                        escalated: 0,
                        avgRating: 0,
                        ratedCount: 0,
                    };
                }
                acc[categoryName].total++;
                if (finalStatuses.has(ticket.status || "")) {
                    acc[categoryName].resolved++;
                } else {
                    acc[categoryName].pending++;
                }
                if ((ticket.escalation_level || 0) > 0) {
                    acc[categoryName].escalated++;
                }
                if (ticket.rating) {
                    acc[categoryName].avgRating += ticket.rating;
                    acc[categoryName].ratedCount++;
                }
                return acc;
            }, {} as Record<string, CategoryStat>)
        ).map(cat => ({
            ...cat,
            avgRating: cat.ratedCount > 0 ? cat.avgRating / cat.ratedCount : 0,
        })).sort((a, b) => b.total - a.total);

        // === ESCALATION ANALYSIS ===
        const escalatedTickets = allTickets.filter(t => (t.escalation_level || 0) > 0);
        const escalationsByLevel = {
            level1: escalatedTickets.filter(t => t.escalation_level === 1).length,
            level2: escalatedTickets.filter(t => t.escalation_level === 2).length,
            level3: escalatedTickets.filter(t => t.escalation_level === 3).length,
        };

        // === TAT PERFORMANCE ===
        const overdueTickets = allTickets.filter(t => {
            if (!t.due_at || finalStatuses.has(t.status || "")) return false;
            return t.due_at < now;
        });

        // === SYSTEM HEALTH ===
        const responseRate = totalTickets > 0
            ? Math.round((acknowledgedTickets.length / totalTickets) * 100)
            : 0;
        const resolutionRate = totalTickets > 0
            ? Math.round((resolvedTickets.length / totalTickets) * 100)
            : 0;
        const assignmentRate = totalTickets > 0
            ? Math.round(((totalTickets - unassignedTickets) / totalTickets) * 100)
            : 0;

        // === DAILY TREND (7 days) ===
        const dailyTrend = Array.from({ length: 7 }, (_, i) => {
            const date = new Date(now);
            date.setDate(now.getDate() - (6 - i));
            date.setHours(0, 0, 0, 0);
            const nextDay = new Date(date);
            nextDay.setDate(date.getDate() + 1);

            const created = allTickets.filter(t =>
                t.created_at && t.created_at >= date && t.created_at < nextDay
            ).length;
            const resolved = allTickets.filter(t =>
                t.resolved_at && t.resolved_at >= date && t.resolved_at < nextDay
            ).length;

            return {
                date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                created,
                resolved,
            };
        });

        return (
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" asChild>
                            <Link href="/superadmin/dashboard">
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back
                            </Link>
                        </Button>
                        <div>
                            <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
                                <Shield className="h-10 w-10 text-primary" />
                                <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                                    Super Admin Analytics
                                </span>
                            </h1>
                            <p className="text-muted-foreground mt-1">
                                System-wide insights • {activeStatuses.length} active statuses • {allStaff.length} staff members
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Badge variant="outline" className="text-sm">
                            <Globe className="h-3 w-3 mr-1" />
                            All Domains
                        </Badge>
                        <Badge variant="default" className="text-sm">
                            <Activity className="h-3 w-3 mr-1" />
                            Live Data
                        </Badge>
                    </div>
                </div>

                {/* System Health Overview */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                    <Card className="border-t-4 border-t-blue-500">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium flex items-center justify-between">
                                <span>Total Tickets</span>
                                <FileText className="h-4 w-4 text-muted-foreground" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{totalTickets}</div>
                            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                                <div>{ticketsToday.length} today</div>
                                <div>{ticketsLast7Days.length} last 7 days</div>
                                <div>{ticketsLast30Days.length} last 30 days</div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-t-4 border-t-green-500">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium flex items-center justify-between">
                                <span>Resolution Rate</span>
                                <Target className="h-4 w-4 text-muted-foreground" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{resolutionRate}%</div>
                            <Progress value={resolutionRate} className="mt-2 h-2" />
                            <p className="text-xs text-muted-foreground mt-2">
                                {resolvedTickets.length} / {totalTickets} resolved
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-t-4 border-t-purple-500">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium flex items-center justify-between">
                                <span>Avg Rating</span>
                                <Award className="h-4 w-4 text-muted-foreground" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{avgRating.toFixed(1)}<span className="text-base text-muted-foreground">/5.0</span></div>
                            <div className="flex gap-0.5 mt-2">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <div
                                        key={star}
                                        className={`h-4 w-4 ${star <= Math.round(avgRating) ? 'text-yellow-500' : 'text-gray-300'}`}
                                    >
                                        ★
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {satisfactionRate}% satisfaction
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-t-4 border-t-amber-500">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium flex items-center justify-between">
                                <span>Active Tickets</span>
                                <Activity className="h-4 w-4 text-muted-foreground" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{openTickets}</div>
                            <div className="space-y-1 text-xs mt-2">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Unassigned:</span>
                                    <span className="font-medium">{unassignedTickets}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Overdue:</span>
                                    <span className="font-medium text-red-600">{overdueTickets.length}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-t-4 border-t-red-500">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium flex items-center justify-between">
                                <span>Escalated</span>
                                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-red-600">{escalatedTickets.length}</div>
                            <div className="space-y-1 text-xs mt-2">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Level 1:</span>
                                    <span>{escalationsByLevel.level1}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Level 2:</span>
                                    <span>{escalationsByLevel.level2}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Level 3:</span>
                                    <span>{escalationsByLevel.level3}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Tabs for Detailed Analytics */}
                <Tabs defaultValue="overview" className="space-y-4">
                    <TabsList className="grid w-full grid-cols-5">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="staff">Staff Performance</TabsTrigger>
                        <TabsTrigger value="domains">Domains</TabsTrigger>
                        <TabsTrigger value="categories">Categories</TabsTrigger>
                        <TabsTrigger value="trends">Trends</TabsTrigger>
                    </TabsList>

                    {/* Overview Tab */}
                    <TabsContent value="overview" className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-3">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Zap className="h-4 w-4" />
                                        Avg Resolution Time
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-bold">
                                        {avgResolutionHours > 24
                                            ? `${(avgResolutionHours / 24).toFixed(1)} days`
                                            : `${avgResolutionHours.toFixed(1)} hrs`
                                        }
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Based on {resolvedWithTime.length} tickets
                                    </p>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Clock className="h-4 w-4" />
                                        Avg Response Time
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-bold">
                                        {avgAckHours < 1
                                            ? `${(avgAckHours * 60).toFixed(0)} min`
                                            : `${avgAckHours.toFixed(1)} hrs`
                                        }
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {responseRate}% acknowledged
                                    </p>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <UserCheck className="h-4 w-4" />
                                        Assignment Rate
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-bold">{assignmentRate}%</div>
                                    <Progress value={assignmentRate} className="mt-2 h-2" />
                                    <p className="text-xs text-muted-foreground mt-2">
                                        {unassignedTickets} unassigned tickets
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* System Statuses */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Status Distribution</CardTitle>
                                <CardDescription>All ticket statuses across the system</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-3 md:grid-cols-2">
                                    {ticketStatuses.map((status) => {
                                        const count = allTickets.filter(t => t.status === status.value).length;
                                        const percentage = totalTickets > 0 ? (count / totalTickets) * 100 : 0;
                                        return (
                                            <div key={status.id} className="flex items-center justify-between p-3 border rounded-lg">
                                                <div className="flex items-center gap-3">
                                                    <Badge variant={(status.badge_color as "default" | "secondary" | "destructive" | "outline") || "default"}>
                                                        {status.label}
                                                    </Badge>
                                                    <div>
                                                        <p className="text-sm font-medium">{count} tickets</p>
                                                        <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}%</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs text-muted-foreground">Progress</p>
                                                    <p className="text-sm font-bold">{status.progress_percent}%</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Staff Performance Tab */}
                    <TabsContent value="staff" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Staff Performance Leaderboard</CardTitle>
                                <CardDescription>Individual admin performance metrics</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {staffPerformance.slice(0, 10).map((staff, index) => (
                                        <div key={staff.id} className="flex items-center gap-4 p-4 border rounded-lg">
                                            <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                                                {index + 1}
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="font-semibold">{staff.full_name || "Unknown"}</h4>
                                                <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                                                    <span>{staff.domain} - {staff.scope}</span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-4 gap-4 text-center">
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Assigned</p>
                                                    <p className="text-lg font-bold">{staff.assignedCount}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Resolved</p>
                                                    <p className="text-lg font-bold text-green-600">{staff.resolvedCount}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Rate</p>
                                                    <p className="text-lg font-bold">{staff.resolutionRate.toFixed(0)}%</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Rating</p>
                                                    <p className="text-lg font-bold text-purple-600">
                                                        {staff.avgRating > 0 ? staff.avgRating.toFixed(1) : '-'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Domains Tab */}
                    <TabsContent value="domains" className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-3">
                            {Object.entries(domainStats).map(([domain, stats]) => (
                                <Card key={domain}>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Building2 className="h-4 w-4" />
                                            {domain}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-3 gap-2 text-center">
                                            <div>
                                                <p className="text-xs text-muted-foreground">Total</p>
                                                <p className="text-2xl font-bold">{stats.total}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">Resolved</p>
                                                <p className="text-2xl font-bold text-green-600">{stats.resolved}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">Pending</p>
                                                <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-xs mb-1">
                                                <span>Resolution Rate</span>
                                                <span>{stats.total > 0 ? ((stats.resolved / stats.total) * 100).toFixed(0) : 0}%</span>
                                            </div>
                                            <Progress value={stats.total > 0 ? (stats.resolved / stats.total) * 100 : 0} className="h-2" />
                                        </div>
                                        {stats.avgRating > 0 && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-muted-foreground">Avg Rating</span>
                                                <span className="text-lg font-bold">{stats.avgRating.toFixed(1)} ★</span>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </TabsContent>

                    {/* Categories Tab */}
                    <TabsContent value="categories" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Category Analysis</CardTitle>
                                <CardDescription>Performance breakdown by category</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {categoryStats.map((cat) => {
                                        const resolutionRate = cat.total > 0 ? (cat.resolved / cat.total) * 100 : 0;
                                        const escalationRate = cat.total > 0 ? (cat.escalated / cat.total) * 100 : 0;
                                        return (
                                            <div key={cat.name} className="border rounded-lg p-4">
                                                <div className="flex justify-between items-center mb-3">
                                                    <h4 className="font-semibold flex items-center gap-2">
                                                        <Layers className="h-4 w-4" />
                                                        {cat.name}
                                                    </h4>
                                                    <Badge>{cat.total} tickets</Badge>
                                                </div>
                                                <div className="grid grid-cols-5 gap-4 mb-3">
                                                    <div className="text-center">
                                                        <p className="text-xs text-muted-foreground">Total</p>
                                                        <p className="text-lg font-bold">{cat.total}</p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-xs text-muted-foreground">Resolved</p>
                                                        <p className="text-lg font-bold text-green-600">{cat.resolved}</p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-xs text-muted-foreground">Pending</p>
                                                        <p className="text-lg font-bold text-amber-600">{cat.pending}</p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-xs text-muted-foreground">Escalated</p>
                                                        <p className="text-lg font-bold text-red-600">{cat.escalated}</p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-xs text-muted-foreground">Rating</p>
                                                        <p className="text-lg font-bold text-purple-600">
                                                            {cat.avgRating > 0 ? cat.avgRating.toFixed(1) : '-'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <div>
                                                        <div className="flex justify-between text-xs mb-1">
                                                            <span>Resolution Rate</span>
                                                            <span>{resolutionRate.toFixed(0)}%</span>
                                                        </div>
                                                        <Progress value={resolutionRate} className="h-2" />
                                                    </div>
                                                    {escalationRate > 0 && (
                                                        <div>
                                                            <div className="flex justify-between text-xs mb-1">
                                                                <span>Escalation Rate</span>
                                                                <span>{escalationRate.toFixed(0)}%</span>
                                                            </div>
                                                            <Progress value={escalationRate} className="h-2 bg-red-100" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Trends Tab */}
                    <TabsContent value="trends" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>7-Day Trend</CardTitle>
                                <CardDescription>Daily ticket creation and resolution</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {dailyTrend.map((day) => (
                                        <div key={day.date} className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="font-medium">{day.date}</span>
                                                <span className="text-muted-foreground">
                                                    Created: {day.created} • Resolved: {day.resolved}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <Progress value={(day.created / Math.max(...dailyTrend.map(d => d.created))) * 100} className="h-2 bg-blue-100" />
                                                </div>
                                                <div>
                                                    <Progress value={(day.resolved / Math.max(...dailyTrend.map(d => d.resolved))) * 100} className="h-2 bg-green-100" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <div className="grid gap-4 md:grid-cols-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>This Week vs Last Week</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        <div className="flex justify-between">
                                            <span className="text-sm">Tickets This Week</span>
                                            <span className="font-bold">{ticketsThisWeek.length}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm">Resolved This Week</span>
                                            <span className="font-bold text-green-600">{resolvedThisWeek.length}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm">Weekly Resolution Rate</span>
                                            <span className="font-bold">
                                                {ticketsThisWeek.length > 0 ? ((resolvedThisWeek.length / ticketsThisWeek.length) * 100).toFixed(0) : 0}%
                                            </span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Monthly Summary</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        <div className="flex justify-between">
                                            <span className="text-sm">Tickets This Month</span>
                                            <span className="font-bold">{ticketsThisMonth.length}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm">Resolved This Month</span>
                                            <span className="font-bold text-green-600">{resolvedThisMonth.length}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm">Monthly Resolution Rate</span>
                                            <span className="font-bold">
                                                {ticketsThisMonth.length > 0 ? ((resolvedThisMonth.length / ticketsThisMonth.length) * 100).toFixed(0) : 0}%
                                            </span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        );
    } catch (error) {
        console.error("[SuperAdminAnalyticsPage] Error:", error);
        return (
            <div className="space-y-8">
                <Button variant="ghost" asChild>
                    <Link href="/superadmin/dashboard">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back
                    </Link>
                </Button>
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-destructive">An error occurred while loading analytics. Please try again later.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }
}
