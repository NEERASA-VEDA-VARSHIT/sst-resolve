import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, tickets } from "@/db";
import { desc } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { FileText, Clock, CheckCircle2, AlertCircle, TrendingUp, ArrowLeft, BarChart3 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function SuperAdminAnalyticsPage() {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    redirect("/");
  }

  const role = sessionClaims?.metadata?.role || 'student';

  if (role !== 'super_admin') {
    redirect('/student/dashboard');
  }

  const allTickets = await db.select().from(tickets).orderBy(desc(tickets.createdAt));

  const stats = {
    total: allTickets.length,
    open: allTickets.filter(t => t.status === 'open').length,
    closed: allTickets.filter(t => t.status === 'closed').length,
    inProgress: allTickets.filter(t => t.status && t.status !== 'open' && t.status !== 'closed').length,
    escalated: allTickets.filter(t => (Number(t.escalationCount) || 0) > 0).length,
    acknowledged: allTickets.filter(t => t.acknowledgedAt).length,
    resolved: allTickets.filter(t => t.status === 'resolved').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            System Analytics
          </h1>
          <p className="text-muted-foreground">
            Comprehensive analytics and insights across all tickets
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/superadmin/dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-2">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <FileText className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Total Tickets</p>
            <p className="text-3xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Open</p>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.open}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.total > 0 ? ((stats.open / stats.total) * 100).toFixed(1) : 0}% of total
            </p>
          </CardContent>
        </Card>
        <Card className="border-2 border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Resolved</p>
            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{stats.resolved}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.total > 0 ? ((stats.resolved / stats.total) * 100).toFixed(1) : 0}% of total
            </p>
          </CardContent>
        </Card>
        <Card className="border-2 border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Escalated</p>
            <p className="text-3xl font-bold text-red-600 dark:text-red-400">{stats.escalated}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.total > 0 ? ((stats.escalated / stats.total) * 100).toFixed(1) : 0}% of total
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Category Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Hostel</span>
                  <span className="text-sm font-bold">
                    {allTickets.filter(t => t.category === "Hostel").length}
                  </span>
                </div>
                <Progress 
                  value={stats.total > 0 ? (allTickets.filter(t => t.category === "Hostel").length / stats.total) * 100 : 0} 
                  className="h-2"
                />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">College</span>
                  <span className="text-sm font-bold">
                    {allTickets.filter(t => t.category === "College").length}
                  </span>
                </div>
                <Progress 
                  value={stats.total > 0 ? (allTickets.filter(t => t.category === "College").length / stats.total) * 100 : 0} 
                  className="h-2"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Status Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Open</span>
                  <span className="text-sm font-bold">{stats.open}</span>
                </div>
                <Progress value={stats.total > 0 ? (stats.open / stats.total) * 100 : 0} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">In Progress</span>
                  <span className="text-sm font-bold">{stats.inProgress}</span>
                </div>
                <Progress value={stats.total > 0 ? (stats.inProgress / stats.total) * 100 : 0} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Acknowledged</span>
                  <span className="text-sm font-bold">{stats.acknowledged}</span>
                </div>
                <Progress value={stats.total > 0 ? (stats.acknowledged / stats.total) * 100 : 0} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Resolved</span>
                  <span className="text-sm font-bold">{stats.resolved}</span>
                </div>
                <Progress value={stats.total > 0 ? (stats.resolved / stats.total) * 100 : 0} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Closed</span>
                  <span className="text-sm font-bold">{stats.closed}</span>
                </div>
                <Progress value={stats.total > 0 ? (stats.closed / stats.total) * 100 : 0} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

