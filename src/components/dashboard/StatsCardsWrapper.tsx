import { Suspense } from "react";
import { StatsCards } from "./StatsCards";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AriaLiveRegion } from "@/lib/ui/aria-live-region";

interface Stats {
  total: number;
  open: number;
  inProgress: number;
  awaitingStudent: number;
  resolved: number;
  escalated: number;
}

interface StatsCardsWrapperProps {
  statsPromise: Promise<Stats>;
}

function StatsCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i} className="border-2">
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

async function StatsCardsContent({ statsPromise }: StatsCardsWrapperProps) {
  const stats = await statsPromise;
  return (
    <>
      <AriaLiveRegion
        success={true}
        successMessage={`Loaded ${stats.total} tickets`}
        dataCount={stats.total}
        dataLabel="tickets"
      />
      <StatsCards stats={stats} />
    </>
  );
}

export function StatsCardsWrapper({ statsPromise }: StatsCardsWrapperProps) {
  return (
    <Suspense 
      fallback={
        <>
          <AriaLiveRegion loading={true} loadingMessage="Loading ticket statistics..." />
          <StatsCardsSkeleton />
        </>
      }
    >
      <StatsCardsContent statsPromise={statsPromise} />
    </Suspense>
  );
}
