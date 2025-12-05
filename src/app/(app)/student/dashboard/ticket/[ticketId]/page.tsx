import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import nextDynamic from "next/dynamic";
import { db, tickets } from "@/db";
import { desc } from "drizzle-orm";

// Data loading
import { getCachedUser } from "@/lib/cache/cached-queries";
import { getStudentTicketViewModel } from "@/lib/ticket/data/viewModel";

// UI Components
import { TicketHeader } from "@/components/features/tickets/display/StudentTicket/TicketHeader";
import { TicketQuickInfo } from "@/components/features/tickets/display/StudentTicket/TicketQuickInfo";
import { TicketSubmittedInfo } from "@/components/features/tickets/display/StudentTicket/TicketSubmittedInfo";
import { StudentActions } from "@/components/features/tickets/actions/StudentActions";

// Lazy-load heavy, below-the-fold sections using dynamic imports.
// Note: We don't disable SSR here because this is a Server Component.
const TicketTimeline = nextDynamic(() =>
  import("@/components/features/tickets/display/StudentTicket/TicketTimeline").then(
    (mod) => mod.TicketTimeline
  )
);

const TicketConversation = nextDynamic(() =>
  import("@/components/features/tickets/display/StudentTicket/TicketConversation").then(
    (mod) => mod.TicketConversation
  )
);

const TicketRating = nextDynamic(() =>
  import("@/components/features/tickets/display/StudentTicket/TicketRating").then(
    (mod) => mod.TicketRating
  )
);

const TicketTATInfo = nextDynamic(() =>
  import("@/components/features/tickets/display/StudentTicket/TicketTATInfo").then(
    (mod) => mod.TicketTATInfo
  )
);

const TicketStudentInfo = nextDynamic(() =>
  import("@/components/features/tickets/display/StudentTicket/TicketStudentInfo").then(
    (mod) => mod.TicketStudentInfo
  )
);

// Use ISR (Incremental Static Regeneration) - revalidate every 30 seconds
// Removed force-dynamic to allow revalidation to work
export const revalidate = 30;

// Allow on-demand rendering for tickets not in the static params list
export const dynamicParams = true;

/**
 * Generate static params for ticket detail pages
 * Pre-renders the 50 most recent tickets at build time for faster loads
 */
export async function generateStaticParams() {
  try {
    const recentTickets = await db
      .select({ id: tickets.id })
      .from(tickets)
      .orderBy(desc(tickets.created_at))
      .limit(50);

    return recentTickets.map((ticket) => ({
      ticketId: ticket.id.toString(),
    }));
  } catch (error) {
    console.error("Error generating static params for tickets:", error);
    // Return empty array on error to allow build to continue
    return [];
  }
}

/**
 * Student Ticket Detail Page
 * 
 * Pure UI + Data Loading
 * All business logic is handled by getStudentTicketViewModel()
 * 
 * Note: Auth is handled by student/layout.tsx
 */
export default async function StudentTicketPage({
  params,
}: {
  params: { ticketId: string };
}) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized"); // Should never happen due to layout protection

  const { ticketId } = params;
  const id = Number(ticketId);
  if (!Number.isFinite(id)) notFound();

  // Get user
  const dbUser = await getCachedUser(userId);
  if (!dbUser) {
    throw new Error("User not found in database");
  }

  // Load view model (handles all business logic)
  const vm = await getStudentTicketViewModel(id, dbUser.id);

  if (!vm) {
    notFound();
  }

  // Render UI with view model
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="max-w-6xl mx-auto px-3 py-4 sm:px-4 sm:py-6 md:px-6 md:py-8 space-y-3 sm:space-y-4 md:space-y-6">
        <TicketHeader
          ticketId={vm.ticket.id}
          status={vm.statusDisplay}
          category={vm.category}
          subcategory={vm.subcategory}
        />

        <Card className="border-2 shadow-xl bg-card/50 backdrop-blur-sm">
          <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
            <TicketQuickInfo
              ticketProgress={vm.ticketProgress}
              normalizedStatus={vm.normalizedStatus}
              assignedStaff={vm.assignedStaff}
              tatInfo={vm.tatInfo}
              ticket={vm.ticket}
            />

            <TicketSubmittedInfo
              description={vm.ticket.description}
              location={vm.ticket.location}
              images={vm.images}
              dynamicFields={vm.normalizedDynamicFields}
            />

            <TicketTimeline entries={vm.timelineEntries} />

            <TicketConversation
              comments={vm.normalizedComments}
              ticketId={vm.ticket.id}
              status={vm.statusDisplay}
              normalizedStatus={vm.normalizedStatus}
              optimisticComments={[]}
            />

            {(vm.normalizedStatus === "closed" || vm.normalizedStatus === "resolved") && (
              <TicketRating
                ticketId={vm.ticket.id}
                currentRating={vm.ticket.rating ? String(vm.ticket.rating) : undefined}
              />
            )}

            <StudentActions
              ticketId={vm.ticket.id}
              currentStatus={vm.statusDisplay?.value || "open"}
            />

            <TicketTATInfo tatInfo={vm.tatInfo} />

            {(vm.ticket.escalation_level ?? 0) > 0 && (
              <Card className="border-2 bg-muted/30">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Escalation Level
                    </span>
                    <span className="text-sm font-semibold">{vm.ticket.escalation_level}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            <TicketStudentInfo profileFields={vm.resolvedProfileFields} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
