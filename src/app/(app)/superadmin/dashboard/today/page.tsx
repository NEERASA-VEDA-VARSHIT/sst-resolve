import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, tickets } from "@/db";
import { desc } from "drizzle-orm";
import { TicketCard } from "@/components/layout/TicketCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, AlertTriangle, CheckCircle2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function SuperAdminTodayPendingPage() {
  const { userId, sessionClaims } = await auth();
  if (!userId) redirect("/");

  const role = sessionClaims?.metadata?.role || "student";
  if (role !== "super_admin") redirect("/student/dashboard");

  let allTickets = await db
    .select()
    .from(tickets)
    .orderBy(desc(tickets.createdAt));

  const now = new Date();
  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth();
  const todayDate = now.getDate();

  const pendingStatuses = new Set(["open", "in_progress", "awaiting_student_response", "reopened"]);

  const todayPending = allTickets.filter(t => {
    const status = (t.status || "").toLowerCase();
    const hasPendingStatus = pendingStatuses.has(status);
    
    if (!hasPendingStatus) return false;
    
    try {
      const d = t.details ? JSON.parse(String(t.details)) : {};
      if (!d.tatDate) return false;
      
      const tatDate = new Date(d.tatDate);
      if (isNaN(tatDate.getTime())) return false;
      
      const tatYear = tatDate.getFullYear();
      const tatMonth = tatDate.getMonth();
      const tatDay = tatDate.getDate();
      
      const tatIsToday = 
        tatYear === todayYear &&
        tatMonth === todayMonth &&
        tatDay === todayDate;
      
      return tatIsToday;
    } catch {
      return false;
    }
  });

  const overdueToday = allTickets.filter(t => {
    const status = (t.status || "").toLowerCase();
    if (!pendingStatuses.has(status)) return false;
    
    try {
      const d = t.details ? JSON.parse(String(t.details)) : {};
      if (!d.tatDate) return false;
      
      const tatDate = new Date(d.tatDate);
      if (isNaN(tatDate.getTime())) return false;
      
      const tatYear = tatDate.getFullYear();
      const tatMonth = tatDate.getMonth();
      const tatDay = tatDate.getDate();
      
      const tatIsToday = 
        tatYear === todayYear &&
        tatMonth === todayMonth &&
        tatDay === todayDate;
      
      if (tatIsToday) return false;
      
      const tatTime = new Date(tatYear, tatMonth, tatDay).getTime();
      const todayTime = new Date(todayYear, todayMonth, todayDate).getTime();
      
      return tatTime < todayTime;
    } catch {
      return false;
    }
  });

  const overdueTodayIds = new Set(overdueToday.map(t => t.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">Today Pending</h1>
          <p className="text-muted-foreground text-sm">
            Tickets with TAT due today
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/superadmin/dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Total Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{todayPending.length}</div>
            <div className="text-sm text-muted-foreground mt-1">Due today</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Overdue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">{overdueToday.length}</div>
            <div className="text-sm text-muted-foreground mt-1">Past TAT date</div>
          </CardContent>
        </Card>
      </div>

      {todayPending.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="font-medium mb-1">No tickets pending today</p>
            <p className="text-sm text-muted-foreground text-center">
              All tickets are on track.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div>
          <h2 className="text-xl font-semibold mb-4">
            Tickets ({todayPending.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {todayPending.map((t) => (
              <div key={t.id} className={overdueTodayIds.has(t.id) ? "ring-2 ring-orange-400 dark:ring-orange-500 rounded-lg" : ""}>
                <TicketCard ticket={t as any} basePath="/superadmin/dashboard" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

