"use client";

import dynamic from "next/dynamic";
import type { TicketStatus } from "@/lib/status/types";

// Dynamic import to avoid Radix hydration mismatch issues
const TicketSearch = dynamic(
  () => import("@/components/student/TicketSearch"),
  {
    ssr: false,
    loading: () => (
      <div className="h-20 w-full animate-pulse rounded-md bg-muted/40" />
    ),
  }
);

interface CategoryOption {
  value: string;
  label: string;
  id: number;
  subcategories?: {
    value: string;
    label: string;
    id: number;
    sub_subcategories?: {
      value: string;
      label: string;
      id: number;
    }[];
    fields?: {
      id: number;
      name: string;
      slug: string;
      type: string;
      options: { label: string; value: string }[];
    }[];
  }[];
}

interface TicketSearchWrapperProps {
  categories: CategoryOption[];
  currentSort: string;
  statuses: TicketStatus[];
}

export function TicketSearchWrapper(props: TicketSearchWrapperProps) {
  return <TicketSearch {...props} />;
}
