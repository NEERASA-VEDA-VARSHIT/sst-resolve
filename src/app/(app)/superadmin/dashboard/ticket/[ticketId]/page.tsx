import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, ArrowLeft, User, MapPin, FileText, Clock, AlertTriangle, Image as ImageIcon, MessageSquare } from "lucide-react";
import { db, tickets } from "@/db";
import { eq } from "drizzle-orm";
import { AdminActions } from "@/components/tickets/AdminActions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default async function SuperAdminTicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { userId, sessionClaims } = await auth();
  if (!userId) redirect("/");
  const role = sessionClaims?.metadata?.role;
  if (role !== "super_admin") redirect("/student/dashboard");

  const { ticketId } = await params;
  const id = Number(ticketId);
  if (!Number.isFinite(id)) notFound();

  const row = await db.select().from(tickets).where(eq(tickets.id, id)).limit(1);
  if (row.length === 0) notFound();
  const ticket = row[0];

  let details: any = {};
  try {
    details = ticket.details ? JSON.parse(ticket.details) : {};
  } catch {
    details = {};
  }

  const getStatusBadgeClass = (status: string | null | undefined) => {
    if (!status) return "bg-muted text-foreground";
    switch (status) {
      case "open":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-transparent";
      case "reopened":
        return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 border-transparent";
      case "in_progress":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-transparent";
      case "awaiting_student_response":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border-transparent";
      case "resolved":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border-transparent";
      case "closed":
        return "bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border-transparent";
      default:
        return "bg-muted text-foreground";
    }
  };

  // Check for TAT
  const tatDate = details.tatDate ? new Date(details.tatDate) : null;
  const hasTATDue = tatDate && tatDate.getTime() < new Date().getTime();
  const isTATToday = tatDate && tatDate.toDateString() === new Date().toDateString();

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <Link href="/superadmin/dashboard">
        <Button variant="ghost" className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Tickets
        </Button>
      </Link>

      {/* Header Card */}
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="text-3xl font-bold mb-2">Ticket #{ticket.id}</CardTitle>
              {ticket.subcategory && (
                <p className="text-muted-foreground">{ticket.subcategory}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {ticket.status && (
                <Badge variant="outline" className={`${getStatusBadgeClass(ticket.status)} text-sm px-3 py-1`}>
                  {ticket.status.replaceAll("_", " ")}
                </Badge>
              )}
              {ticket.escalationCount && ticket.escalationCount !== "0" && (
                <Badge variant="destructive" className="text-sm px-3 py-1">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Escalated × {ticket.escalationCount}
                </Badge>
              )}
              <Badge variant="outline" className="text-sm px-3 py-1">{ticket.category}</Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* TAT Alert */}
      {(hasTATDue || isTATToday) && (
        <Card className={`border-2 ${hasTATDue ? 'border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20' : 'border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20'}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-5 h-5 ${hasTATDue ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`} />
              <div>
                <p className={`font-semibold ${hasTATDue ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
                  {hasTATDue ? 'TAT Overdue' : 'TAT Due Today'}
                </p>
                {tatDate && (
                  <p className="text-sm text-muted-foreground">
                    Target resolution date: {tatDate.toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ticket Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Description
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="whitespace-pre-wrap text-base leading-relaxed">
                {ticket.description || "No description provided"}
              </p>
              
              {/* Display Images if available */}
              {details.images && Array.isArray(details.images) && details.images.length > 0 && (
                <div className="space-y-2 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold text-muted-foreground">Attached Images</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {details.images.map((imageUrl: string, index: number) => (
                      <a
                        key={index}
                        href={imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative group aspect-square rounded-lg overflow-hidden border-2 border-border hover:border-primary transition-colors"
                      >
                        <img
                          src={imageUrl}
                          alt={`Ticket image ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Comments Section */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Comments
                {Array.isArray(details?.comments) && details.comments.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {details.comments.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.isArray(details?.comments) && details.comments.length > 0 ? (
                <div className="space-y-3">
                  {details.comments.map((comment: any, idx: number) => {
                    const isInternal = comment.isInternal || comment.type === "internal_note" || comment.type === "super_admin_note";
                    return (
                      <Card key={idx} className={`border ${isInternal ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800' : 'bg-muted/30'}`}>
                        <CardContent className="p-4">
                          {isInternal && (
                            <Badge variant="outline" className="mb-2 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700">
                              Internal Note
                            </Badge>
                          )}
                          <p className="text-base whitespace-pre-wrap leading-relaxed mb-3">
                            {comment.text}
                          </p>
                          <Separator className="my-2" />
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {comment.author && (
                              <div className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                <span className="font-medium">{comment.author}</span>
                              </div>
                            )}
                            {comment.createdAt && (
                              <>
                                <span>•</span>
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  <span>{new Date(comment.createdAt).toLocaleString()}</span>
                                </div>
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No comments yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Admin Actions */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <AdminActions
                ticketId={ticket.id}
                currentStatus={ticket.status || "open"}
                hasTAT={!!details.tat}
                isPublic={ticket.isPublic === "true"}
                isSuperAdmin={true}
                ticketCategory={ticket.category}
                ticketLocation={ticket.location}
                currentAssignedTo={ticket.assignedTo}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="border-2">
            <CardHeader>
              <CardTitle>Ticket Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-1">
                  <User className="w-4 h-4" />
                  User Number
                </label>
                <p className="text-base font-medium">{ticket.userNumber}</p>
              </div>
              {ticket.location && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-1">
                      <MapPin className="w-4 h-4" />
                      Location
                    </label>
                    <p className="text-base font-medium">{ticket.location}</p>
                  </div>
                </>
              )}
              <Separator />
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4" />
                  Created
                </label>
                <p className="text-base font-medium">
                  {ticket.createdAt?.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
              {details.tat && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4" />
                      TAT
                    </label>
                    <p className="text-base font-medium">{details.tat}</p>
                    {tatDate && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Due: {tatDate.toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

