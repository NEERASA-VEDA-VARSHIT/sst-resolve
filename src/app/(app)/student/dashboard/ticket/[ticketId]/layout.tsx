import { Suspense, type ReactNode } from "react";
import { TicketSkeleton } from "@/components/tickets/TicketSkeleton";

export default function TicketLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<TicketSkeleton />}>
      {children}
    </Suspense>
  );
}
