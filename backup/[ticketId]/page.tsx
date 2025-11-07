import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { db, tickets } from "@/db";
import { eq } from "drizzle-orm";
import { Sidebar } from "@/components/layout/Sidebar";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar } from "lucide-react";
import { CommentForm } from "@/components/tickets/CommentForm";
import { AdminActions } from "@/components/tickets/AdminActions";
import { StudentActions } from "@/components/tickets/StudentActions";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { userId, sessionClaims } = await auth();
  
  if (!userId) {
    redirect("/");
  }

  const { ticketId } = await params;
  const id = parseInt(ticketId);

  if (isNaN(id)) {
    notFound();
  }

  const ticket = await db.select().from(tickets).where(eq(tickets.id, id)).limit(1);

  if (ticket.length === 0) {
    notFound();
  }

  const ticketData = ticket[0];
  
  // Get user role
  const role = sessionClaims?.metadata?.role;
  const isAdmin = role === "admin" || role === "super_admin";
  
  // Check if student owns this ticket
  let isOwner = false;
  if (!isAdmin) {
    try {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      const userNumber = (user.publicMetadata as any)?.userNumber as string | undefined;
      isOwner = userNumber === ticketData.userNumber;
    } catch (error) {
      console.error("Error checking ticket ownership:", error);
    }
  }
  
  // Parse details JSON to get TAT and comments
  let details: any = {};
  if (ticketData.details) {
    try {
      details = JSON.parse(ticketData.details);
    } catch (e) {
      console.error("Error parsing details:", e);
    }
  }

  return (
    <div className="flex h-[calc(100vh-73px)]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <Link href="/dashboard">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Tickets
            </Button>
          </Link>

          <div className="border rounded-lg p-6 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <h1 className="text-3xl font-bold">Ticket #{ticketData.id}</h1>
                <div className="flex items-center gap-2">
                  {ticketData.status && (
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      ticketData.status === 'open' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                      ticketData.status === 'closed' ? 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' :
                      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                    }`}>
                      {ticketData.status}
                    </span>
                  )}
                  <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                    {ticketData.category}
                  </span>
                </div>
              </div>
              {ticketData.subcategory && (
                <p className="text-muted-foreground text-sm">{ticketData.subcategory}</p>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">User Number</label>
                <p className="text-lg">{ticketData.userNumber}</p>
              </div>

              {ticketData.location && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Location</label>
                  <p className="text-lg">{ticketData.location}</p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-muted-foreground">Description</label>
                <p className="text-lg whitespace-pre-wrap">
                  {ticketData.description || "No description provided"}
                </p>
              </div>

              {details.tat && (
                <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-950">
                  <label className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1 block">
                    ⏱️ Turnaround Time (TAT)
                  </label>
                  <p className="text-lg text-blue-800 dark:text-blue-200">
                    {details.tat}
                  </p>
                  {details.tatDate && (
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      Target Date: {new Date(details.tatDate).toLocaleDateString()} {new Date(details.tatDate).toLocaleTimeString()}
                    </p>
                  )}
                  {details.tatSetBy && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      Set by {details.tatSetBy} on {details.tatSetAt ? new Date(details.tatSetAt).toLocaleString() : ""}
                      {details.tatExtendedAt && ` • Extended on ${new Date(details.tatExtendedAt).toLocaleString()}`}
                    </p>
                  )}
                </div>
              )}

              <div className="border-t pt-4">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  💬 Comments {details.comments && details.comments.length > 0 && `(${details.comments.length})`}
                </label>
                
                {details.comments && details.comments.length > 0 && (
                  <div className="space-y-3 mb-4">
                    {details.comments.map((comment: any, idx: number) => (
                      <div key={idx} className="border rounded-lg p-4 bg-muted/50">
                        <p className="text-base whitespace-pre-wrap">{comment.text}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <span>By {comment.author}</span>
                          {comment.createdAt && (
                            <>
                              <span>•</span>
                              <span>{new Date(comment.createdAt).toLocaleString()}</span>
                            </>
                          )}
                          {comment.source && (
                            <>
                              <span>•</span>
                              <span className="capitalize">{comment.source}</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <CommentForm ticketId={ticketData.id} />
              </div>

              {isAdmin && (
                <AdminActions 
                  ticketId={ticketData.id} 
                  currentStatus={ticketData.status || "open"}
                  hasTAT={!!details.tat}
                />
              )}

              {!isAdmin && isOwner && (
                <StudentActions 
                  ticketId={ticketData.id} 
                  currentStatus={ticketData.status || "open"}
                />
              )}

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>
                  Created {ticketData.createdAt?.toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
