import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import nextDynamic from "next/dynamic";

// Data loading
import { getCachedUser } from "@/lib/cache/cached-queries";
import { getStudentTicketViewModel } from "@/lib/tickets/viewModel";

// UI Components
import { TicketHeader } from "@/components/student/ticket/TicketHeader";
import { TicketQuickInfo } from "@/components/student/ticket/TicketQuickInfo";
import { TicketSubmittedInfo } from "@/components/student/ticket/TicketSubmittedInfo";
import { StudentActions } from "@/components/tickets/StudentActions";

// Lazy-load heavy, below-the-fold sections using dynamic imports.
// Note: We don't disable SSR here because this is a Server Component.
const TicketTimeline = nextDynamic(() =>
  import("@/components/student/ticket/TicketTimeline").then(
    (mod) => mod.TicketTimeline
  )
);

const TicketConversation = nextDynamic(() =>
  import("@/components/student/ticket/TicketConversation").then(
    (mod) => mod.TicketConversation
  )
);

const TicketRating = nextDynamic(() =>
  import("@/components/student/ticket/TicketRating").then(
    (mod) => mod.TicketRating
  )
);

const TicketTATInfo = nextDynamic(() =>
  import("@/components/student/ticket/TicketTATInfo").then(
    (mod) => mod.TicketTATInfo
  )
);

const TicketStudentInfo = nextDynamic(() =>
  import("@/components/student/ticket/TicketStudentInfo").then(
    (mod) => mod.TicketStudentInfo
  )
);

export const dynamic = "force-dynamic";
export const revalidate = 30;

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
  params: Promise<{ ticketId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized"); // Should never happen due to layout protection

  const { ticketId } = await params;
  const id = Number(ticketId);
  if (!Number.isFinite(id)) notFound();

  // Get user
  const dbUser = await getCachedUser(userId);

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
