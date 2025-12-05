import { Suspense, type ReactNode } from "react";
import { TicketSkeleton } from "@/components/features/tickets/display/TicketSkeleton";

export default function TicketLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<TicketSkeleton />}>
      {children}
    </Suspense>
  );
}
