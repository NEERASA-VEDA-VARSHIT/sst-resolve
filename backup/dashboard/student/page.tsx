import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, tickets } from "@/db";
import { desc, eq } from "drizzle-orm";
import { TicketCard } from "@/components/layout/TicketCard";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function StudentDashboardPage() {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    redirect("/");
  }

  // Get user number from Clerk metadata
  const userNumber = sessionClaims?.metadata?.userNumber as string | undefined;
  
  if (!userNumber) {
    // Redirect to profile to link user number
    redirect("/profile");
  }

  // Get tickets for this student
  const allTickets = await db
    .select()
    .from(tickets)
    .where(eq(tickets.userNumber, userNumber))
    .orderBy(desc(tickets.createdAt));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">My Tickets</h1>
        <Link href="/dashboard/ticket/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Ticket
          </Button>
        </Link>
      </div>

      {allTickets.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No tickets found. Create your first ticket!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {allTickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </div>
  );
}

