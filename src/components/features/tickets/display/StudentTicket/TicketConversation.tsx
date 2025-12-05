import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, User, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { CommentForm } from "@/components/features/tickets/forms/CommentForm";
import type { TicketComment, TicketStatusDisplay } from "@/types/ticket";

interface TicketConversationProps {
  comments: TicketComment[];
  ticketId: number;
  status: TicketStatusDisplay | null;
  normalizedStatus: string;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  optimisticComments?: Array<{ text: string; source: string; createdAt: Date }>;
}

export function TicketConversation({
  comments,
  ticketId,
  status,
  normalizedStatus,
  emptyStateTitle = "No comments yet",
  emptyStateDescription = "Updates and responses will appear here",
  optimisticComments = [],
}: TicketConversationProps) {
  const canComment = normalizedStatus === "awaiting_student" || normalizedStatus === "awaiting_student_response";
  const lastComment = comments.length > 0 ? comments[comments.length - 1] : null;
  const showAlert = canComment && lastComment && lastComment.source !== "website";
  
  // Merge optimistic comments with server comments
  const allComments = [
    ...comments,
    ...optimisticComments.map((opt) => ({
      text: opt.text,
      source: opt.source,
      createdAt: opt.createdAt,
      created_at: opt.createdAt,
      author: opt.source === "website" ? "You" : undefined,
    })),
  ];

  return (
    <Card className="border-2 shadow-md">
      <CardHeader className="pb-3 bg-gradient-to-r from-muted/30 to-transparent">
        <CardTitle className="flex items-center gap-2 text-xl">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <MessageSquare className="w-5 h-5 text-primary" />
          </div>
          Conversation
          {allComments.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {allComments.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {allComments.length > 0 ? (
          <ScrollArea className="max-h-[500px] pr-4">
            <div className="space-y-4">
              {allComments.map((comment, idx) => {
                const commentCreatedAt = comment.createdAt || comment.created_at;
                const isStudent = comment.source === "website";
                const isAdmin = !isStudent;

                return (
                  <div key={idx} className={`flex gap-3 ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex gap-3 max-w-[80%] ${isAdmin ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isAdmin ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                        <User className="w-4 h-4" />
                      </div>
                      <div className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}>
                        <div className={`rounded-2xl px-4 py-3 ${isAdmin ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted border rounded-tl-sm'}`}>
                          <p className={`text-sm whitespace-pre-wrap leading-relaxed break-words ${isAdmin ? 'text-primary-foreground' : ''}`}>{comment.text}</p>
                        </div>
                        <div className={`flex items-center gap-2 text-xs text-muted-foreground mt-1 px-1 ${isAdmin ? 'flex-row-reverse' : ''}`}>
                          {commentCreatedAt && (
                            <>
                              <span className="font-medium">{format(new Date(commentCreatedAt), 'MMM d, yyyy')}</span>
                              <span>•</span>
                              <span className="font-medium">{format(new Date(commentCreatedAt), 'h:mm a')}</span>
                              {comment.author && (
                                <>
                                  <span>•</span>
                                  <span className="font-medium">{comment.author}</span>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <MessageSquare className="w-8 h-8 opacity-50" />
            </div>
            <p className="text-sm font-medium mb-1">{emptyStateTitle}</p>
            <p className="text-xs">{emptyStateDescription}</p>
          </div>
        )}

        {canComment && (
          <div className="pt-6 mt-6 border-t">
            {showAlert && (
              <Alert className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 mb-4">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-sm">
                  <span className="font-medium text-amber-900 dark:text-amber-100">
                    Admin has asked a question. Please respond below.
                  </span>
                </AlertDescription>
              </Alert>
            )}
            <CommentForm 
              ticketId={ticketId} 
              currentStatus={status?.value || undefined}
              comments={comments}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
