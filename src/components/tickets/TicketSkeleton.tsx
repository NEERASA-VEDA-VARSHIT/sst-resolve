import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function TicketSkeleton() {
  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <Skeleton className="h-10 w-40" />
      </div>

      {/* Main Ticket Card */}
      <Card className="border-2 shadow-lg">
        <CardHeader className="space-y-4 pb-4">
          <div className="space-y-3">
            <Skeleton className="h-12 w-48" />
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-6 w-32" />
              </div>
              
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-6 w-40" />
              </div>
              
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-6 w-28" />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Student Information Section */}
          <section className="rounded-lg border bg-muted/30 p-4">
            <Skeleton className="h-6 w-48 mb-4" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-5 w-full" />
                </div>
              ))}
            </div>
          </section>

          {/* Submitted Information */}
          <Card className="border bg-card">
            <CardHeader>
              <Skeleton className="h-7 w-56 mb-2" />
              <Skeleton className="h-4 w-full" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="space-y-2 p-3 rounded-lg bg-background/50 border border-border/50">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Assignment Information */}
          <section className="rounded-lg border bg-muted/30 p-4">
            <Skeleton className="h-6 w-56 mb-4" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(2)].map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-4 w-32 mb-2" />
                  <Skeleton className="h-5 w-full" />
                </div>
              ))}
            </div>
          </section>

          {/* Ticket Progress */}
          <section className="rounded-lg border bg-muted/30 p-4">
            <Skeleton className="h-6 w-40 mb-4" />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-2.5 w-full" />
              <div className="flex items-center justify-between gap-2 mt-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-3 w-16" />
                ))}
              </div>
            </div>
          </section>

          {/* Timeline */}
          <section className="rounded-lg border bg-muted/30 p-4">
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-5 w-36" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Comments */}
          <Card className="border-2">
            <CardHeader className="pb-4">
              <Skeleton className="h-7 w-64" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="rounded-lg border bg-muted/50 p-4">
                  <Skeleton className="h-20 w-full mb-3" />
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <Skeleton className="h-6 w-40 mb-4" />
            <div className="flex gap-3">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-32" />
            </div>
          </div>

          {/* System Information */}
          <section className="rounded-lg border bg-muted/30 p-4">
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-3 w-64 mb-4" />
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-5 w-12" />
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
